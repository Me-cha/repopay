import { and,eq,sql } from 'drizzle-orm';
import type { Transaction } from '../db/transaction.js';
import { awards,bounties,bountyActivity,reviewDecisions,submissions,type Bounty,type Submission } from '../db/schema.js';
import { AuthError } from '../github/oauth.js';
import { assertInstallation } from '../actions/guards.js';
import { candidateFingerprint,type CandidateScan } from './candidates.js';
import { enqueue } from '../jobs/queue.js';
import type { Allocation } from '../policy/allocate.js';
export async function orderedCandidates(tx:Transaction,rows:Submission[],scan:CandidateScan) {
 if(!rows.length)return [];
 const rejected=await tx.select().from(reviewDecisions).where(and(eq(reviewDecisions.kind,'reject'),eq(reviewDecisions.bountyId,rows[0]?.bountyId??'0')));
 return rows.filter(r=>r.status==='MERGED'&&r.mergedAt&&!rejected.some(d=>d.submissionId===r.id&&d.headSha===r.headSha&&d.baseSha===r.baseSha&&d.mergeSha===r.mergeSha&&d.snapshotHash===scan.evidence.get(r.id)?.snapshotHash)).sort((a,b)=>(a.mergedAt?.getTime()??0)-(b.mergedAt?.getTime()??0)||(BigInt(a.prId)<BigInt(b.prId)?-1:1));
}
// Both automatic and manual awards use this final guard under the bounty lock.
export async function commitAward(tx:Transaction,bounty:Bounty,scan:CandidateScan,candidate:Submission,evidenceId:string,verificationId:string,allocation:Allocation) {
 await assertInstallation(tx,bounty);
 const rows=await tx.select().from(submissions).where(eq(submissions.bountyId,bounty.id));
 const [existing]=await tx.select().from(awards).where(eq(awards.bountyId,bounty.id));
 const first=(await orderedCandidates(tx,rows,scan))[0],fresh=scan.evidence.get(candidate.id);
 if(existing||bounty.fundingHold||!bounty.captureId||!bounty.fundedAt||!['FUNDED','NEEDS_REVIEW'].includes(bounty.status)||!scan.complete||scan.bountyVersion!==bounty.version||candidateFingerprint(rows)!==scan.hash||first?.id!==candidate.id||!candidate.mergeSha||!candidate.mergedAt||!fresh)throw new AuthError(409,'Award state changed. Refresh the review.');
 const eligible=new Set(fresh.eligibleAuthors.filter(a=>a.ghId!==bounty.createdByGhId).map(a=>a.ghId));
 if(!allocation.length||allocation.some(a=>!eligible.has(a.ghId)||!Number.isSafeInteger(a.cents)||a.cents<=0)||new Set(allocation.map(a=>a.ghId)).size!==allocation.length||allocation.reduce((n,a)=>n+a.cents,0)!==bounty.amountCents)throw new AuthError(409,'Invalid award recipients or amount.');
 const [award]=await tx.insert(awards).values({bountyId:bounty.id,submissionId:candidate.id,evidenceId,verificationId,headSha:candidate.headSha,baseSha:candidate.baseSha,mergeSha:candidate.mergeSha,mergedAt:candidate.mergedAt,scanHash:scan.hash,amountCents:bounty.amountCents,allocation}).returning();
 if(!award)throw new Error('Award was not saved');
 await tx.update(bounties).set({status:'AWAITING_CLAIM',version:sql`${bounties.version}+1`,needsAttention:false,attentionReason:null,updatedAt:new Date()}).where(eq(bounties.id,bounty.id));
 await tx.insert(bountyActivity).values({bountyId:bounty.id,source:'policy',action:'award_committed',metadata:{awardId:award.id,submissionId:candidate.id,amountCents:award.amountCents}});
 await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:bounty.id},dedupeKey:`award:${award.id}`,maxAttempts:5});return award;
}
