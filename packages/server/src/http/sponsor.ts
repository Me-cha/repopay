import type { Express } from 'express';
import { eq } from 'drizzle-orm';
import { copilotSponsors } from '../db/schema.js';
import { AuthError } from '../github/oauth.js';
import { parseCopilotEnv } from '../env.js';
import { listCopilotModels } from '../models/copilot.js';
import { authorizeAction,findBounty } from '../actions/guards.js';
import { randomToken } from '../util/crypto.js';
import { checkCsrf,cookie,csrfFor,requireSession,setCookie } from './session.js';
import { escapeHtml,htmlPage,pageSession,safeError,type AuthenticationDependencies } from './auth.js';
export function mountCopilotSponsor(app:Express,deps:AuthenticationDependencies&{model:string;responseMaxBytes:number}) {
 const {auth,env,github,database}=deps;
 app.get('/bounties/:id/copilot-sponsor',async(request,response)=>{
  try{
   const session=await pageSession(deps,request,response);if(!session)return;
   const bounty=await findBounty(database,request.params.id);await authorizeAction(auth,github,session,bounty,'fund');
   const [grant]=await database.orm.select().from(copilotSponsors).where(eq(copilotSponsors.repoId,bounty.repoId));
   const active=grant&&!grant.revokedAt;
   response.type('html').send(htmlPage('Copilot review sponsor',`<p>Connect the owner account that will sponsor Copilot reviews for <strong>${escapeHtml(bounty.repoFullName)}</strong>.</p><p>GitHub will count review usage toward that account’s Copilot allowance and billing settings. Contributors’ Copilot accounts are not used.</p><p>GitPay uses the fixed model <code>${escapeHtml(deps.model)}</code>. Your account must have access to it. Copilot Free accounts currently have Auto-only model access.</p>${active?`<p>Connected sponsor: <strong>${escapeHtml(grant.sponsorLogin)}</strong>. Fixed model access last checked: ${escapeHtml(grant.modelVerifiedAt.toISOString())}.</p>`:''}<p>GitPay sends the issue criteria and bounded PR evidence to GitHub Copilot for review. You can disconnect this sponsor here at any time; new funding will then be blocked until another sponsor connects.</p><form method="post" action="/bounties/${encodeURIComponent(bounty.id)}/copilot-sponsor/connect"><input type="hidden" name="csrf" value="${csrfFor(session,`/bounties/${bounty.id}/copilot-sponsor/connect`)}"><button type="submit">${active?'Reconnect Copilot sponsor':'Connect Copilot sponsor'}</button></form>${active?`<form method="post" action="/bounties/${encodeURIComponent(bounty.id)}/copilot-sponsor/disconnect"><input type="hidden" name="csrf" value="${csrfFor(session,`/bounties/${bounty.id}/copilot-sponsor/disconnect`)}"><button type="submit">Disconnect sponsor</button></form>`:''}<p><a href="/bounties/${encodeURIComponent(bounty.id)}/fund">Return to funding</a></p>`));
  }catch(error){safeError(response,error,request.path);}
 });
 app.post('/bounties/:id/copilot-sponsor/connect',async(request,response)=>{
  try{
   const session=await requireSession(auth,request);checkCsrf(request,env,session);
   const bounty=await findBounty(database,request.params.id);await authorizeAction(auth,github,session,bounty,'fund');
   const binding=randomToken();const url=await auth.beginCopilotSponsor(bounty.repoId,bounty.installationId,`/bounties/${bounty.id}/copilot-sponsor`,session,binding);
   setCookie(response,env,'gitpay_sponsor_oauth',binding,env.OAUTH_STATE_TTL_SEC);response.redirect(303,url);
  }catch(error){safeError(response,error,request.path);}
 });
 app.get('/oauth/github/callback',async(request,response)=>{
  const binding=cookie(request,'gitpay_sponsor_oauth');let returnTo='/';
  try{
   const {code,state}=request.query;if(typeof code!=='string'||typeof state!=='string'||!binding)throw new AuthError(400,'Invalid sponsor authorization. Start again.');
   const session=await requireSession(auth,request),grant=await auth.completeCopilotSponsor(code,state,binding,session);returnTo=grant.returnTo;
   const modelEnv=parseCopilotEnv({COPILOT_GITHUB_TOKEN:grant.token.accessToken,COPILOT_BILLING_OWNER_ID:grant.user.id,COPILOT_AUTH_KIND:'user',COPILOT_MODEL:'',COPILOT_TIMEOUT_MS:'30000',COPILOT_SHUTDOWN_TIMEOUT_MS:'5000',COPILOT_MAX_INPUT_BYTES:'200000',PROVIDER_RESPONSE_MAX_BYTES:String(deps.responseMaxBytes)});
   const models=await listCopilotModels(modelEnv);
   if(!models.some(item=>item.model===deps.model&&item.listed))throw new AuthError(409,`This GitHub account cannot use ${deps.model}. Connect an account or organization plan that includes this fixed model.`);
   await auth.saveCopilotSponsor({...grant,modelId:deps.model});setCookie(response,env,'gitpay_sponsor_oauth','',0);response.redirect(303,grant.returnTo);
  }catch(error){setCookie(response,env,'gitpay_sponsor_oauth','',0);safeError(response,error,returnTo);}
 });
 app.post('/bounties/:id/copilot-sponsor/disconnect',async(request,response)=>{
  try{
   const session=await requireSession(auth,request);checkCsrf(request,env,session);
   const bounty=await findBounty(database,request.params.id);await authorizeAction(auth,github,session,bounty,'fund');
   const [grant]=await database.orm.select().from(copilotSponsors).where(eq(copilotSponsors.repoId,bounty.repoId));
   if(grant&&grant.sponsorGhId!==session.ghId)throw new AuthError(403,'Only the connected repository owner can disconnect this Copilot sponsor.');
   await auth.revokeCopilotSponsor(bounty.repoId);response.redirect(303,`/bounties/${encodeURIComponent(bounty.id)}/copilot-sponsor`);
  }catch(error){safeError(response,error,request.path);}
 });
}
