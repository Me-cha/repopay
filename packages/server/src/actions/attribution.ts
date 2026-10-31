import { and,eq,sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client.js';
import { awards,bounties,bountyActivity,contributorAttestations,submissions,type Submission } from '../db/schema.js';
import { AuthError,type AuthService,type Session } from '../github/oauth.js';
import type { GitHub } from '../github/app.js';
import { currentAccess } from '../github/permissions.js';
import { assertInstallation,assertSession,authorizeAction,findBounty,lockBounty } from './guards.js';
const inputSchema=z.object({headSha:z.string().regex(/^[a-f0-9]{40}$/),baseSha:z.string().regex(/^[a-f0-9]{40}$/),kind:z.enum(['claim','confirm']),claimantGhId:z.string().regex(/^[1-9]\d{0,18}$/),reason:z.string().trim().min(10).max(2000)});
export async function attributionSubmission(db:Database,id:string) {
 if(!/^[1-9]\d{0,18}$/.test(id))throw new AuthError(404,'Submission not found.');
 const [sub]=await db.orm.select().from(submissions).where(eq(submissions.id,id));if(!sub)throw new AuthError(404,'Submission not found.');return sub;
}
export async function attributionHistory(db:Database,sub:Submission) {
 return db.orm.select().from(contributorAttestations).where(and(eq(contributorAttestations.submissionId,sub.id),eq(contributorAttestations.headSha,sub.headSha),eq(contributorAttestations.baseSha,sub.baseSha))).orderBy(contributorAttestations.id);
}
export async function confirmedContributors(db:Database,sub:Submission) {
 const rows=await attributionHistory(db,sub);
 return rows.filter(r=>r.kind==='claim'&&rows.some(c=>c.kind==='confirm'&&c.claimantGhId===r.claimantGhId&&c.actorGhId!==r.claimantGhId)).map(r=>({ghId:r.claimantGhId,login:r.claimantLogin}));
}
export async function attestContribution(db:Database,auth:AuthService,github:GitHub,session:Session,id:string,raw:unknown) {
 const parsed=inputSchema.safeParse(raw);if(!parsed.success)throw new AuthError(400,'Provide the revision, contributor and a contribution reason of 10–2000 characters.');const input=parsed.data;
 const sub=await attributionSubmission(db,id),bounty=await findBounty(db,sub.bountyId);
 await authorizeAction(auth,github,session,bounty,input.kind==='confirm'?'review':'read');
 if(input.claimantGhId===bounty.createdByGhId||input.claimantGhId===sub.authorGhId||(input.kind==='claim'?session.ghId!==input.claimantGhId:session.ghId===input.claimantGhId))throw new AuthError(403,'A separate eligible contributor and maintainer must each confirm.');
 const {repo}=await currentAccess(github,bounty.installationId,bounty.repoId);
 const before=await github.pullRequest(bounty.installationId,repo,sub.prNumber);
 const commits=await github.pullRequestCommits(bounty.installationId,repo,sub.prNumber);
 const after=await github.pullRequest(bounty.installationId,repo,sub.prNumber);
 if(before.id!==sub.prId||after.id!==sub.prId||before.head.sha!==input.headSha||after.head.sha!==input.headSha||before.base.sha!==input.baseSha||after.base.sha!==input.baseSha||after.base.repo?.id!==bounty.repoId||after.state!=='open'||after.merged_at)throw new AuthError(409,'Confirm contributors on the current open PR before merging. Reload after revision changes.');
 if(!commits.complete||!commits.authors.some(a=>a.type==='User'&&a.ghId===input.claimantGhId))throw new AuthError(409,'Complete commit evidence must identify this contributor; a trailer alone is insufficient.');
 return db.withTransaction(async tx=>{
  await assertSession(tx,session,auth.clock.now());const fresh=await lockBounty(tx,bounty.id);if(!fresh)throw new AuthError(404);await assertInstallation(tx,fresh);
  const [current]=await tx.select().from(submissions).where(eq(submissions.id,id)).for('update');
  const [award]=await tx.select().from(awards).where(eq(awards.bountyId,bounty.id));
  if(award||fresh.fundingHold||!['FUNDED','NEEDS_REVIEW'].includes(fresh.status)||!current||current.status!=='OPEN'||current.headSha!==input.headSha||current.baseSha!==input.baseSha)throw new AuthError(409,'Contribution state changed or an award already exists.');
  const rows=await tx.select().from(contributorAttestations).where(and(eq(contributorAttestations.submissionId,id),eq(contributorAttestations.headSha,input.headSha),eq(contributorAttestations.baseSha,input.baseSha),eq(contributorAttestations.claimantGhId,input.claimantGhId)));
  const claim=rows.find(r=>r.kind==='claim');if(input.kind==='confirm'&&!claim)throw new AuthError(409,'The contributor must confirm first.');
  const existing=rows.find(r=>r.kind===input.kind);if(existing)return existing;
  const [saved]=await tx.insert(contributorAttestations).values({...input,submissionId:id,actorGhId:session.ghId,claimantLogin:claim?.claimantLogin??session.ghLogin}).returning();
  // Fence in-flight model results and financial approvals, without spending a model request.
  await tx.update(submissions).set({evidenceVersion:sql`${submissions.evidenceVersion}+1`}).where(eq(submissions.id,id));
  await tx.update(bounties).set({version:sql`${bounties.version}+1`,updatedAt:auth.clock.now()}).where(eq(bounties.id,bounty.id));
  await tx.insert(bountyActivity).values({bountyId:bounty.id,actorGhId:session.ghId,source:'confirmation',action:'contributor_'+input.kind,metadata:{submissionId:id,headSha:input.headSha,baseSha:input.baseSha,claimantGhId:input.claimantGhId}});
  return saved;
 });
}
