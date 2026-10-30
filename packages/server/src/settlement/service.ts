import { and,eq,isNull } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { awards,bounties,payoutBatches } from '../db/schema.js';
import type { FundingEnv } from '../env.js';
import type { GitHub } from '../github/app.js';
import { createPayouts,type Payouts } from '../paypal/payouts.js';
import { createPayoutService } from './payout.js';
import { createSettlement } from './settle.js';
import { candidateScanner } from './candidates.js';

export function createPhase6(db:Database,github:GitHub,env:FundingEnv,provider:Payouts=createPayouts(env)) {
 const payouts=createPayoutService(db,env,provider);
 // No production approval bypass: Phase 5 has not supplied accepted evidence.
 const settlement=createSettlement(db,{scan:candidateScanner(db,github,env)});
 let lastTick=0;
 return {retryClaims:payouts.retryClaims,settleBounty:(id:string)=>settlement.settleBounty(id),async tick(){
  const now=Date.now();if(now-lastTick<60000/env.RECONCILIATION_RATE_PER_MIN)return;lastTick=now;
  await payouts.tick();
  const [claim]=await db.orm.select({id:awards.id,bountyId:awards.bountyId}).from(awards).leftJoin(payoutBatches,eq(payoutBatches.awardId,awards.id)).innerJoin(bounties,eq(bounties.id,awards.bountyId)).where(and(isNull(payoutBatches.id),eq(bounties.fundingHold,false))).orderBy(bounties.updatedAt,awards.id).limit(1);
  if(claim){await payouts.reserve(claim.id);await db.orm.update(bounties).set({updatedAt:new Date()}).where(eq(bounties.id,claim.bountyId));}
  // Candidate scanning is deliberately not scheduled before profile acceptance.
  // Explicit non-payment reconciliation can still demonstrate that the gate holds.
 }};
}
export type Phase6=ReturnType<typeof createPhase6>;
