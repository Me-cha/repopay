import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import type { GitHubRuntimeEnv } from '../env.js';
import type { GitHub } from './app.js';
import { currentAccess } from './permissions.js';
import { bounties,reconciliationCheckpoints } from '../db/schema.js';
import { assertLease,enqueue } from '../jobs/queue.js';
import type { LeasedJob } from '../jobs/kinds.js';
// One bounded provider page per durable job. This discovers work; selection still
// requires the existing complete, stable candidate inventory and exact evidence.
export async function reconcileBounty(db:Database,github:GitHub,env:GitHubRuntimeEnv,job:LeasedJob,bountyId:string){
 const [b]=await db.orm.select().from(bounties).where(eq(bounties.id,bountyId));if(!b)return;
 const name='github:'+b.id;
 await db.orm.insert(reconciliationCheckpoints).values({name,cursor:'1'}).onConflictDoNothing();
 const [before]=await db.orm.select().from(reconciliationCheckpoints).where(eq(reconciliationCheckpoints.name,name));if(!before)throw new Error('Checkpoint missing');
 const {repo}=await currentAccess(github,b.installationId,b.repoId);
 const page=Number(before.cursor);if(!Number.isSafeInteger(page)||page<1)throw new Error('Invalid checkpoint');
 const result=await github.pullRequestPage(b.installationId,repo,page);
 await db.withTransaction(async tx=>{
  await assertLease(tx,job);const [state]=await tx.select().from(reconciliationCheckpoints).where(eq(reconciliationCheckpoints.name,name)).for('update');if(!state||state.cursor!==before.cursor||state.generation!==before.generation)return;
  for(const pr of result.pulls)await enqueue(tx,{kind:'sync_pull_request',payload:{installationId:b.installationId,repoId:b.repoId,prNumber:pr.number},dedupeKey:`discovery:${b.id}:${String(state.generation)}:${pr.id}:${pr.head.sha}`,maxAttempts:env.RECONCILIATION_MAX_ATTEMPTS});
  await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:b.id},dedupeKey:`projection:${job.id}`,maxAttempts:env.RECONCILIATION_MAX_ATTEMPTS});
  await tx.update(reconciliationCheckpoints).set({cursor:result.hasMore?String(page+1):'1',generation:result.hasMore?state.generation:state.generation+1,updatedAt:new Date()}).where(eq(reconciliationCheckpoints.name,name));
 });
}
