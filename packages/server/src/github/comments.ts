import { awardStatusText,cancellationStatusText } from '../actions/status.js';
import { and, eq, ne, sql } from 'drizzle-orm';
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
 const [ref]=await db.orm.select({repoId:bounties.repoId,issueNumber:bounties.issueNumber}).from(bounties).where(eq(bounties.id,bountyId));if(!ref)return;
 // The badge is issue-scoped, so projections of every bounty on an issue serialize.
 await withProjectionLock(db,`issue:${ref.repoId}:${String(ref.issueNumber)}`,async()=>{
  await db.withTransaction(tx=>assertLease(tx,job));
  const [bounty]=await db.orm.select().from(bounties).where(eq(bounties.id,bountyId));if(!bounty)return;
  const {repo}=await currentAccess(github,bounty.installationId,bounty.repoId);
  const amount=`${String(Math.floor(bounty.amountCents/100))}.${String(bounty.amountCents%100).padStart(2,'0')}`;
  const marker=`<!-- gitpay:bounty:${bounty.id} -->`;
  const detail=awardStatusText(bounty.status,env.PUBLIC_URL)??(bounty.status==='CANCELLED'?(bounty.captureId?'Reviewed refund confirmed. Funding and contribution history are retained.':'Draft cancelled. No payment or refund was sent. History is retained.'):bounty.status==='OPEN'?`Draft or checkout pending. [Review funding](${new URL('/bounties/'+bounty.id+'/fund',env.PUBLIC_URL).href}) before starting a payment.\n\nAvailable: \`/bounty status\`, \`/bounty cancel\`. [Review cancellation](${new URL('/bounties/'+bounty.id+'/cancel',env.PUBLIC_URL).href}). Anyone may submit work; no assignment reserves a bounty.`:bounty.status==='FUNDED'?`Confirmed funding. The first qualifying merged PR wins under the frozen policy. Anyone may submit work; assignment reserves nothing. ${bounty.fundedTerms?.policy.fundedCancellationEnabled?'Exceptional cancellation requires independent review and notice.':'Funded cancellation is disabled in these terms.'}\n\nPolicy: ${bounty.fundedTerms?.policy.version??'stored terms'}; required CI: ${bounty.fundedTerms?.policy.ciContexts.map(c=>c.name+' (App '+c.appId+')').join(', ')??'see terms'}. [View immutable criteria and funding status](${new URL('/bounties/'+bounty.id+'/fund',env.PUBLIC_URL).href}).${bounty.fundingHold?'\n\n**Funding hold: disbursement is frozen pending reconciliation.**':''}`:'Capture pending or unknown. Do not start another payment. Draft cancellation is unavailable.');
  const reviewLink=bounty.status==='NEEDS_REVIEW'?`\n\n[Review merged submission](${new URL('/bounties/'+bounty.id+'/review',env.PUBLIC_URL).href}). Approval awards the full amount; rejection preserves contribution evidence.`:'';
  const body=`${marker}\n**GitPay · $${amount} USD · ${bounty.status}**\n\n${detail}${reviewLink}${await cancellationStatusText(db,bounty.id,env.PUBLIC_URL)}`;
  const commentId=await upsert(github,env,bounty.installationId,repo,bounty.issueNumber,marker,body);
  await db.withTransaction(async tx=>{await assertLease(tx,job);await tx.update(bounties).set({statusCommentId:commentId,repoFullName:repo.full_name,...(bounty.currentFundingAttemptId?{}:{needsAttention:false,attentionReason:null}),updatedAt:sql`now()`}).where(eq(bounties.id,bounty.id));});
  // A cancelled draft must not clear the badge of its replacement on the same issue.
  const [replacement]=bounty.status==='CANCELLED'?await db.orm.select({id:bounties.id}).from(bounties).where(and(eq(bounties.repoId,bounty.repoId),eq(bounties.issueNumber,bounty.issueNumber),ne(bounties.status,'CANCELLED'))).limit(1):[];
  // Failure is retried after reconciliation of the already-written comment.
  if(!replacement)await github.badge(bounty.installationId,repo,bounty.issueNumber,bounty.status);
 });
}
