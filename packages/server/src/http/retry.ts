import { and,desc,eq,max,sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Express } from 'express';
import { AuthError } from '../github/oauth.js';
import { submissions,bounties,verifications,jobs } from '../db/schema.js';
import { authorizeAction,assertSession,lockBounty } from '../actions/guards.js';
import { enqueue } from '../jobs/queue.js';
import { checkCsrf,csrfFor,requireSession } from './session.js';
import { escapeHtml,htmlPage,pageSession,safeError,type AuthenticationDependencies } from './auth.js';
const retryBody=z.object({csrf:z.string(),headSha:z.string().regex(/^[a-f0-9]{40,64}$/i),retryVersion:z.string().regex(/^(0|[1-9]\d{0,18})$/)}).strict();

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
   const [lastJob]=await deps.database.orm.select({id:max(jobs.id)}).from(jobs).where(and(eq(jobs.kind,'verify_submission'),sql`${jobs.payload}->>'submissionId'=${submission.id}`));
   response.type('html').send(htmlPage('Retry solution review',`<p>PR #${String(submission.prNumber)} at revision <code>${escapeHtml(submission.headSha)}</code>.</p><p>Latest review: ${escapeHtml(latest?.status??'not started')}${latest?.errorCode?` · ${escapeHtml(latest.errorCode)}`:''}</p><p>Retry creates a new evidence and review attempt for the current revision. It does not approve, reject, or pay a contributor.</p><form method="post" action="/submissions/${encodeURIComponent(submission.id)}/retry"><input type="hidden" name="csrf" value="${csrfFor(session,request.path)}"><input type="hidden" name="retryVersion" value="${lastJob?.id??'0'}"><input type="hidden" name="headSha" value="${escapeHtml(submission.headSha)}"><button type="submit">Retry review</button></form>`));
  }catch(error){safeError(response,error,request.path);}
 });
 app.post('/submissions/:id/retry',async(request,response)=>{
  try{
   const session=await requireSession(deps.auth,request);const body=retryBody.safeParse(request.body);if(!body.success)throw new AuthError(400,'Invalid retry request.');checkCsrf(request,deps.env,session);const {submission,bounty}=await getSubmission(request.params.id);await authorizeAction(deps.auth,deps.github,session,bounty,'fund');
   if(body.data.headSha!==submission.headSha)throw new AuthError(409,'The pull request changed. Reload the review page.');
   if(bounty.status!=='FUNDED'||bounty.fundingHold)throw new AuthError(409,'This funded review cannot be retried while funding is held.');
   await deps.database.withTransaction(async tx=>{
    const stored=await assertSession(tx,session,deps.auth.clock.now());
    const current=await lockBounty(tx,bounty.id);
    const [sub]=await tx.select().from(submissions).where(eq(submissions.id,submission.id)).for('update');
    if(stored.expiresAt<=deps.auth.clock.now()||!current||current.status!=='FUNDED'||current.fundingHold||sub?.headSha!==body.data.headSha)throw new AuthError(409,'Review state changed. Reload the page.');
    const key=`retry:${submission.id}:${submission.headSha}:job:${body.data.retryVersion}`;
    const [duplicate]=await tx.select({id:jobs.id}).from(jobs).where(eq(jobs.dedupeKey,key));if(duplicate)return;
    const [last]=await tx.select({id:max(jobs.id)}).from(jobs).where(and(eq(jobs.kind,'verify_submission'),sql`${jobs.payload}->>'submissionId'=${submission.id}`));
    if((last?.id??'0')!==body.data.retryVersion)throw new AuthError(409,'Another review was requested. Reload the page.');
    await enqueue(tx,{kind:'verify_submission',payload:{submissionId:submission.id,headSha:submission.headSha,force:true},dedupeKey:key,maxAttempts:5});
   });
   // The shared form script follows redirects with same-origin fetch. An
   // external GitHub redirect would report failure after the job was saved.
   response.redirect(303,`/submissions/${submission.id}/retry`);
  }catch(error){safeError(response,error,request.path);}
 });
}
