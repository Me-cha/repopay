import { and,desc,eq,max } from 'drizzle-orm';
import { z } from 'zod';
import type { Express } from 'express';
import { AuthError } from '../github/oauth.js';
import { submissions,bounties,verifications } from '../db/schema.js';
import { authorizeAction } from '../actions/guards.js';
import { enqueue } from '../jobs/queue.js';
import { checkCsrf,csrfFor,requireSession } from './session.js';
import { escapeHtml,htmlPage,pageSession,safeError,type AuthenticationDependencies } from './auth.js';
const retryBody=z.object({csrf:z.string(),headSha:z.string().regex(/^[a-f0-9]{40,64}$/i)}).strict();

export function mountVerificationRetry(app:Express,deps:AuthenticationDependencies) {
 const getSubmission=async(id:string)=>{
  if(!/^[1-9]\d{0,18}$/.test(id))throw new AuthError(404,'Submission not found.');
  const [submission]=await deps.database.orm.select().from(submissions).where(eq(submissions.id,id));if(!submission)throw new AuthError(404,'Submission not found.');
  const [bounty]=await deps.database.orm.select().from(bounties).where(eq(bounties.id,submission.bountyId));if(!bounty)throw new AuthError(404,'Submission not found.');return {submission,bounty};
 };
 app.get('/submissions/:id/retry',async(request,response)=>{
  try{
   const session=await pageSession(deps,request,response);if(!session)return;const {submission,bounty}=await getSubmission(request.params.id);await authorizeAction(deps.auth,deps.github,session,bounty,'fund');
   const [latest]=await deps.database.orm.select().from(verifications).where(eq(verifications.submissionId,submission.id)).orderBy(desc(verifications.createdAt)).limit(1);
   if(bounty.status!=='FUNDED'||bounty.fundingHold)throw new AuthError(409,'This funded review cannot be retried while funding is held.');
   response.type('html').send(htmlPage('Retry solution review',`<p>PR #${String(submission.prNumber)} at revision <code>${escapeHtml(submission.headSha)}</code>.</p><p>Latest review: ${escapeHtml(latest?.status??'not started')}${latest?.errorCode?` · ${escapeHtml(latest.errorCode)}`:''}</p><p>Retry creates a new evidence and review attempt for the current revision. It does not approve, reject, or pay a contributor.</p><form method="post" action="/submissions/${encodeURIComponent(submission.id)}/retry"><input type="hidden" name="csrf" value="${csrfFor(session,request.path)}"><input type="hidden" name="headSha" value="${escapeHtml(submission.headSha)}"><button type="submit">Retry review</button></form>`));
  }catch(error){safeError(response,error,request.path);}
 });
 app.post('/submissions/:id/retry',async(request,response)=>{
  try{
   const session=await requireSession(deps.auth,request);const body=retryBody.safeParse(request.body);if(!body.success)throw new AuthError(400,'Invalid retry request.');checkCsrf(request,deps.env,session);const {submission,bounty}=await getSubmission(request.params.id);await authorizeAction(deps.auth,deps.github,session,bounty,'fund');
   if(body.data.headSha!==submission.headSha)throw new AuthError(409,'The pull request changed. Reload the review page.');
   if(bounty.status!=='FUNDED'||bounty.fundingHold)throw new AuthError(409,'This funded review cannot be retried while funding is held.');
   await deps.database.withTransaction(async tx=>{
    const [latest]=await tx.select({attempt:max(verifications.attempt)}).from(verifications).where(and(eq(verifications.submissionId,submission.id),eq(verifications.headSha,submission.headSha)));
    const next=(latest?.attempt??0)+1;
    await enqueue(tx,{kind:'verify_submission',payload:{submissionId:submission.id,headSha:submission.headSha,force:true},dedupeKey:`retry:${submission.id}:${submission.headSha}:${String(next)}`,maxAttempts:5});
   });
   response.redirect(303,`https://github.com/${bounty.repoFullName}/issues/${String(bounty.issueNumber)}`);
  }catch(error){safeError(response,error,request.path);}
 });
}
