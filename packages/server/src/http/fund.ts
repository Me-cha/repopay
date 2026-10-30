import type { Express } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { authorizeAction,findBounty } from '../actions/guards.js';
import { prepareFunding,confirmFunding } from '../actions/fund.js';
import { readActionToken } from '../actions/tokens.js';
import { fundingAttempts } from '../db/schema.js';
import { makeTerms,termsSchema,termsHash,type FundedTerms,type SponsorSnapshot } from '../domain/funded-terms.js';
import { parseCopilotEnv,type FundingEnv } from '../env.js';
import { AuthError } from '../github/oauth.js';
import { safeApprovalUrl } from '../paypal/orders.js';
import { listCopilotModels } from '../models/copilot.js';
import { checkCsrf,csrfFor,requireSession } from './session.js';
import { dollars,escapeHtml,htmlPage,pageSession,safeError,type AuthenticationDependencies } from './auth.js';
const confirmBody=z.object({csrf:z.string()}).strict();
const prepareBody=confirmBody.extend({termsHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
function termsHtml(t:FundedTerms) {
 const sponsor='sponsor' in t?`<p>Copilot review usage is billed by GitHub to sponsor <strong>${escapeHtml(t.sponsor.login)}</strong>. ${t.policy.model==='auto'?'Model: <code>auto</code>. GitHub chooses the serving model for each review; GitPay records the model it reports.':`Fixed model: <code>${escapeHtml(t.policy.model)}</code>.`} GitHub’s billing settings control actual charges.</p>`:'';
 return `<p><strong>${dollars(t.amountCents)} USD</strong> for issue #${String(t.issueNumber)}. Anyone may submit work; no assignment reserves the bounty.</p><h2>${escapeHtml(t.title)}</h2><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(t.criteria)}</pre><p>Funding freezes these criteria and the policy below. The first qualifying merged PR wins, ordered by merge time, PR number, then stable PR ID. Funded cancellation is unavailable in this phase. Review notice is ${String(t.policy.noticeHours)} hours when that feature becomes available.</p>${sponsor}<details open><summary>Eligibility and verification policy</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(JSON.stringify(t.policy,null,2))}</pre></details><p>Receiving sandbox merchant: ${escapeHtml(t.merchantId)}. Your signed-in GitHub identity is recorded as the funding actor when you confirm.</p>`;
}
function form(csrf:string,path:string,label:string,hash?:string){return `<form method="post" action="${escapeHtml(path)}"><input type="hidden" name="csrf" value="${csrf}">${hash?`<input type="hidden" name="termsHash" value="${hash}">`:''}<button type="submit">${label}</button></form>`;}
async function currentTerms(deps:AuthenticationDependencies&{env:FundingEnv;listCopilotModels?:typeof listCopilotModels},bounty:Awaited<ReturnType<typeof findBounty>>):Promise<FundedTerms> {
 const {auth,env,github}=deps;
 const sponsor=await auth.getCopilotSponsor(bounty.repoId);
 if(sponsor.installationId!==bounty.installationId)throw new AuthError(403,'The connected Copilot sponsor is not bound to this GitHub installation.');
 const identity=await auth.provider.identity(sponsor.accessToken),access=await auth.provider.repository(sponsor.accessToken,bounty.repoId);
 if(identity.id!==sponsor.sponsorGhId||access.ownerId!==identity.id||access.ownerType!=='User'||access.admin!==true)throw new AuthError(409,'The repository owner must reconnect the Copilot sponsor.');
 const probe=parseCopilotEnv({COPILOT_GITHUB_TOKEN:sponsor.accessToken,COPILOT_BILLING_OWNER_ID:sponsor.sponsorGhId,COPILOT_AUTH_KIND:'user',COPILOT_MODEL:'',COPILOT_TIMEOUT_MS:'30000',COPILOT_SHUTDOWN_TIMEOUT_MS:'5000',COPILOT_MAX_INPUT_BYTES:'200000',PROVIDER_RESPONSE_MAX_BYTES:String(env.PROVIDER_RESPONSE_MAX_BYTES)});
 if(env.COPILOT_MODEL!=='auto'){const models=await (deps.listCopilotModels??listCopilotModels)(probe);if(!models.some(item=>item.model===env.COPILOT_MODEL&&item.listed))throw new AuthError(409,`The connected sponsor cannot use ${env.COPILOT_MODEL}. Reconnect an account with access to this fixed model.`);}
 const repo=await github.repository(bounty.installationId,bounty.repoId),issue=await github.issueTerms(bounty.installationId,repo,bounty.issueNumber);
 const snapshot:SponsorSnapshot={sponsorGhId:sponsor.sponsorGhId,sponsorLogin:sponsor.sponsorLogin,modelId:sponsor.modelId,revokedAt:sponsor.revokedAt};
 return makeTerms(env,bounty,issue,snapshot);
}
export function mountFunding(app:Express,deps:AuthenticationDependencies&{env:FundingEnv;listCopilotModels?:typeof listCopilotModels}) {
 const {database,env,auth,github}=deps;
 app.get('/bounties/:id/fund',async(request,response)=>{
  try {
   const session=await pageSession(deps,request,response);if(!session)return;
   const b=await findBounty(database,request.params.id);await authorizeAction(auth,github,session,b,'read');
   const [attempt]=await database.orm.select().from(fundingAttempts).where(eq(fundingAttempts.id,b.currentFundingAttemptId??'0'));
   if(attempt?.active){response.redirect(303,`/bounties/${b.id}/funding/${attempt.id}`);return;}
   await authorizeAction(auth,github,session,b,'fund');
   if(b.status!=='OPEN'||b.fundingHold)throw new AuthError(409,'This bounty cannot start checkout.');
   let terms:FundedTerms;
   try{terms=await currentTerms(deps,b);}catch(error){if(error instanceof AuthError&&error.status===409&&/sponsor|model/i.test(error.message)){response.status(error.status).type('html').send(htmlPage('Copilot sponsor required',`<p role="alert">${escapeHtml(error.message)}</p><p><a href="/bounties/${encodeURIComponent(b.id)}/copilot-sponsor">Connect or manage Copilot sponsor</a></p>`));}else throw error;return;}
   response.type('html').send(htmlPage('Review bounty funding',termsHtml(terms)+form(csrfFor(session,request.path),request.path,'Prepare funding confirmation',termsHash(terms))));
  }catch(error){safeError(response,error,request.path);}
 });
 app.post('/bounties/:id/fund',async(request,response)=>{
  try {
   const session=await requireSession(auth,request);checkCsrf(request,env,session);const body=prepareBody.safeParse(request.body);if(!body.success)throw new AuthError(400,'Invalid funding request.');
   const b=await findBounty(database,request.params.id),ctx=await authorizeAction(auth,github,session,b,'fund');
   const terms=await currentTerms(deps,b);
   if(termsHash(terms)!==body.data.termsHash)throw new AuthError(409,'Issue criteria or policy changed. Reload and review the current terms.');
   const token=await prepareFunding(database,env,session,ctx,b,terms,()=>auth.clock.now());response.redirect(303,'/fund/a/'+token);
  }catch(error){safeError(response,error,request.path);}
 });
 app.get('/fund/a/:token',async(request,response)=>{
  try {
   const session=await pageSession(deps,request,response);if(!session)return;
   const token=await readActionToken(database,request.params.token),b=await findBounty(database,token.bountyId);await authorizeAction(auth,github,session,b,'fund');
   if(token.action!=='fund')throw new AuthError(404,'Funding confirmation not found.');
   if(token.usedAt||token.expiresAt<=auth.clock.now()||token.bountyVersion!==b.version) {
    response.status(409).type('html').send(htmlPage('Check funding status',`<p>This confirmation was used, expired, or the bounty changed.</p><p><a href="/bounties/${b.id}/fund">View funding status or prepare fresh terms</a></p>`));return;
   }
   response.type('html').send(htmlPage('Confirm sandbox funding',termsHtml(termsSchema.parse(token.params.terms))+'<p>Confirmation authorizes this checkout and its capture after PayPal approval. This page itself does not charge an account.</p>'+form(csrfFor(session,request.path),request.path,'Confirm and prepare checkout')));
  }catch(error){safeError(response,error,request.path);}
 });
 app.post('/fund/a/:token',async(request,response)=>{
  try {
   const session=await requireSession(auth,request);checkCsrf(request,env,session);if(!confirmBody.safeParse(request.body).success)throw new AuthError(400,'Unexpected funding parameters.');
   const token=await readActionToken(database,request.params.token),b=await findBounty(database,token.bountyId),ctx=await authorizeAction(auth,github,session,b,'fund');
   const attempt=await confirmFunding(database,env,session,ctx,request.params.token,()=>auth.clock.now());response.redirect(303,`/bounties/${b.id}/funding/${attempt.id}`);
  }catch(error){safeError(response,error,request.path);}
 });
 for(const suffix of ['', '/return','/cancel'])app.get('/bounties/:id/funding/:attempt'+suffix,async(request,response)=>{
  try {
   const session=await pageSession(deps,request,response);if(!session)return;
   const params=z.object({id:z.string(),attempt:z.string().regex(/^[1-9]\d{0,18}$/)}).parse(request.params);
   const b=await findBounty(database,params.id);await authorizeAction(auth,github,session,b,'read');
   const [a]=await database.orm.select().from(fundingAttempts).where(eq(fundingAttempts.id,params.attempt));if(!a||a.bountyId!==b.id)throw new AuthError(404,'Checkout not found.');
   if(suffix&&(!a.orderId||request.query.token!==a.orderId))throw new AuthError(400,'Return order does not match this funding attempt. Open funding status from the issue.');
   const current=b.currentFundingAttemptId===a.id&&a.active&&!b.fundingHold;
   const approval=current&&b.status==='OPEN'&&a.status==='CREATED'&&a.approvalUrl&&a.orderId?safeApprovalUrl(a.approvalUrl,a.orderId):null;
   response.type('html').send(htmlPage('Sandbox funding status',`<p>Bounty: ${escapeHtml(b.status)} · Checkout: ${escapeHtml(a.status)} · ${dollars(a.amountCents)} USD</p><p>Returning or cancelling navigation does not prove whether money moved. Only a verified completed capture marks the bounty funded. Do not start another payment while this attempt is unresolved.</p>${a.attention?'<p role="alert">Funding requires reconciliation. The existing payment identity is retained.</p>':''}${approval?`<p><a href="${escapeHtml(approval)}">Continue to PayPal sandbox</a></p>`:'<p>Checkout is being reconciled. Refresh to see its saved status.</p>'}<p><a href="/bounties/${b.id}/funding/${a.id}">Refresh funding status</a></p>`+termsHtml(a.terms)));
  }catch(error){safeError(response,error,request.path);}
 });
}
