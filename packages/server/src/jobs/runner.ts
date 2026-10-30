import { reconcileBounty } from '../github/reconciliation.js';
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
import { bountyStatus,awardStatusText,cancellationStatusText } from '../actions/status.js';
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
 if(work.kind==='reconcile_bounty'){await reconcileBounty(db,github,env,job,work.bountyId);return;}
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
 const commentPrNumber=work.kind==='run_command'&&work.isPullRequest?work.issueNumber:undefined;
 let issueNumber=work.issueNumber;
 if(work.kind==='run_command'&&(work.command.kind==='approve'||work.command.kind==='reject')){
  const command=work.command;let target=issueNumber;
  if(work.isPullRequest){
   const links=await db.orm.select({issue:bounties.issueNumber}).from(submissions).innerJoin(bounties,eq(bounties.id,submissions.bountyId)).where(and(eq(submissions.repoId,work.repoId),eq(submissions.prNumber,issueNumber)));
   const choices=[...new Set(links.map(r=>r.issue))];if(command.issueNumber?!choices.includes(command.issueNumber):choices.length!==1){await reply(db,github,env,job,work.installationId,repo,issueNumber,'Specify a linked issue number: `/bounty approve #12` or `/bounty reject #12 <reason>`. No decision was made.');return;}target=command.issueNumber??choices[0]??target;
  }else if(command.issueNumber&&command.issueNumber!==issueNumber)throw new AuthError(409,'Review must target this issue.');
  issueNumber=target;
 }
 await github.issue(work.installationId,repo,issueNumber);
 const permission=await github.permission(work.installationId,repo,work.actorId);
 // Private status is not disclosed to a former collaborator; comments contain no secret DTOs.
 if(permission==='none'){await reply(db,github,env,job,work.installationId,repo,issueNumber,'Current repository access is required.');return;}
 const command=work.kind==='run_command'?work.command:{kind:'create' as const,amount:work.amount};
 if(command.kind==='status') {
  const bounty=await bountyStatus(db,work.repoId,issueNumber);
  if(bounty) {
   await db.withTransaction(async tx=>{await assertLease(tx,job);if(bounty.currentFundingAttemptId)await enqueue(tx,{kind:'reconcile_funding',payload:{attemptId:bounty.currentFundingAttemptId},dedupeKey:`funding-status:${bounty.currentFundingAttemptId}:${String(Math.floor(Date.now()/(env.RECONCILIATION_INTERVAL_SEC*1000)))}`,maxAttempts:env.RECONCILIATION_MAX_ATTEMPTS});await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:bounty.id},dedupeKey:`status:${bounty.id}:${String(Math.floor(Date.now()/(env.RECONCILIATION_INTERVAL_SEC*1000)))}`,maxAttempts:env.RECONCILIATION_MAX_ATTEMPTS});});
   const amount=`${String(Math.floor(bounty.amountCents/100))}.${String(bounty.amountCents%100).padStart(2,'0')}`;
   await reply(db,github,env,job,work.installationId,repo,issueNumber,
    `**GitPay status · $${amount} USD · ${bounty.status}**\n\n${awardStatusText(bounty.status,env.PUBLIC_URL)??(bounty.status==='CANCELLED'?(bounty.captureId?'Reviewed refund confirmed. History is retained.':'Draft cancelled. No payment or refund was sent.'):bounty.status==='OPEN'?(bounty.currentFundingAttemptId?'Checkout pending. Review funding status before starting a payment.':'Unfunded draft. No money has been collected. Review funding to start checkout.'):bounty.status==='FUNDED'?(bounty.fundingHold?'Funding confirmed, but disbursement is frozen pending reconciliation.':'Funding confirmed. The first qualifying merged PR wins under the frozen terms; anyone may submit work.'):'Capture pending or unknown. Do not start another payment; draft cancellation is unavailable.')}${await cancellationStatusText(db,bounty.id,env.PUBLIC_URL)}`);
  }
  else await reply(db,github,env,job,work.installationId,repo,issueNumber,'No bounty exists for this issue. A maintainer can use `/bounty create <USD amount>`.');return;
 }
 if(permission!=='write'&&command.kind!=='link'){await reply(db,github,env,job,work.installationId,repo,issueNumber,'Creating or managing a bounty requires current write, maintain or admin permission. `/bounty status` and `/bounty link <PR number>` are available to participants.');return;}
 if(command.kind==='link') {
  const bounty=await bountyStatus(db,work.repoId,issueNumber);
  if(!bounty){await reply(db,github,env,job,work.installationId,repo,issueNumber,'Create a bounty draft before linking a solution.');return;}
  if(!phase5){await reply(db,github,env,job,work.installationId,repo,issueNumber,'Submission linking is temporarily unavailable. No bounty status or payment changed.');return;}
  await phase5.manualLink(work.installationId,work.repoId,issueNumber,command.prNumber);
  await reply(db,github,env,job,work.installationId,repo,issueNumber,`Linked PR #${String(command.prNumber)} as a submission. This does not reserve the bounty; anyone may submit a solution.`);return;
 }
 if(command.kind==='reject') {
  const bounty=await bountyStatus(db,work.repoId,issueNumber);if(!bounty||!phase6)throw new AuthError(409,'Review service unavailable.');
  // A completed decision survives projection failure; retries must not reject the next candidate.
  const marker=`review-command:${job.id}`;
  const prior=await db.orm.select({id:bountyActivity.id}).from(bountyActivity).where(and(eq(bountyActivity.bountyId,bounty.id),eq(bountyActivity.action,marker)));
  if(!prior.length)await phase6.rejectComment(work.actorId,bounty.id,command.reason,job,commentPrNumber);
  await reply(db,github,env,job,work.installationId,repo,issueNumber,'Submission rejected for award consideration. Evidence and cancellation claims remain preserved; no refund was authorized.');return;
 }
 if(command.kind==='approve') {
  const bounty=await bountyStatus(db,work.repoId,issueNumber);
  await reply(db,github,env,job,work.installationId,repo,issueNumber,bounty?.status==='NEEDS_REVIEW'?`[Review the full award and submission decision](${new URL('/bounties/'+bounty.id+'/review',env.PUBLIC_URL).href}). Sign in with current write permission. This comment cannot approve or pay a bounty.`:'A funded bounty in NEEDS_REVIEW is required. No money moved.');return;
 }
 if(command.kind==='fund') {
  const bounty=await bountyStatus(db,work.repoId,issueNumber);await reply(db,github,env,job,work.installationId,repo,issueNumber,bounty?`[Review funding and checkout status](${new URL('/bounties/'+bounty.id+'/fund',env.PUBLIC_URL).href}). Sign in, review immutable terms and confirm before checkout. This comment cannot move money.`:'Create a bounty draft first.');return;
 }
 if(command.kind==='cancel') {
  const bounty=await bountyStatus(db,work.repoId,issueNumber);
  const text=!bounty?'No bounty exists for this issue.':bounty.status==='CANCELLED'?(bounty.captureId?'This bounty has a confirmed refund. History is retained.':'This draft is already cancelled. No payment or refund was sent.'):bounty.status!=='OPEN'||bounty.captureRequestKey||bounty.captureId||bounty.fundedAt?`This bounty cannot be cancelled as an unfunded draft. ${bounty.fundedTerms?.policy.fundedCancellationEnabled?`[Request independent cancellation review](${new URL('/bounties/'+bounty.id+'/cancellation',env.PUBLIC_URL).href}). No refund is authorized by this comment.`:'Funded cancellation is disabled in these terms.'}`:`[Review draft cancellation](${new URL('/bounties/'+bounty.id+'/cancel',env.PUBLIC_URL).href}). Sign in and confirm to cancel this unfunded draft. This comment does not cancel it or move money.`;
  await reply(db,github,env,job,work.installationId,repo,issueNumber,text);return;
 }
 if(command.kind!=='create'){await reply(db,github,env,job,work.installationId,repo,issueNumber,command.kind==='invalid'?'Use `/bounty create <USD amount>`, `/bounty status`, or `/bounty cancel`.':'This action is not available yet. No money has moved. Use `/bounty status`.');return;}
 let amount:number;
 try{amount=parseUsd(command.amount,env.MAX_BOUNTY_CENTS);}catch{await reply(db,github,env,job,work.installationId,repo,issueNumber,'Invalid USD amount: use a positive amount with at most two decimals within the configured bounty limit.');return;}
 await createDraft(db,job,{installation,repo,issueNumber:issueNumber,actorId:work.actorId,amountCents:amount,source:work.kind==='run_command'?'command':'label',authorized:true},env.RECONCILIATION_MAX_ATTEMPTS);
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
  const affected=work.kind==='sync_bounty'||work.kind==='reconcile_bounty'?eq(bounties.id,work.bountyId):work.kind==='refresh_installation'?eq(bounties.installationId,work.installationId):and(eq(bounties.repoId,work.repoId),eq(bounties.issueNumber,work.issueNumber));
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
export function startWorker(db:Database,github:GitHub,env:GitHubRuntimeEnv,onError:()=>void=()=>{},funding?:FundingService,phase5?:Phase5Jobs,phase6?:Phase6,phase8?:{tick:()=>Promise<void>},scheduler?:{runReconciliation:(now:Date)=>Promise<void>}) {
 if(env.RECOVERY_MODE==='hold')return {close:()=>Promise.resolve()};
 const abort=new AbortController();const owner=randomUUID();
 const done=(async()=>{while(!abort.signal.aborted){try{for(const task of [()=>scheduler?.runReconciliation(new Date()),()=>funding?.tick(),()=>phase6?.tick(),()=>phase8?.tick()]){try{await task();}catch{onError();}}if(await runOnce(db,github,env,owner,funding,phase5,phase6))continue;}catch{onError();}await delay(env.POLL_INTERVAL_MS,undefined,{signal:abort.signal}).catch(()=>undefined);}})();
 return {async close(){abort.abort();await done;}};
}
