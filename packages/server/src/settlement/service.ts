import {createCommentReview} from '../actions/reject.js';
import { and,desc,eq,isNull } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { awards,bounties,payoutBatches,submissionEvidence } from '../db/schema.js';
import type { FundingEnv } from '../env.js';
import type { GitHub } from '../github/app.js';
import { createAuth,type AuthService } from '../github/oauth.js';
import { isSponsoredTerms } from '../domain/funded-terms.js';
import { enqueue } from '../jobs/queue.js';
import { createPayouts,type Payouts } from '../paypal/payouts.js';
import { createPayoutService } from './payout.js';
import { createSettlement } from './settle.js';
import { candidateScanner } from './candidates.js';
import { acceptsDemoProfile } from './profile.js';

export function createPhase6(db:Database,github:GitHub,env:FundingEnv,provider:Payouts=createPayouts(env),auth:AuthService=createAuth(db,env)) {
 const payouts=createPayoutService(db,env,provider);
 const collect=candidateScanner(db,github,env);
 const settlement=createSettlement(db,{
  acceptedServingModels:['gpt-6-luna'],
  async scan(id){
   const scan=await collect(id);
   if(scan.complete)for(const [submissionId,input] of scan.evidence){
    const [saved]=await db.orm.select().from(submissionEvidence).where(eq(submissionEvidence.submissionId,submissionId)).orderBy(desc(submissionEvidence.version)).limit(1);
    const current=scan.submissions.find(row=>row.id===submissionId);
    if(saved?.snapshotHash!==input.snapshotHash||saved.version!==current?.evidenceVersion)await db.withTransaction(tx=>enqueue(tx,{kind:'verify_submission',payload:{submissionId,headSha:input.headSha},dedupeKey:`settlement-evidence:${submissionId}:${String(current?.evidenceVersion)}:${input.snapshotHash}`,maxAttempts:env.RECONCILIATION_MAX_ATTEMPTS}));
   }
   return scan;
  },
  async profileAccepted(bounty){
   if(!acceptsDemoProfile(env,bounty)||!bounty.fundedTerms||!isSponsoredTerms(bounty.fundedTerms))return false;
   try{
    const sponsor=await auth.getCopilotSponsor(bounty.repoId);
    if(sponsor.sponsorGhId!==bounty.fundedTerms.sponsor.id||sponsor.installationId!==bounty.installationId||sponsor.modelId!=='auto')return false;
    const owner=await auth.provider.identity(sponsor.accessToken),access=await auth.provider.repository(sponsor.accessToken,bounty.repoId);
    return owner.id===sponsor.sponsorGhId&&access.ownerId===owner.id&&access.ownerType==='User'&&access.admin===true;
   }catch{return false;}
  },
 });
 let lastTick=0,lastSettlementTick=0;
 return {rejectComment:createCommentReview(db,github,env).rejectComment,retryClaims:payouts.retryClaims,settleBounty:(id:string)=>settlement.settleBounty(id),async tick(){
  const now=Date.now();if(now-lastTick<60000/env.RECONCILIATION_RATE_PER_MIN)return;lastTick=now;
  await payouts.tick();
  const [claim]=await db.orm.select({id:awards.id,bountyId:awards.bountyId}).from(awards).leftJoin(payoutBatches,eq(payoutBatches.awardId,awards.id)).innerJoin(bounties,eq(bounties.id,awards.bountyId)).where(and(isNull(payoutBatches.id),eq(bounties.fundingHold,false))).orderBy(bounties.updatedAt,awards.id).limit(1);
  if(claim){await payouts.reserve(claim.id);await db.orm.update(bounties).set({updatedAt:new Date()}).where(eq(bounties.id,claim.bountyId));}
  const scope=env.SETTLEMENT_DEMO_SCOPE;
  if(scope&&now-lastSettlementTick>=env.RECONCILIATION_INTERVAL_SEC*1000){
   lastSettlementTick=now;
   const [bounty]=await db.orm.select().from(bounties).where(eq(bounties.id,scope.bountyId));
   const [award]=await db.orm.select({id:awards.id}).from(awards).where(eq(awards.bountyId,scope.bountyId));
   if(bounty&&!award&&!bounty.fundingHold&&['FUNDED','NEEDS_REVIEW'].includes(bounty.status)&&acceptsDemoProfile(env,bounty))await settlement.settleBounty(bounty.id);
  }
 }};
}
export type Phase6=ReturnType<typeof createPhase6>;
