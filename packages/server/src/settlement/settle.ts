import { createHash } from 'node:crypto';
import { buildVerifierPrompt,PROMPT_VERSION } from '../verifier/prompt.js';
import { and,desc,eq,sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { awards,bounties,bountyActivity,copilotSponsors,submissions,submissionEvidence,verifications,type Bounty } from '../db/schema.js';
import { enqueue } from '../jobs/queue.js';
import { lockBounty,assertInstallation } from '../actions/guards.js';
import { decide } from '../policy/decide.js';
import { verdictSchema } from '../verifier/schema.js';
import { isSponsoredTerms } from '../domain/funded-terms.js';
import { candidateFingerprint,type CandidateScan } from './candidates.js';

export interface SettlementDependencies {
 scan:(bountyId:string)=>Promise<CandidateScan>;
 // Trusted server policy only. Default closed until live evaluation acceptance
 // is established for the funded profile; never accept this from an HTTP body.
 profileAccepted?:(bounty:Bounty)=>Promise<boolean>;
 acceptedServingModels?:readonly string[];
}
export function createSettlement(db:Database,deps:SettlementDependencies) {
 return {async settleBounty(bountyId:string){
  const scan=await deps.scan(bountyId);
  const [before]=await db.orm.select().from(bounties).where(eq(bounties.id,bountyId));if(!before)return;
  const accepted=await deps.profileAccepted?.(before)??false;
  return db.withTransaction(async tx=>{
   const bounty=await lockBounty(tx,bountyId);if(!bounty)return;
   await assertInstallation(tx,bounty);
   const hold=async(reason:string)=>{await tx.update(bounties).set({needsAttention:true,attentionReason:reason,updatedAt:new Date()}).where(eq(bounties.id,bountyId));return {kind:'held' as const,reason};};
   const [savedAward]=await tx.select().from(awards).where(eq(awards.bountyId,bountyId));
   if(savedAward&&(!scan.complete||scan.bountyVersion!==bounty.version))return {kind:'awarded' as const,award:savedAward};
   if(bounty.fundingHold)return hold('Funding hold; award selection paused');
   if(!scan.complete)return hold('Candidate scan incomplete; no award selected');
   const rows=await tx.select().from(submissions).where(eq(submissions.bountyId,bountyId));
   if(scan.bountyVersion!==bounty.version||candidateFingerprint(rows)!==scan.hash)return hold('Candidate evidence changed; reconcile again');
   const merged=rows.filter(r=>r.status==='MERGED'&&r.mergedAt).sort((a,b)=>(a.mergedAt?.getTime()??0)-(b.mergedAt?.getTime()??0)||(BigInt(a.prId)<BigInt(b.prId)?-1:1));
   const existing=savedAward;
   if(existing){const winner=merged[0];if(winner&&winner.id!==existing.submissionId&&((winner.mergedAt?.getTime()??Infinity)<existing.mergedAt.getTime()||((winner.mergedAt?.getTime()??Infinity)===existing.mergedAt.getTime()&&BigInt(winner.prId)<BigInt(rows.find(r=>r.id===existing.submissionId)?.prId??winner.prId))))await hold('Earlier merged candidate discovered after award; independent investigation required');return {kind:'awarded' as const,award:existing};}
   if(!['FUNDED','NEEDS_REVIEW'].includes(bounty.status)||!bounty.captureId||!bounty.fundedAt)return hold('Confirmed captured funding required');
   const terms=bounty.fundedTerms;if(!terms||!isSponsoredTerms(terms))return hold('Unsupported funded verifier profile');
   if(!accepted||bounty.version!==before.version)return hold('Live verifier profile acceptance required before automatic award');
   const [sponsor]=await tx.select().from(copilotSponsors).where(eq(copilotSponsors.repoId,bounty.repoId)).for('share');
   if(!sponsor||sponsor.revokedAt||sponsor.sponsorGhId!==terms.sponsor.id||sponsor.installationId!==bounty.installationId||sponsor.modelId!==terms.policy.model||sponsor.accessExpiresAt<=new Date())return hold('Current repository sponsor required before automatic award');
   const candidate=merged[0];if(!candidate)return {kind:'waiting' as const};
   const fresh=scan.evidence.get(candidate.id);
   const [evidence]=await tx.select().from(submissionEvidence).where(eq(submissionEvidence.submissionId,candidate.id)).orderBy(desc(submissionEvidence.version)).limit(1);
   const [review]=await tx.select().from(verifications).where(eq(verifications.submissionId,candidate.id)).orderBy(desc(verifications.id)).limit(1);
   if(!fresh||!candidate.mergeSha||!candidate.mergedAt||!evidence||!review||review.status!=='DONE'||review.evidenceId!==evidence.id||review.headSha!==candidate.headSha||evidence.version!==candidate.evidenceVersion||evidence.snapshotHash!==fresh.snapshotHash||review.sponsorGhId!==terms.sponsor.id||review.sdkVersion!==terms.policy.sdkVersion||review.promptHash!==createHash('sha256').update(PROMPT_VERSION+'\n'+buildVerifierPrompt(fresh)).digest('hex')||review.provider!=='copilot'||(terms.policy.model!=='auto'&&review.model!==terms.policy.model)||review.model==='auto')return hold('Earliest merged submission needs current verified evidence');
   if(deps.acceptedServingModels&&!deps.acceptedServingModels.includes(review.model))return hold('Serving model has no accepted evaluation for this settlement scope');
   const verdict=verdictSchema.safeParse(review.result);if(!verdict.success)return hold('Earliest merged submission has invalid review output');
   const decision=decide({bountyCents:bounty.amountCents,verdict:verdict.data,ci:fresh.ci.status,eligible:new Map(fresh.eligibleAuthors.filter(a=>a.ghId!==bounty.createdByGhId).map(a=>[a.ghId,a.login])),evidence:{truncated:fresh.truncated,sufficient:fresh.sufficient,stale:fresh.headSha!==candidate.headSha||fresh.baseSha!==candidate.baseSha||fresh.ci.testedSha!==candidate.headSha},cfg:terms.policy});
   if(decision.kind==='review'){await tx.update(bounties).set({status:'NEEDS_REVIEW'}).where(eq(bounties.id,bountyId));return hold(decision.reason);}
   const [award]=await tx.insert(awards).values({bountyId,submissionId:candidate.id,evidenceId:evidence.id,verificationId:review.id,headSha:candidate.headSha,baseSha:candidate.baseSha,mergeSha:candidate.mergeSha,mergedAt:candidate.mergedAt,scanHash:scan.hash,amountCents:bounty.amountCents,allocation:decision.allocation}).returning();
   if(!award)throw new Error('Award was not saved');
   await tx.update(bounties).set({status:'AWAITING_CLAIM',version:sql`${bounties.version}+1`,needsAttention:false,attentionReason:null,updatedAt:new Date()}).where(and(eq(bounties.id,bountyId),eq(bounties.version,bounty.version)));
   await tx.insert(bountyActivity).values({bountyId,source:'policy',action:'award_committed',metadata:{awardId:award.id,submissionId:candidate.id,amountCents:award.amountCents}});
   await enqueue(tx,{kind:'sync_bounty',payload:{bountyId},dedupeKey:`award:${award.id}`,maxAttempts:5});
   return {kind:'awarded' as const,award};
  });
 }};
}
