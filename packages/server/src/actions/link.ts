import { and,eq,sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import type { Bounty } from '../db/schema.js';
import { bounties,submissions } from '../db/schema.js';
import type { PullRequest } from '../github/app.js';
import { AuthError } from '../github/oauth.js';

export async function linkPr(db:Database,bounty:Bounty,pr:PullRequest,now=()=>new Date()) {
 if(pr.base.repo?.id!==bounty.repoId||pr.number<1||pr.id.length<1)throw new AuthError(403,'The pull request must target the bounty repository.');
 const status=pr.merged_at?'MERGED':pr.state==='closed'?'CLOSED':'OPEN';
 return db.withTransaction(async tx=>{
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`submission:${bounty.id}:${pr.id}`}))`);
  const [current]=await tx.select().from(bounties).where(eq(bounties.id,bounty.id)).for('update');
  if(!current||current.repoId!==pr.base.repo?.id||!['OPEN','FUNDED','NEEDS_REVIEW','AWAITING_CLAIM','PAYING','PAID'].includes(current.status)||current.fundingHold)throw new AuthError(409,'This bounty is not accepting submissions.');
  const [old]=await tx.select().from(submissions).where(and(eq(submissions.bountyId,current.id),eq(submissions.prId,pr.id))).for('update');
  const changed=!old||old.headSha!==pr.head.sha||old.baseSha!==pr.base.sha||old.status!==status||old.mergeSha!==(pr.merge_commit_sha??null);
  const values={mergeSha:pr.merge_commit_sha??null,authorGhId:pr.user.id,authorLogin:pr.user.login,status,headSha:pr.head.sha,baseSha:pr.base.sha,mergedAt:pr.merged_at?new Date(pr.merged_at):null,closedAt:pr.closed_at?new Date(pr.closed_at):null,observedAt:now(),updatedAt:now()};
  const [row]=old?await tx.update(submissions).set({...values,evidenceVersion:changed?old.evidenceVersion+1:old.evidenceVersion}).where(eq(submissions.id,old.id)).returning():await tx.insert(submissions).values({bountyId:current.id,repoId:current.repoId,prId:pr.id,prNumber:pr.number,...values,evidenceVersion:1}).returning();
  if(changed)await tx.update(bounties).set({version:sql`${bounties.version}+1`,updatedAt:now()}).where(eq(bounties.id,current.id));
  if(!row)throw new Error('Submission link was not saved');return {submission:row,changed};
 });
}
