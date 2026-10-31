import {AuthError} from '../github/oauth.js';
import type { Express } from 'express';
import { z } from 'zod';
import type { FundingEnv } from '../env.js';
import { createReviewService } from '../actions/approve.js';
import { authorizeAction } from '../actions/guards.js';
import { candidateScanner } from '../settlement/candidates.js';
import { acceptsDemoProfile } from '../settlement/profile.js';
import { checkCsrf,csrfFor,requireSession } from './session.js';
import { dollars,escapeHtml,htmlPage,pageSession,safeError,type AuthenticationDependencies } from './auth.js';
function input<T extends z.ZodType>(schema:T,value:unknown):z.output<T>{const parsed=schema.safeParse(value);if(!parsed.success)throw new AuthError(400,'Invalid review parameters.');return parsed.data;}
const choice=z.object({csrf:z.string(),reason:z.string().trim().min(1).max(2000),recipient:z.string().regex(/^([1-9]\d*)?$/)}).strict();
export function mountReview(app:Express,deps:AuthenticationDependencies,env:FundingEnv){
 const service=createReviewService(deps.database,env,{scan:candidateScanner(deps.database,deps.github,env),authorize:(s,b)=>authorizeAction(deps.auth,deps.github,s,b,'review'),profileAccepted:b=>Promise.resolve(acceptsDemoProfile(env,b))});
 app.get('/bounties/:id/review',async(req,res)=>{try{
  const session=await pageSession(deps,req,res);if(!session)return;const p=await service.preview(session,req.params.id),path=req.path;
  const hidden=`<input type="hidden" name="csrf" value="${csrfFor(session,path)}">`;
  res.type('html').send(htmlPage('Review merged solution',`<p>PR #${String(p.candidate.prNumber)} · revision <code>${escapeHtml(p.candidate.headSha)}</code></p><p>Approval awards the <strong>full ${dollars(p.bounty.amountCents)} USD</strong>, including when the solution is partial. CI: ${escapeHtml(p.ci)}. Assessment: ${escapeHtml(p.reviewStatus)}.</p><pre>${escapeHtml(JSON.stringify(p.result??{error:p.errorCode},null,2))}</pre><form method="post" action="${path}">${hidden}<label>Recipient split <select name="recipient"><option value="">Use validated proposed split</option>${p.eligible.map(a=>`<option value="${a.ghId}">Full amount to ${escapeHtml(a.login)}</option>`).join('')}</select></label><p><label>Approval reason <textarea name="reason" required maxlength="2000"></textarea></label></p><button type="submit">Preview full award</button></form><p>Give feedback, request changes or close unmerged PRs on GitHub. To record a bounty rejection, comment <code>/bounty reject &lt;reason&gt;</code> on the PR. Payment approval is separate.</p>`));
 }catch(e){safeError(res,e,req.path);}});
 app.post('/bounties/:id/review',async(req,res)=>{try{const s=await requireSession(deps.auth,req);checkCsrf(req,env,s);const p=input(choice,req.body);const token=await service.issueApproveToken(s,req.params.id,p.reason,p.recipient||undefined);res.redirect(303,'/review/'+token);}catch(e){safeError(res,e,req.path);}});
 app.get('/review/:token',async(req,res)=>{try{const s=await pageSession(deps,req,res);if(!s)return;const p=await service.confirmation(s,req.params.token);res.type('html').send(htmlPage('Confirm full award',`<p>Submission ${escapeHtml(p.params.submissionId)} · reviewed revision <code>${escapeHtml(p.headSha)}</code></p><p>Full award: <strong>${dollars(p.bounty.amountCents)} USD</strong>.</p><ul>${p.params.allocation.map(a=>`<li>${escapeHtml(a.login)}: ${dollars(a.cents)} USD</li>`).join('')}</ul><p>Reason: ${escapeHtml(p.params.reason)}</p><p>Missing payout details keep the award reserved until the recipient connects.</p><form method="post" action="${req.path}"><input type="hidden" name="csrf" value="${csrfFor(s,req.path)}"><button type="submit">Confirm full award</button></form>`));}catch(e){safeError(res,e,req.path);}});
 app.post('/review/:token',async(req,res)=>{try{const s=await requireSession(deps.auth,req);checkCsrf(req,env,s);input(z.object({csrf:z.string()}).strict(),req.body);const award=await service.approve(s,req.params.token);res.redirect(303,'/bounties/'+award.bountyId);}catch(e){safeError(res,e,req.path);}});
 app.post('/bounties/:id/review/reject',(_req,res)=>{res.status(410).send('Submission rejection has moved to the GitHub PR. Use /bounty reject <reason> there. No decision was made.');});
}
