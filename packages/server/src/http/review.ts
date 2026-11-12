import {AuthError} from '../github/oauth.js';
import type { Express } from 'express';
import { z } from 'zod';
import type { FundingEnv } from '../env.js';
import { createReviewService } from '../actions/approve.js';
import { authorizeAction } from '../actions/guards.js';
import { candidateScanner } from '../settlement/candidates.js';
import { acceptsSettlementProfile } from '../settlement/profile.js';
import { verdictSchema } from '../verifier/schema.js';
import { checkCsrf,csrfFor,requireSession } from './session.js';
import { escapeHtml,htmlPage,pageSession,safeError,type AuthenticationDependencies } from './auth.js';
function input<T extends z.ZodType>(schema:T,value:unknown):z.output<T>{const parsed=schema.safeParse(value);if(!parsed.success)throw new AuthError(400,'Invalid review parameters.');return parsed.data;}
const choice=z.object({csrf:z.string(),reason:z.string().trim().min(1).max(2000),recipient:z.string().regex(/^([1-9]\d*)?$/)}).strict();
export function mountReview(app:Express,deps:AuthenticationDependencies,env:FundingEnv){
 const service=createReviewService(deps.database,env,{scan:candidateScanner(deps.database,deps.github,env),authorize:(s,b)=>authorizeAction(deps.auth,deps.github,s,b,'review'),profileAccepted:b=>Promise.resolve(acceptsSettlementProfile(env,b))});
 app.get('/bounties/:id/review',async(req,res)=>{try{
  const session=await pageSession(deps,req,res);if(!session)return;const p=await service.preview(session,req.params.id),path=req.path;
  const hidden=`<input type="hidden" name="csrf" value="${csrfFor(session,path)}">`;
  const v=verdictSchema.safeParse(p.result);
  const verdictData=v.success?v.data:null;
  const verdictChip=verdictData?`<span class="chip ${verdictData.verdict==='RESOLVES'?'chip-pass':'chip-fail'}">${escapeHtml(verdictData.verdict)} ${String(Math.round(verdictData.confidence*100))}%</span>`:`<span class="chip chip-fail">${escapeHtml(p.errorCode??'NOT REVIEWED')}</span>`;
  const ciChip=`<span class="chip ${p.ci==='pass'?'chip-pass':'chip-pending'}">CI: ${escapeHtml(p.ci)}</span>`;
  const coverageChip=verdictData&&typeof verdictData.coverage==='number'?`<span class="chip chip-info">Coverage: ${String(Math.round(verdictData.coverage*100))}%</span>`:'';
  const splitsText=verdictData&&verdictData.splits.length>0?`<div style="font-size:12px;color:#57606a;margin-top:8px"><strong>Proposed split:</strong> ${verdictData.splits.map(s=>`Contributor #${escapeHtml(s.gh_id)} (${String(Math.round(s.share*100))}%)`).join(' · ')}</div>`:'';
  const structuredEvidence=`<div style="margin:16px 0;padding:14px;background:#f8f9fa;border:1px solid #eaedf0;border-radius:6px"><div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">${verdictChip} ${ciChip} ${coverageChip}</div>${verdictData?.reasoning?`<p style="margin:4px 0;font-size:13px">${escapeHtml(verdictData.reasoning)}</p>`:''}${splitsText}</div>`;
  res.type('html').send(htmlPage('Review merged solution',`<p>PR #${String(p.candidate.prNumber)} · revision <span class="chip"><code>${escapeHtml(p.candidate.headSha.slice(0,10))}</code></span></p><p>Approval awards the <strong>full ${(p.bounty.amountCents/100).toFixed(2)} ${p.bounty.currency}</strong>, including when the solution is partial. Assessment: <span class="chip">${escapeHtml(p.reviewStatus)}</span>.</p>${structuredEvidence}<form method="post" action="${path}">${hidden}<label>Recipient split <select name="recipient"><option value="">Use validated proposed split</option>${p.eligible.map(a=>`<option value="${a.ghId}">Full amount to ${escapeHtml(a.login)}</option>`).join('')}</select></label><p><label>Approval reason <textarea name="reason" required maxlength="2000"></textarea></label></p><button type="submit">Preview full award</button></form><p class="muted">Give feedback, request changes or close unmerged PRs on GitHub. To record a bounty rejection, comment <code>/bounty reject &lt;reason&gt;</code> on the PR. Payment approval is separate.</p>`));
 }catch(e){safeError(res,e,req.path);}});
 app.post('/bounties/:id/review',async(req,res)=>{try{const s=await requireSession(deps.auth,req);checkCsrf(req,env,s);const p=input(choice,req.body);const token=await service.issueApproveToken(s,req.params.id,p.reason,p.recipient||undefined);res.redirect(303,'/review/'+token);}catch(e){safeError(res,e,req.path);}});
 app.get('/review/:token',async(req,res)=>{try{const s=await pageSession(deps,req,res);if(!s)return;const p=await service.confirmation(s,req.params.token);
  const allocGrid=`<dl class="kv-grid">${p.params.allocation.map(a=>`<dt>@${escapeHtml(a.login)}</dt><dd>${(a.cents/100).toFixed(2)} ${p.bounty.currency}</dd>`).join('')}</dl>`;
  res.type('html').send(htmlPage('Confirm full award',`<p>Submission ${escapeHtml(p.params.submissionId)} · reviewed revision <span class="chip"><code>${escapeHtml(p.headSha.slice(0,10))}</code></span></p><p>Full award: <strong>${(p.bounty.amountCents/100).toFixed(2)} ${p.bounty.currency}</strong>.</p>${allocGrid}<p><strong>Reason:</strong> ${escapeHtml(p.params.reason)}</p><p class="muted">Missing payout details keep the award reserved until the recipient connects.</p><form method="post" action="${req.path}"><input type="hidden" name="csrf" value="${csrfFor(s,req.path)}"><button type="submit">Confirm full award</button></form>`));
 }catch(e){safeError(res,e,req.path);}});
 app.post('/review/:token',async(req,res)=>{try{const s=await requireSession(deps.auth,req);checkCsrf(req,env,s);input(z.object({csrf:z.string()}).strict(),req.body);const award=await service.approve(s,req.params.token);res.redirect(303,'/bounties/'+award.bountyId);}catch(e){safeError(res,e,req.path);}});
 app.post('/bounties/:id/review/reject',(_req,res)=>{res.status(410).send('Submission rejection has moved to the GitHub PR. Use /bounty reject <reason> there. No decision was made.');});
}
