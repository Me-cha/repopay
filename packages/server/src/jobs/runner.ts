import type { Phase6 } from '../settlement/service.js';
import type { FundingService } from '../settlement/funding.js';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { and, eq, sql, isNull, or } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import type { GitHubRuntimeEnv } from '../env.js';
import type { GitHub } from '../github/app.js';
import { createLogger } from '../log.js';
import { GitHubError } from '../github/app.js';
import { AuthError } from '../github/oauth.js';
import { currentAccess } from '../github/permissions.js';
import { parseUsd } from '../github/commands.js';
import { reply, syncBounty } from '../github/comments.js';
import { createDraft } from '../actions/create.js';
import { retryClaims } from '../settlement/claims.js';
import { bountyStatus,awardStatusText } from '../actions/status.js';
import { bounties, bountyActivity, installations, submissions } from '../db/schema.js';
import { REVIEW_UNAVAILABLE_REASON } from '../domain/types.js';
import { workFor, type LeasedJob } from './kinds.js';
import { claimJob, assertLease, enqueue, finishJob, heartbeat } from './queue.js';
export interface Phase5Jobs {
 syncPullRequest:(installationId:string,repoId:string,prNumber:number)=>Promise<void>;
 refreshVerificationSha:(installationId:string,repoId:string,sha:string)=>Promise<void>;
 manualLink:(installationId:string,repoId:string,issueNumber:number,prNumber:number)=>Promise<void>;
 verifySubmission:(submissionId:string,headSha:string,force?:boolean,lease?:LeasedJob)=>Promise<void>;
}
export async function handleJob(db:Database,github:GitHub,env:GitHubRuntimeEnv,job:LeasedJob,funding?:FundingService,phase5?:Phase5Jobs,phase6?:Phase6):Promise<void> {
 const work=workFor(job);
 if(work.kind==='retry_claims'){await retryClaims(work.ghId,work.connectionVersion);await phase6?.retryClaims(work.ghId,work.connectionVersion);return;}
 if(work.kind==='sync_pull_request'){if(!phase5)throw new Error('Submission worker unavailable');await phase5.syncPullRequest(work.installationId,work.repoId,work.prNumber);return;}
 if(work.kind==='refresh_verification_sha'){if(!phase5)throw new Error('Verification worker unavailable');await phase5.refreshVerificationSha(work.installationId,work.repoId,work.sha);return;}
 if(work.kind==='verify_submission'){if(!phase5)throw new Error('Verification worker unavailable');await phase5.verifySubmission(work.submissionId,work.headSha,work.force,job);return;}
 if(work.kind==='reconcile_funding'){if(!funding)throw new Error('Funding worker unavailable');await funding.reconcile(work.attemptId);return;}
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
   await db.withTransaction(async tx=>{await assertLease(tx,job);if(bounty.currentFundingAttemptId)await enqueue(tx,{kind:'reconcile_funding',payload:{attemptId:bounty.currentFundingAttemptId},dedupeKey:`funding-status:${job.id}`,maxAttempts:env.RECONCILIATION_MAX_ATTEMPTS});await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:bounty.id},dedupeKey:`status:${job.id}`,maxAttempts:env.RECONCILIATION_MAX_ATTEMPTS});});
   const amount=`${String(Math.floor(bounty.amountCents/100))}.${String(bounty.amountCents%100).padStart(2,'0')}`;
   await reply(db,github,env,job,work.installationId,repo,work.issueNumber,
    `**GitPay status · $${amount} USD · ${bounty.status}**\n\n${awardStatusText(bounty.status,env.PUBLIC_URL)??(bounty.status==='CANCELLED'?'Draft cancelled. No payment or refund was sent.':bounty.status==='OPEN'?(bounty.currentFundingAttemptId?'Checkout pending. Review funding status before starting a payment.':'Unfunded draft. No money has been collected. Review funding to start checkout.'):bounty.status==='FUNDED'?(bounty.fundingHold?'Funding confirmed, but disbursement is frozen pending reconciliation.':'Funding confirmed. The first qualifying merged PR wins under the frozen terms; anyone may submit work.'):'Capture pending or unknown. Do not start another payment; draft cancellation is unavailable.')}`);
  }
  else await reply(db,github,env,job,work.installationId,repo,work.issueNumber,'No bounty exists for this issue. A maintainer can use `/bounty create <USD amount>`.');return;
 }
 if(permission!=='write'&&command.kind!=='link'){await reply(db,github,env,job,work.installationId,repo,work.issueNumber,'Creating or managing a bounty requires current write, maintain or admin permission. `/bounty status` and `/bounty link <PR number>` are available to participants.');return;}
 if(command.kind==='link') {
  const bounty=await bountyStatus(db,work.repoId,work.issueNumber);
  if(!bounty){await reply(db,github,env,job,work.installationId,repo,work.issueNumber,'Create a bounty draft before linking a solution.');return;}
  if(!phase5){await reply(db,github,env,job,work.installationId,repo,work.issueNumber,'Submission linking is temporarily unavailable. No bounty status or payment changed.');return;}
  await phase5.manualLink(work.installationId,work.repoId,work.issueNumber,command.prNumber);
  await reply(db,github,env,job,work.installationId,repo,work.issueNumber,`Linked PR #${String(command.prNumber)} as a submission. This does not reserve the bounty; anyone may submit a solution.`);return;
 }
 if(command.kind==='fund') {
  const bounty=await bountyStatus(db,work.repoId,work.issueNumber);await reply(db,github,env,job,work.installationId,repo,work.issueNumber,bounty?`[Review funding and checkout status](${new URL('/bounties/'+bounty.id+'/fund',env.PUBLIC_URL).href}). Sign in, review immutable terms and confirm before checkout. This comment cannot move money.`:'Create a bounty draft first.');return;
 }
 if(command.kind==='cancel') {
  const bounty=await bountyStatus(db,work.repoId,work.issueNumber);
  const text=!bounty?'No bounty exists for this issue.':bounty.status==='CANCELLED'?'This draft is already cancelled. No payment or refund was sent.':bounty.status!=='OPEN'||bounty.captureRequestKey||bounty.captureId||bounty.fundedAt?'This bounty cannot be cancelled as an unfunded draft. Funded cancellation review is not available yet.':`[Review draft cancellation](${new URL('/bounties/'+bounty.id+'/cancel',env.PUBLIC_URL).href}). Sign in and confirm to cancel this unfunded draft. This comment does not cancel it or move money.`;
  await reply(db,github,env,job,work.installationId,repo,work.issueNumber,text);return;
 }
 if(command.kind!=='create'){await reply(db,github,env,job,work.installationId,repo,work.issueNumber,command.kind==='invalid'?'Use `/bounty create <USD amount>`, `/bounty status`, or `/bounty cancel`.':'This action is not available yet. No money has moved. Use `/bounty status`.');return;}
 let amount:number;
 try{amount=parseUsd(command.amount,env.MAX_BOUNTY_CENTS);}catch{await reply(db,github,env,job,work.installationId,repo,work.issueNumber,'Invalid USD amount: use a positive amount with at most two decimals within the configured bounty limit.');return;}
 await createDraft(db,job,{installation,repo,issueNumber:work.issueNumber,actorId:work.actorId,amountCents:amount,source:work.kind==='run_command'?'command':'label',authorized:true},env.RECONCILIATION_MAX_ATTEMPTS);
}
async function markAttention(db:Database,job:LeasedJob) {
 const work=workFor(job);
 if(work.kind==='reconcile_funding'||work.kind==='retry_claims'||work.kind==='sync_pull_request'||work.kind==='refresh_verification_sha')return;
 await db.withTransaction(async tx=>{
  await assertLease(tx,job);
  if(work.kind==='verify_submission'){
   if(job.attempts<job.maxAttempts)return;
   const [submission]=await tx.select().from(submissions).where(eq(submissions.id,work.submissionId));
   if(!submission||submission.headSha!==work.headSha)return;
   const changed=await tx.update(bounties).set({needsAttention:true,attentionReason:REVIEW_UNAVAILABLE_REASON,updatedAt:sql`now()`}).where(and(eq(bounties.id,submission.bountyId),eq(bounties.fundingHold,false),or(isNull(bounties.attentionReason),eq(bounties.attentionReason,REVIEW_UNAVAILABLE_REASON)))).returning({id:bounties.id});
   const [affected]=changed;
   if(affected)await tx.insert(bountyActivity).values({bountyId:affected.id,source:'worker',action:'verification_job_failed',metadata:{jobId:job.id}});
   return;
  }
  const affected=work.kind==='sync_bounty'?eq(bounties.id,work.bountyId):work.kind==='refresh_installation'?eq(bounties.installationId,work.installationId):and(eq(bounties.repoId,work.repoId),eq(bounties.issueNumber,work.issueNumber));
  const changed=await tx.update(bounties).set({needsAttention:true,attentionReason:'GitHub synchronization failed; restore access and request /bounty status',updatedAt:sql`now()`}).where(affected).returning({id:bounties.id});
  if(changed.length)await tx.insert(bountyActivity).values(changed.map(b=>({bountyId:b.id,source:'worker',action:'github_job_failed',metadata:{jobId:job.id}})));
 });
}
export async function runOnce(db:Database,github:GitHub,env:GitHubRuntimeEnv,owner:string,funding?:FundingService,phase5?:Phase5Jobs,phase6?:Phase6):Promise<boolean> {
 const job=await claimJob(db,owner,env.JOB_LEASE_SEC);if(!job)return false;
 const timer=setInterval(()=>{void heartbeat(db,job,env.JOB_LEASE_SEC).catch(()=>false);},Math.max(100,Math.floor(env.JOB_LEASE_SEC*1000/3)));
 try{await handleJob(db,github,env,job,funding,phase5,phase6);await finishJob(db,job);}
 catch(error){createLogger(env).warn({event:'job_failed',jobId:job.id,kind:job.kind,attempt:job.attempts,maxAttempts:job.maxAttempts,failureClass:error instanceof GitHubError?'GITHUB_ACCESS_OR_PROVIDER':error instanceof AuthError?'AUTHORIZATION':'OPERATION_UNAVAILABLE',...((error instanceof GitHubError||error instanceof AuthError)?{httpStatus:error.status}:{})});await markAttention(db,job).catch(()=>undefined);await finishJob(db,job,true);}
 finally{clearInterval(timer);}return true;
}
export function startWorker(db:Database,github:GitHub,env:GitHubRuntimeEnv,onError:()=>void=()=>{},funding?:FundingService,phase5?:Phase5Jobs,phase6?:Phase6) {
 const abort=new AbortController();const owner=randomUUID();
 const done=(async()=>{while(!abort.signal.aborted){try{await funding?.tick();await phase6?.tick();if(await runOnce(db,github,env,owner,funding,phase5,phase6))continue;}catch{onError();}await delay(env.POLL_INTERVAL_MS,undefined,{signal:abort.signal}).catch(()=>undefined);}})();
 return {async close(){abort.abort();await done;}};
}
