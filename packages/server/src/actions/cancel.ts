import { eq,sql } from 'drizzle-orm';
import type { Transaction } from '../db/transaction.js';
import { bounties,bountyActivity,type Bounty } from '../db/schema.js';
import type { ActorContext } from '../domain/types.js';
import { AuthError } from '../github/oauth.js';
import { assertCancellable,assertContext,assertInstallation,lockBounty } from './guards.js';
import type { Database } from '../db/client.js';
import type { GitHub } from '../github/app.js';
import { currentAccess } from '../github/permissions.js';
import { assertLease,enqueue } from '../jobs/queue.js';
import { workFor,type LeasedJob } from '../jobs/kinds.js';
import { githubId } from '../domain/types.js';
export async function cancelCommentDraft(db:Database,github:GitHub,job:LeasedJob,bountyId:string) {
 const work=workFor(job);
 if(work.kind!=='run_command'||work.isPullRequest||work.command.kind!=='cancel')throw new AuthError(400,'Cancel an unfunded draft on its issue.');
 const {repo}=await currentAccess(github,work.installationId,work.repoId);
 if(await github.permission(work.installationId,repo,work.actorId)!=='write')throw new AuthError(403,'Current write permission is required.');
 return db.withTransaction(async tx=>{
  await assertLease(tx,job);
  const marker=`cancel-command:${job.id}`;
  const [prior]=await tx.select({bountyId:bountyActivity.bountyId}).from(bountyActivity).where(eq(bountyActivity.action,marker));
  if(prior){const previous=await lockBounty(tx,prior.bountyId);if(!previous)throw new AuthError(404);return previous;}
  const bounty=await lockBounty(tx,bountyId);
  if(!bounty||bounty.repoId!==work.repoId||bounty.installationId!==work.installationId||bounty.issueNumber!==work.issueNumber)throw new AuthError(403,'Issue scope mismatch.');
  await assertInstallation(tx,bounty);
  if(bounty.status==='CANCELLED'&&!bounty.captureId)return bounty;
  const updated=await cancelDraft(tx,{actorGhId:githubId(work.actorId),source:'github_comment',authorization:{repoId:githubId(work.repoId),action:'cancel_draft',role:'maintainer',checkedAt:new Date()}},bountyId,bounty.version);
  await tx.insert(bountyActivity).values({bountyId,actorGhId:work.actorId,source:'github_comment',action:marker});
  await enqueue(tx,{kind:'sync_bounty',payload:{bountyId},dedupeKey:`cancel-comment:${job.id}`,maxAttempts:3});
  return updated;
 });
}
// The caller owns the transaction that also consumes the confirmation token.
export async function cancelDraft(tx:Transaction,ctx:ActorContext,bountyId:string,expectedVersion:number):Promise<Bounty> {
 const bounty=await lockBounty(tx,bountyId);
 if(!bounty)throw new AuthError(404,'Bounty not found.');
 assertContext(ctx,bounty,'cancel_draft');await assertInstallation(tx,bounty);
 if(bounty.version!==expectedVersion)throw new AuthError(409,'This bounty changed. Request a fresh confirmation.');
 assertCancellable(bounty);
 const [updated]=await tx.update(bounties).set({status:'CANCELLED',version:sql`${bounties.version}+1`,updatedAt:sql`now()`}).where(eq(bounties.id,bountyId)).returning();
 if(!updated)throw new Error('Bounty disappeared');
 await tx.insert(bountyActivity).values({bountyId,actorGhId:ctx.actorGhId,source:ctx.source==='github_comment'?'github_comment':'confirm',action:'draft_cancelled',metadata:{fromStatus:'OPEN',toStatus:'CANCELLED',amountCents:bounty.amountCents}});
 return updated;
}
