import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { jobs } from '../db/schema.js';
import { enqueue } from '../jobs/queue.js';
import { workSchema } from '../jobs/kinds.js';
// Explicit allowlist: never replay money, actor commands or model requests here.
const safeKinds=new Set(['sync_bounty','sync_pull_request','refresh_installation','refresh_verification_sha','reconcile_bounty']);
export function jobAttention(job:typeof jobs.$inferSelect){return {jobId:job.id,kind:job.kind,status:job.status,cause:job.lastError,actor:'Operator',retryAvailable:safeKinds.has(job.kind),nextAction:safeKinds.has(job.kind)?'Restore access, then retry the existing read/projection identity.':'Inspect the stored intent or review limit. Replacement financial operations are unavailable.'};}
export async function retrySafeJob(db:Database,id:string,maxAttempts:number){
 return db.withTransaction(async tx=>{const [job]=await tx.select().from(jobs).where(eq(jobs.id,id)).for('update');if(!job||job.status!=='failed'||!safeKinds.has(job.kind))throw new Error('Safe retry unavailable');const work=workSchema.parse({...job.payload,kind:job.kind});await enqueue(tx,{kind:work.kind,payload:job.payload,dedupeKey:'recovery:'+job.id,maxAttempts});return jobAttention(job);});
}

export async function bountyAttention(db:Database,bountyId:string){
 const {bounties,fundingAttempts,awards,payoutBatches,refundIntents}=await import('../db/schema.js');
 const [b]=await db.orm.select().from(bounties).where(eq(bounties.id,bountyId));if(!b)throw new Error('Bounty unavailable');
 const funding=await db.orm.select({intentId:fundingAttempts.id,status:fundingAttempts.status,orderId:fundingAttempts.orderId,captureId:fundingAttempts.captureId,cause:fundingAttempts.attention}).from(fundingAttempts).where(eq(fundingAttempts.bountyId,b.id));
 const payouts=await db.orm.select({intentId:payoutBatches.id,providerId:payoutBatches.providerBatchId,cause:payoutBatches.attention}).from(payoutBatches).innerJoin(awards,eq(awards.id,payoutBatches.awardId)).where(eq(awards.bountyId,b.id));
 const refunds=await db.orm.select({intentId:refundIntents.id,status:refundIntents.status,providerId:refundIntents.providerId,cause:refundIntents.attention}).from(refundIntents).where(eq(refundIntents.bountyId,b.id));
 return {bountyId:b.id,status:b.status,cause:b.attentionReason,actor:b.status==='AWAITING_CLAIM'?'Awarded contributors':'Operator',nextAction:b.status==='AWAITING_CLAIM'?'Connect the original award recipients.':'Reconcile existing provider identities; replacement payments and refunds are unavailable.',funding,payouts,refunds};
}
