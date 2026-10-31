import type { Express } from 'express';
import { z } from 'zod';
import { attestContribution,attributionHistory,attributionSubmission } from '../actions/attribution.js';
import { authorizeAction,findBounty } from '../actions/guards.js';
import { AuthError } from '../github/oauth.js';
import { checkCsrf,csrfFor,requireSession } from './session.js';
import { escapeHtml,htmlPage,pageSession,safeError,type AuthenticationDependencies } from './auth.js';
export function mountAttribution(app:Express,deps:AuthenticationDependencies) {
 app.get('/submissions/:id/contributors',async(req,res)=>{try{
  const session=await pageSession(deps,req,res);if(!session)return;
  const sub=await attributionSubmission(deps.database,req.params.id),bounty=await findBounty(deps.database,sub.bountyId);await authorizeAction(deps.auth,deps.github,session,bounty,'read');
  const rows=await attributionHistory(deps.database,sub),path=req.path;
  let maintainer=false;try{await authorizeAction(deps.auth,deps.github,session,bounty,'review');maintainer=true;}catch(error){if(!(error instanceof AuthError)||error.status!==403)throw error;}
  const fields=`<input type="hidden" name="csrf" value="${csrfFor(session,path)}"><input type="hidden" name="headSha" value="${escapeHtml(sub.headSha)}"><input type="hidden" name="baseSha" value="${escapeHtml(sub.baseSha)}">`;
  const form=(kind:string,id:string,label:string)=>`<form method="post" action="${escapeHtml(path)}">${fields}<input type="hidden" name="kind" value="${kind}"><input type="hidden" name="claimantGhId" value="${escapeHtml(id)}"><label>Describe the contribution and evidence <textarea name="reason" minlength="10" maxlength="2000" required></textarea></label><p><button type="submit">${escapeHtml(label)}</button></p></form>`;
  const claims=rows.filter(r=>r.kind==='claim').map(r=>`<li>${escapeHtml(r.claimantLogin)}: ${escapeHtml(r.reason)} — ${rows.some(c=>c.kind==='confirm'&&c.claimantGhId===r.claimantGhId)?'maintainer confirmed':maintainer&&r.claimantGhId!==session.ghId?form('confirm',r.claimantGhId,'Confirm this contribution'):'awaiting maintainer confirmation'}</li>`).join('');
  const canClaim=session.ghId!==bounty.createdByGhId&&session.ghId!==sub.authorGhId&&!rows.some(r=>r.kind==='claim'&&r.claimantGhId===session.ghId);
  res.type('html').send(htmlPage('Confirm PR contributors',`<p>PR #${String(sub.prNumber)} · head <code>${escapeHtml(sub.headSha)}</code> · base <code>${escapeHtml(sub.baseSha)}</code>.</p><p>The PR author is already identified by GitHub. Additional commit authors must sign in and describe their contribution; a different maintainer must confirm it. Both confirmations expire for payout eligibility when the head or base changes. These are recorded human attestations, not cryptographic proof of authorship.</p><p>Confirm before merging. This does not reserve a bounty, approve a solution, request a model review or send money. A fresh review is required after confirmation.</p><ul>${claims||'<li>No additional contributors confirmed for this revision.</li>'}</ul>${canClaim?form('claim',session.ghId,'Confirm my contribution'):''}`));
 }catch(error){safeError(res,error,req.path);}});
 app.post('/submissions/:id/contributors',async(req,res)=>{try{
  const session=await requireSession(deps.auth,req);checkCsrf(req,deps.env,session);
  const parsed=z.object({csrf:z.string(),headSha:z.string(),baseSha:z.string(),kind:z.string(),claimantGhId:z.string(),reason:z.string()}).strict().safeParse(req.body);if(!parsed.success)throw new AuthError(400,'Invalid contribution confirmation.');
  await attestContribution(deps.database,deps.auth,deps.github,session,req.params.id,parsed.data);res.redirect(303,req.path);
 }catch(error){safeError(res,error,req.path);}});
}
