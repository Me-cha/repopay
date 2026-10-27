import { eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import type { GitHub, Repository } from './app.js';
import { bounties } from '../db/schema.js';
import type { GitHubRuntimeEnv } from '../env.js';
import type { LeasedJob } from '../jobs/kinds.js';
import { assertLease } from '../jobs/queue.js';
import { currentAccess } from './permissions.js';
// A session advisory lock serializes external projection writes across workers.
// It deliberately holds no SQL transaction during GitHub requests.
export async function withProjectionLock<T>(db:Database,key:string,fn:()=>Promise<T>):Promise<T> {
 const client=await db.pool.connect();
 try {const result=await client.query<{locked:boolean}>('select pg_try_advisory_lock(hashtext($1)) as locked',[db.schemaName+':'+key]);if(!result.rows[0]?.locked)throw new Error('Projection busy');return await fn();}
 finally {try{await client.query('select pg_advisory_unlock(hashtext($1))',[db.schemaName+':'+key]);}finally{client.release();}}
}
async function upsert(github:GitHub,env:GitHubRuntimeEnv,inst:string,repo:Repository,number:number,marker:string,body:string) {
 const existing=(await github.comments(inst,repo,number)).find(c=>c.user.type==='Bot'&&c.performed_via_github_app?.id===env.GH_APP_ID&&c.body?.includes(marker));
 if(existing){await github.updateComment(inst,repo,existing.id,body);return existing.id;}
 return (await github.createComment(inst,repo,number,body)).id;
}
export async function reply(db:Database,github:GitHub,env:GitHubRuntimeEnv,job:LeasedJob,inst:string,repo:Repository,number:number,text:string) {
 return withProjectionLock(db,`reply:${job.id}`,async()=>{
  await db.withTransaction(tx=>assertLease(tx,job));
  const marker=`<!-- gitpay:reply:${job.id} -->`;await upsert(github,env,inst,repo,number,marker,marker+'\n'+text);
 });
}
export async function syncBounty(db:Database,github:GitHub,env:GitHubRuntimeEnv,job:LeasedJob,bountyId:string) {
 await withProjectionLock(db,`bounty:${bountyId}`,async()=>{
  await db.withTransaction(tx=>assertLease(tx,job));
  const [bounty]=await db.orm.select().from(bounties).where(eq(bounties.id,bountyId));if(!bounty)return;
  const {repo}=await currentAccess(github,bounty.installationId,bounty.repoId);
  const amount=`${String(Math.floor(bounty.amountCents/100))}.${String(bounty.amountCents%100).padStart(2,'0')}`;
  const marker=`<!-- gitpay:bounty:${bounty.id} -->`;
  const body=`${marker}\n**GitPay · $${amount} USD · ${bounty.status} (unfunded draft)**\n\nNo money has been collected. Funding and cancellation confirmations are not available until the next phases.\n\nAvailable: \`/bounty status\`. Anyone may submit work; no assignment reserves a bounty.`;
  const commentId=await upsert(github,env,bounty.installationId,repo,bounty.issueNumber,marker,body);
  await db.withTransaction(async tx=>{await assertLease(tx,job);await tx.update(bounties).set({statusCommentId:commentId,repoFullName:repo.full_name,needsAttention:false,attentionReason:null,updatedAt:sql`now()`}).where(eq(bounties.id,bounty.id));});
  // Failure is retried after reconciliation of the already-written comment.
  await github.badge(bounty.installationId,repo,bounty.issueNumber);
 });
}
