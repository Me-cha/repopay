import { eq,gt } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import type { FundingEnv } from '../env.js';
import { bounties,reconciliationCheckpoints } from '../db/schema.js';
import { enqueue } from './queue.js';
// This checkpoint is a scheduling cursor, never evidence that GitHub has no PRs.
export function createScheduler(db:Database,env:FundingEnv){
 async function runReconciliation(now:Date):Promise<void>{await db.withTransaction(async tx=>{
  await tx.insert(reconciliationCheckpoints).values({name:'bounties',nextRunAt:now}).onConflictDoNothing();
  const [state]=await tx.select().from(reconciliationCheckpoints).where(eq(reconciliationCheckpoints.name,'bounties')).for('update');if(!state||state.nextRunAt>now)return;
  const limit=Math.min(env.RECONCILIATION_PAGE_LIMIT,env.RECONCILIATION_RATE_PER_MIN);
  const rows=await tx.select({id:bounties.id}).from(bounties).where(gt(bounties.id,state.cursor)).orderBy(bounties.id).limit(limit);
  for(const row of rows)await enqueue(tx,{kind:'reconcile_bounty',payload:{bountyId:row.id},dedupeKey:`reconcile:${String(state.generation)}:${row.id}`,maxAttempts:env.RECONCILIATION_MAX_ATTEMPTS});
  await tx.update(reconciliationCheckpoints).set({cursor:rows.at(-1)?.id??'0',generation:rows.length?state.generation:state.generation+1,nextRunAt:new Date(now.getTime()+Math.max(env.RECONCILIATION_INTERVAL_SEC*1000,rows.length*60000/env.RECONCILIATION_RATE_PER_MIN)),updatedAt:now}).where(eq(reconciliationCheckpoints.name,state.name));
 });}
 return {runReconciliation};
}
