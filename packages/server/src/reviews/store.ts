import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { and,eq,isNull,or,sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import type { Transaction } from '../db/transaction.js';
import { bounties,jobs,submissions,reviewControl,reviewDispatches,verifications,verificationPublications } from '../db/schema.js';
import { isSponsoredTerms } from '../domain/funded-terms.js';
import { REVIEW_UNAVAILABLE_REASON } from '../domain/types.js';
import { assertLease,enqueue } from '../jobs/queue.js';
import { workFor,type LeasedJob } from '../jobs/kinds.js';
import { artifactVersion } from './config.js';

export type Dispatch=typeof reviewDispatches.$inferSelect;
export async function controlLock(tx:Transaction){
 await tx.execute(sql`select pg_advisory_xact_lock(hashtext('repopay-review-admission'))`);
 return (await tx.select().from(reviewControl).where(eq(reviewControl.id,1)).for('update'))[0];
}
export async function configureReviews(db:Database,backend:string,generation:number){
 await db.withTransaction(async tx=>{
  const current=await controlLock(tx);
  if(current?.backend===backend&&current.generation===generation&&current.artifactVersion===artifactVersion)return;
  const active=await tx.select({id:reviewDispatches.id}).from(reviewDispatches).where(or(eq(reviewDispatches.capacityHeld,true),eq(reviewDispatches.status,'READY'))).limit(1);
  const running=await tx.select({id:jobs.id}).from(jobs).where(and(eq(jobs.kind,'verify_submission'),eq(jobs.status,'running'))).limit(1);
  if(active.length||running.length)throw new Error('Review execution has active owners; pause, drain and reconcile first');
  if(current&&generation<=current.generation)throw new Error('Backend changes require a new generation');
  await tx.insert(reviewControl).values({id:1,backend,generation,artifactVersion,paused:false}).onConflictDoUpdate({target:reviewControl.id,set:{backend,generation,artifactVersion,paused:false}});
  await tx.update(reviewDispatches).set({status:'SUPERSEDED',errorCode:'GENERATION_CHANGED',completedAt:new Date()}).where(eq(reviewDispatches.status,'READY'));
 });
}
export async function pauseReviews(db:Database){await db.withTransaction(async tx=>{
 await controlLock(tx);await tx.update(reviewControl).set({paused:true}).where(eq(reviewControl.id,1));
 // ADMITTED without a launch or owner has provably not escaped the database.
 await tx.update(reviewDispatches).set({status:'READY',capacityHeld:false}).where(sql`status='ADMITTED' and launch_started_at is null and run_id is null and owner_token is null`);
});}
export async function resumeReviews(db:Database,backend:string,generation:number){await db.withTransaction(async tx=>{
 const control=await controlLock(tx);
 if(!control||control.backend!==backend||control.generation!==generation||control.artifactVersion!==artifactVersion)throw new Error('Configured review generation mismatch');
 const active=await tx.select({id:reviewDispatches.id}).from(reviewDispatches).where(eq(reviewDispatches.capacityHeld,true)).limit(1);
 if(active.length)throw new Error('Drain and reconcile active execution before resuming');
 await tx.update(reviewControl).set({paused:false}).where(eq(reviewControl.id,1));
});}
export async function createDispatch(db:Database,job:LeasedJob,backend:'dedicated'|'render',generation:number,taskIdentifier?:string){
 const work=workFor(job);if(work.kind!=='verify_submission')throw new Error('Review job required');
 return db.withTransaction(async tx=>{
  await assertLease(tx,job);
  const [prior]=await tx.select().from(reviewDispatches).where(eq(reviewDispatches.jobId,job.id));if(prior)return prior;
  const control=await controlLock(tx);
  if(!control||control.backend!==backend||control.generation!==generation||control.paused)throw new Error('Review admission paused or incompatible');
  const [sub]=await tx.select().from(submissions).where(eq(submissions.id,work.submissionId));if(!sub)return null;
  const [bounty]=await tx.select().from(bounties).where(eq(bounties.id,sub.bountyId));
  if(!bounty||!['FUNDED','NEEDS_REVIEW'].includes(bounty.status)||bounty.fundingHold||!bounty.fundedTerms||!isSponsoredTerms(bounty.fundedTerms)||sub.headSha!==work.headSha||(work.baseSha&&sub.baseSha!==work.baseSha))return null;
  return (await tx.insert(reviewDispatches).values({id:randomUUID(),jobId:job.id,submissionId:sub.id,repoId:sub.repoId,sponsorGhId:bounty.fundedTerms.sponsor.id,headSha:sub.headSha,baseSha:sub.baseSha,forceReview:work.force??false,backend,generation,artifactVersion,taskIdentifier}).returning())[0]??null;
 });
}
export async function admitReview(db:Database):Promise<Dispatch|null>{
 return db.withTransaction(async tx=>{
  const control=await controlLock(tx);if(!control||control.paused||control.backend==='shared')return null;
  const active=await tx.select().from(reviewDispatches).where(eq(reviewDispatches.capacityHeld,true));if(active.length>=2)return null;
  const [next]=await tx.select().from(reviewDispatches).where(and(eq(reviewDispatches.status,'READY'),eq(reviewDispatches.backend,control.backend),eq(reviewDispatches.generation,control.generation),sql`not exists (select 1 from review_dispatches busy where busy.capacity_held and (busy.sponsor_gh_id=${reviewDispatches.sponsorGhId} or busy.submission_id=${reviewDispatches.submissionId}))`)).orderBy(reviewDispatches.createdAt,reviewDispatches.id).limit(1);
  if(!next)return null;
  return (await tx.update(reviewDispatches).set({status:'ADMITTED',capacityHeld:true}).where(eq(reviewDispatches.id,next.id)).returning())[0]??null;
 });
}
export async function claimReview(db:Database,id:string,runId:string,backend:string,generation:number,version:string):Promise<Dispatch|null>{
 return db.withTransaction(async tx=>{
  const control=await controlLock(tx);
  if(!control||control.paused||control.backend!==backend||control.generation!==generation||control.artifactVersion!==version)return null;
  const [row]=await tx.select().from(reviewDispatches).where(eq(reviewDispatches.id,id)).for('update');
  if(!row||!row.capacityHeld||row.backend!==backend||row.generation!==generation||row.artifactVersion!==version||!['ADMITTED','LAUNCHING','LAUNCH_UNKNOWN'].includes(row.status)||row.ownerToken||(row.runId&&row.runId!==runId))return null;
  return (await tx.update(reviewDispatches).set({runId,ownerToken:randomUUID(),status:'RUNNING_PRE_INFERENCE',heartbeatUntil:new Date(Date.now()+60000)}).where(eq(reviewDispatches.id,id)).returning())[0]??null;
 });
}
export async function assertReviewOwner(tx:Transaction,id:string,token:string,allowSaved=false){
 const control=await controlLock(tx);
 const [row]=await tx.select().from(reviewDispatches).where(eq(reviewDispatches.id,id)).for('update');
 if(!row||row.ownerToken!==token)throw new Error('Review ownership lost');
 if(allowSaved&&row.status==='RESULT_SAVED')return row;
 if(!control||control.paused||control.generation!==row.generation||control.backend!==row.backend||control.artifactVersion!==row.artifactVersion||!row.capacityHeld||!row.heartbeatUntil||row.heartbeatUntil.getTime()<=Date.now()||!['RUNNING_PRE_INFERENCE','INFERENCE_STARTED'].includes(row.status))throw new Error('Review ownership lost');
 return row;
}
export async function heartbeatReview(db:Database,id:string,token:string){
 await db.withTransaction(async tx=>{await assertReviewOwner(tx,id,token);await tx.update(reviewDispatches).set({heartbeatUntil:new Date(Date.now()+60000)}).where(eq(reviewDispatches.id,id));});
}
export async function recoverTerminatedRenderRun(db:Database,id:string,runId:string,run:{id:string;status:string;input:unknown}){
 if(run.id!==runId||!['completed','succeeded','failed','canceled'].includes(run.status))throw new Error('Terminal run evidence required');
 z.tuple([z.object({dispatchId:z.literal(id)}).strict()]).parse(run.input);
 await db.withTransaction(async tx=>{
  await controlLock(tx);const [row]=await tx.select().from(reviewDispatches).where(eq(reviewDispatches.id,id)).for('update');
  if(!row||row.backend!=='render'||row.runId||row.ownerToken||!row.capacityHeld||!['LAUNCHING','LAUNCH_UNKNOWN'].includes(row.status))throw new Error('Unclaimed unknown launch required');
  await tx.update(reviewDispatches).set({runId}).where(eq(reviewDispatches.id,id));
 });
 await terminateReview(db,id,runId);
}
// Call only after executor cleanup has completed, or authoritative provider run
// termination is observed. Lease expiry by itself is never termination evidence.
export async function terminateReview(db:Database,id:string,runId:string){
 await db.withTransaction(async tx=>{
  await controlLock(tx);
  const [row]=await tx.select().from(reviewDispatches).where(eq(reviewDispatches.id,id)).for('update');
  if(!row||row.runId!==runId)return;
  const status=['RESULT_SAVED','SUPERSEDED','FAILED_BEFORE_INFERENCE'].includes(row.status)?row.status:row.inferenceStartedAt?'OUTCOME_UNKNOWN':'FAILED_BEFORE_INFERENCE';
  if(['OUTCOME_UNKNOWN','FAILED_BEFORE_INFERENCE'].includes(status)){
   const [sub]=await tx.select().from(submissions).where(eq(submissions.id,row.submissionId));
   if(sub&&sub.headSha===row.headSha&&sub.baseSha===row.baseSha)await tx.update(bounties).set({needsAttention:true,attentionReason:REVIEW_UNAVAILABLE_REASON,updatedAt:new Date()}).where(and(eq(bounties.id,sub.bountyId),eq(bounties.fundingHold,false),or(isNull(bounties.attentionReason),eq(bounties.attentionReason,REVIEW_UNAVAILABLE_REASON))));
  }
  if(row.verificationId&&status!=='RESULT_SAVED'&&status!=='SUPERSEDED'){
   const changed=await tx.update(verifications).set({status:'ERROR',completedAt:new Date(),errorCode:status==='OUTCOME_UNKNOWN'?'INFERENCE_OUTCOME_UNKNOWN':'EXECUTOR_STOPPED'}).where(and(eq(verifications.id,row.verificationId),eq(verifications.status,'PENDING'))).returning();
   if(changed.length){
    await tx.insert(verificationPublications).values({verificationId:row.verificationId,title:'Repopay review unavailable',summary:'Review execution stopped without a saved result. No automatic model retry was made. A maintainer can request a fresh review with `/bounty retry`.'}).onConflictDoNothing();
    await enqueue(tx,{kind:'publish_verification',payload:{verificationId:row.verificationId},dedupeKey:`review-check:${row.verificationId}`,maxAttempts:5});
    await enqueue(tx,{kind:'sync_submission',payload:{submissionId:row.submissionId},dedupeKey:`review-projection:${row.verificationId}`,maxAttempts:5});
   }
  }
  await tx.update(reviewDispatches).set({status,capacityHeld:false,heartbeatUntil:null,completedAt:new Date(),errorCode:row.errorCode??(status==='OUTCOME_UNKNOWN'?'INFERENCE_OUTCOME_UNKNOWN':status==='FAILED_BEFORE_INFERENCE'?'EXECUTOR_STOPPED':null)}).where(eq(reviewDispatches.id,id));
 });
}
