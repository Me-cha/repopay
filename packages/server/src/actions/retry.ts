import { and,eq,inArray,or,sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { awards,bountyActivity,jobs,submissions,reviewDispatches } from '../db/schema.js';
import type { GitHub } from '../github/app.js';
import { AuthError } from '../github/oauth.js';
import { currentAccess } from '../github/permissions.js';
import { assertLease,enqueue } from '../jobs/queue.js';
import { workFor,type LeasedJob } from '../jobs/kinds.js';
import { assertInstallation,findBounty,lockBounty } from './guards.js';

// The job is durable signed-comment intake. Never accept actor identity from a form.
export async function retryCommentReview(db:Database,github:GitHub,job:LeasedJob,submissionId:string) {
 const work=workFor(job);
 if(work.kind!=='run_command'||!work.isPullRequest||work.command.kind!=='retry')throw new AuthError(400,'Post `/bounty retry` on the linked PR.');
 const command=work.command;
 const [sub]=await db.orm.select().from(submissions).where(eq(submissions.id,submissionId));
 if(!sub||sub.repoId!==work.repoId||sub.prNumber!==work.issueNumber)throw new AuthError(403,'PR scope mismatch.');
 const bounty=await findBounty(db,sub.bountyId);
 if(bounty.installationId!==work.installationId)throw new AuthError(403,'Installation scope mismatch.');
 const {repo}=await currentAccess(github,work.installationId,work.repoId);
 if(await github.permission(work.installationId,repo,work.actorId)!=='write')throw new AuthError(403,'Requesting a review uses the sponsor allowance and requires current repository write permission.');
 const pr=await github.pullRequest(work.installationId,repo,sub.prNumber);
 if(pr.id!==sub.prId||pr.base.repo?.id!==sub.repoId||pr.head.sha!==sub.headSha||pr.base.sha!==sub.baseSha||(command.headSha&&command.headSha!==pr.head.sha)||(command.baseSha&&command.baseSha!==pr.base.sha))throw new AuthError(409,'The PR revision changed. Wait for the updated Repopay comment and post a new retry command.');
 if(pr.state!=='open'||pr.merged_at)throw new AuthError(409,'PR comment retries require an open, unmerged PR. Merged evidence is reconciled separately.');
 return db.withTransaction(async tx=>{
  await assertLease(tx,job);
  const fresh=await lockBounty(tx,bounty.id);if(!fresh)throw new AuthError(404);await assertInstallation(tx,fresh);
  const [current]=await tx.select().from(submissions).where(eq(submissions.id,sub.id)).for('update');
  const [award]=await tx.select({id:awards.id}).from(awards).where(eq(awards.bountyId,bounty.id));
  if(award||fresh.fundingHold||!['FUNDED','NEEDS_REVIEW'].includes(fresh.status)||!current||current.status!=='OPEN'||current.headSha!==sub.headSha||current.baseSha!==sub.baseSha)throw new AuthError(409,'Review state changed or an award already exists. No review requested.');
  const marker=`review-retry-command:${job.id}`;
  const [prior]=await tx.select({id:bountyActivity.id}).from(bountyActivity).where(eq(bountyActivity.action,marker));
  if(prior)return {queued:false,headSha:sub.headSha};
  const [active]=await tx.select({id:jobs.id}).from(jobs).where(and(eq(jobs.kind,'verify_submission'),sql`${jobs.payload}->>'submissionId'=${sub.id}`,inArray(jobs.status,['queued','running']))).limit(1);
  const [dispatch]=await tx.select({id:reviewDispatches.id}).from(reviewDispatches).where(and(eq(reviewDispatches.submissionId,sub.id),or(eq(reviewDispatches.status,'READY'),eq(reviewDispatches.capacityHeld,true)))).limit(1);
  const busy=!!active||!!dispatch;
  if(!busy)await enqueue(tx,{kind:'verify_submission',payload:{submissionId:sub.id,headSha:sub.headSha,baseSha:sub.baseSha,force:true},dedupeKey:marker,maxAttempts:1});
  await tx.insert(bountyActivity).values({bountyId:bounty.id,actorGhId:work.actorId,source:'github_comment',action:marker,metadata:{submissionId:sub.id,headSha:sub.headSha,baseSha:sub.baseSha,coalesced:busy}});
  return {queued:!busy,headSha:sub.headSha};
 });
}
