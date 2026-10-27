import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import type { GitHubRuntimeEnv } from '../env.js';
import type { GitHub } from '../github/app.js';
import { currentAccess } from '../github/permissions.js';
import { parseUsd } from '../github/commands.js';
import { reply, syncBounty } from '../github/comments.js';
import { createDraft } from '../actions/create.js';
import { bountyStatus } from '../actions/status.js';
import { bounties, bountyActivity, installations } from '../db/schema.js';
import { workFor, type LeasedJob } from './kinds.js';
import { claimJob, assertLease, enqueue, finishJob, heartbeat } from './queue.js';
export async function handleJob(db:Database,github:GitHub,env:GitHubRuntimeEnv,job:LeasedJob):Promise<void> {
 const work=workFor(job);
 if(work.kind==='sync_bounty'){await syncBounty(db,github,env,job,work.bountyId);return;}
 if(work.kind==='refresh_installation') {
  const current=await github.installation(work.installationId);
  await db.withTransaction(async tx=>{
   await assertLease(tx,job);
   await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`installation:${work.installationId}`}))`);
   if(current)await tx.insert(installations).values({id:current.id,accountId:current.account.id,accountLogin:current.account.login,suspendedAt:current.suspended_at?new Date(current.suspended_at):null}).onConflictDoUpdate({target:installations.id,set:{suspendedAt:current.suspended_at?new Date(current.suspended_at):null,deletedAt:null,updatedAt:sql`now()`}});
   else await tx.update(installations).set({deletedAt:sql`now()`,updatedAt:sql`now()`}).where(eq(installations.id,work.installationId));
   const all=await tx.select().from(bounties).where(eq(bounties.installationId,work.installationId));
   for(const bounty of all) {
    const unavailable=!current||!!current.suspended_at||work.removedRepoIds.includes(bounty.repoId);
    if(unavailable){await tx.update(bounties).set({needsAttention:true,attentionReason:'App access removed; restore access and request /bounty status',version:sql`${bounties.version}+1`,updatedAt:sql`now()`}).where(eq(bounties.id,bounty.id));await tx.insert(bountyActivity).values({bountyId:bounty.id,source:'github',action:'app_access_unavailable'});}
    else await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:bounty.id},dedupeKey:`access:${job.id}:${bounty.id}`,maxAttempts:env.RECONCILIATION_MAX_ATTEMPTS});
   }
  });return;
 }
 const {installation,repo}=await currentAccess(github,work.installationId,work.repoId);
 await github.issue(work.installationId,repo,work.issueNumber);
 const permission=await github.permission(work.installationId,repo,work.actorId);
 // Private status is not disclosed to a former collaborator; comments contain no secret DTOs.
 if(permission==='none'){await reply(db,github,env,job,work.installationId,repo,work.issueNumber,'Current repository access is required.');return;}
 const command=work.kind==='run_command'?work.command:{kind:'create' as const,amount:work.amount};
 if(command.kind==='status') {
  const bounty=await bountyStatus(db,work.repoId,work.issueNumber);
  if(bounty) {
   await db.withTransaction(async tx=>{await assertLease(tx,job);await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:bounty.id},dedupeKey:`status:${job.id}`,maxAttempts:env.RECONCILIATION_MAX_ATTEMPTS});});
   const amount=`${String(Math.floor(bounty.amountCents/100))}.${String(bounty.amountCents%100).padStart(2,'0')}`;
   await reply(db,github,env,job,work.installationId,repo,work.issueNumber,
    `**GitPay status · $${amount} USD · ${bounty.status} (unfunded draft)**\n\nNo money has been collected. Funding is not available yet.`);
  }
  else await reply(db,github,env,job,work.installationId,repo,work.issueNumber,'No bounty exists for this issue. A maintainer can use `/bounty create <USD amount>`.');return;
 }
 if(permission!=='write'){await reply(db,github,env,job,work.installationId,repo,work.issueNumber,'Creating or managing a bounty requires current write, maintain or admin permission. `/bounty status` is available to participants.');return;}
 if(command.kind!=='create'){await reply(db,github,env,job,work.installationId,repo,work.issueNumber,command.kind==='invalid'?'Use `/bounty create <USD amount>` or `/bounty status`.':'This action is not available in Phase 01. No money has moved. Use `/bounty status`.');return;}
 let amount:number;
 try{amount=parseUsd(command.amount,env.MAX_BOUNTY_CENTS);}catch{await reply(db,github,env,job,work.installationId,repo,work.issueNumber,'Invalid USD amount: use a positive amount with at most two decimals within the configured bounty limit.');return;}
 await createDraft(db,job,{installation,repo,issueNumber:work.issueNumber,actorId:work.actorId,amountCents:amount,source:work.kind==='run_command'?'command':'label',authorized:true},env.RECONCILIATION_MAX_ATTEMPTS);
}
async function markAttention(db:Database,job:LeasedJob) {
 const work=workFor(job);
 await db.withTransaction(async tx=>{
  await assertLease(tx,job);
  const affected=work.kind==='sync_bounty'?eq(bounties.id,work.bountyId):work.kind==='refresh_installation'?eq(bounties.installationId,work.installationId):and(eq(bounties.repoId,work.repoId),eq(bounties.issueNumber,work.issueNumber));
  const changed=await tx.update(bounties).set({needsAttention:true,attentionReason:'GitHub synchronization failed; restore access and request /bounty status',updatedAt:sql`now()`}).where(affected).returning({id:bounties.id});
  if(changed.length)await tx.insert(bountyActivity).values(changed.map(b=>({bountyId:b.id,source:'worker',action:'github_job_failed',metadata:{jobId:job.id}})));
 });
}
export async function runOnce(db:Database,github:GitHub,env:GitHubRuntimeEnv,owner:string):Promise<boolean> {
 const job=await claimJob(db,owner,env.JOB_LEASE_SEC);if(!job)return false;
 const timer=setInterval(()=>{void heartbeat(db,job,env.JOB_LEASE_SEC).catch(()=>false);},Math.max(100,Math.floor(env.JOB_LEASE_SEC*1000/3)));
 try{await handleJob(db,github,env,job);await finishJob(db,job);}
 catch{await markAttention(db,job).catch(()=>undefined);await finishJob(db,job,true);}
 finally{clearInterval(timer);}return true;
}
export function startWorker(db:Database,github:GitHub,env:GitHubRuntimeEnv,onError:()=>void=()=>{}) {
 const abort=new AbortController();const owner=randomUUID();
 const done=(async()=>{while(!abort.signal.aborted){try{if(await runOnce(db,github,env,owner))continue;}catch{onError();}await delay(env.POLL_INTERVAL_MS,undefined,{signal:abort.signal}).catch(()=>undefined);}})();
 return {async close(){abort.abort();await done;}};
}
