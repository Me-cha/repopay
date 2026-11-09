import { and,eq,isNull } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { bounties, submissions, verifications, verificationPublications } from '../db/schema.js';
import type { GitHub } from '../github/app.js';
import { currentAccess } from '../github/permissions.js';
import type { LeasedJob } from '../jobs/kinds.js';
import { assertLease } from '../jobs/queue.js';

// This worker has no model dependency. Repeating the same Check PATCH is safe,
// including when GitHub accepted it but the response or DB acknowledgement was lost.
export async function publishVerification(db:Database,github:GitHub,job:LeasedJob,verificationId:string,appId:string):Promise<void> {
 await db.withTransaction(tx=>assertLease(tx,job));
 const [row]=await db.orm.select({publication:verificationPublications,review:verifications,bounty:bounties})
  .from(verificationPublications)
  .innerJoin(verifications,eq(verifications.id,verificationPublications.verificationId))
  .innerJoin(submissions,eq(submissions.id,verifications.submissionId))
  .innerJoin(bounties,eq(bounties.id,submissions.bountyId))
  .where(eq(verificationPublications.verificationId,verificationId));
 if(!row)throw new Error('Saved review publication unavailable');
 if(row.publication.publishedAt)return;
 if(!row.review.completedAt||row.review.status==='PENDING')throw new Error('Review publication is not ready');
 const {installation,repo}=await currentAccess(github,row.bounty.installationId,row.bounty.repoId);
 const detailsUrl=`https://github.com/${repo.full_name}/issues/${String(row.bounty.issueNumber)}`;
 let checkRunId=row.review.checkRunId;
 if(!checkRunId){
  const externalId=`repopay:${row.review.submissionId}:${row.review.headSha}:${String(row.review.attempt)}`;
  const checks=await github.checkRuns(installation.id,repo,row.review.headSha);
  if(!checks.complete)throw new Error('Check recovery scan incomplete');
  const matching=checks.runs.filter(check=>check.app?.id===appId&&check.head_sha===row.review.headSha&&check.external_id===externalId);
  if(matching.length>1)throw new Error('Check identity ambiguous');
  checkRunId=matching[0]?.id??null;
  if(!checkRunId){
   const reserved=await db.withTransaction(async tx=>{
    await assertLease(tx,job);
    return tx.update(verificationPublications).set({createStartedAt:new Date()}).where(and(eq(verificationPublications.verificationId,verificationId),isNull(verificationPublications.createStartedAt))).returning();
   });
   if(!reserved.length)throw new Error('Check creation outcome unknown; reconcile before retry');
   checkRunId=await github.createCheckRun(installation.id,repo,{name:'Repopay solution review',headSha:row.review.headSha,externalId,detailsUrl,status:'completed',conclusion:'neutral',title:row.publication.title,summary:row.publication.summary});
  }
  const savedId=checkRunId;
  await db.withTransaction(async tx=>{await assertLease(tx,job);await tx.update(verifications).set({checkRunId:savedId}).where(eq(verifications.id,verificationId));});
 }
 await db.withTransaction(tx=>assertLease(tx,job));
 // Publish to this historical attempt's Check, never to the latest attempt's Check.
 await github.updateCheckRun(installation.id,repo,checkRunId,{
  detailsUrl,
  status:'completed',conclusion:'neutral',title:row.publication.title,summary:row.publication.summary,
 });
 await db.withTransaction(async tx=>{
  await assertLease(tx,job);
  await tx.update(verificationPublications).set({publishedAt:new Date()}).where(eq(verificationPublications.verificationId,verificationId));
 });
}
