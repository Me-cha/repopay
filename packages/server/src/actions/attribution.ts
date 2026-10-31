import { and,eq,sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Transaction } from '../db/transaction.js';
import { assertLease,enqueue } from '../jobs/queue.js';
import { workFor,type LeasedJob } from '../jobs/kinds.js';
import type { Bounty } from '../db/schema.js';
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
 return saveAttestation(db,github,session,id,raw,{now:()=>auth.clock.now(),source:'confirmation',authorize:(bounty,kind)=>authorizeAction(auth,github,session,bounty,kind==='confirm'?'review':'read').then(()=>undefined),guard:tx=>assertSession(tx,session,auth.clock.now())});
}
// Called only for durable work originating from signed issue_comment intake.
export async function attestCommentContribution(db:Database,github:GitHub,job:LeasedJob,id:string) {
 const work=workFor(job);
 if(work.kind!=='run_command'||!work.isPullRequest||!['contribute','confirm-contributor'].includes(work.command.kind))throw new AuthError(400,'Use contribution commands on the linked PR.');
 const command=work.command;
 if(command.kind!=='contribute'&&command.kind!=='confirm-contributor')throw new AuthError(400);
 const sub=await attributionSubmission(db,id),bounty=await findBounty(db,sub.bountyId);
 if(sub.repoId!==work.repoId||sub.prNumber!==work.issueNumber||bounty.installationId!==work.installationId)throw new AuthError(403,'PR scope mismatch.');
 const {repo}=await currentAccess(github,work.installationId,work.repoId);
 const commits=await github.pullRequestCommits(work.installationId,repo,sub.prNumber);
 if(!commits.complete)throw new AuthError(409,'Complete commit evidence is required.');
 const author=commits.authors.find(a=>a.type==='User'&&(command.kind==='contribute'?a.ghId===work.actorId:a.login.toLowerCase()===command.login.toLowerCase()));
 if(!author)throw new AuthError(409,'The contributor must be identified in this PR’s commit evidence.');
 const kind=command.kind==='contribute'?'claim':'confirm';
 return saveAttestation(db,github,{ghId:work.actorId,ghLogin:author.login},id,{headSha:command.headSha,baseSha:command.baseSha,kind,claimantGhId:author.ghId,reason:command.reason},{now:()=>new Date(),source:'github_comment',guard:tx=>assertLease(tx,job),authorize:async()=>{
  const permission=await github.permission(work.installationId,repo,work.actorId);
  if(permission==='none'||(kind==='confirm'&&permission!=='write'))throw new AuthError(403,'Current repository permission is required; maintainer confirmation requires write access.');
 }});
}
async function saveAttestation(db:Database,github:GitHub,actor:{ghId:string;ghLogin:string},id:string,raw:unknown,access:{now:()=>Date;source:string;authorize:(bounty:Bounty,kind:'claim'|'confirm')=>Promise<void>;guard:(tx:Transaction)=>Promise<unknown>}) {
 const parsed=inputSchema.safeParse(raw);if(!parsed.success)throw new AuthError(400,'Provide the revision, contributor and a contribution reason of 10–2000 characters.');const input=parsed.data;
 const sub=await attributionSubmission(db,id),bounty=await findBounty(db,sub.bountyId);
 await access.authorize(bounty,input.kind);
 if(input.claimantGhId===bounty.createdByGhId||input.claimantGhId===sub.authorGhId||(input.kind==='claim'?actor.ghId!==input.claimantGhId:actor.ghId===input.claimantGhId))throw new AuthError(403,'A separate eligible contributor and maintainer must each confirm.');
 const {repo}=await currentAccess(github,bounty.installationId,bounty.repoId);
 const before=await github.pullRequest(bounty.installationId,repo,sub.prNumber);
 const commits=await github.pullRequestCommits(bounty.installationId,repo,sub.prNumber);
 const after=await github.pullRequest(bounty.installationId,repo,sub.prNumber);
 if(before.id!==sub.prId||after.id!==sub.prId||before.head.sha!==input.headSha||after.head.sha!==input.headSha||before.base.sha!==input.baseSha||after.base.sha!==input.baseSha||after.base.repo?.id!==bounty.repoId||after.state!=='open'||after.merged_at)throw new AuthError(409,'Confirm contributors on the current open PR before merging. Reload after revision changes.');
 if(!commits.complete||!commits.authors.some(a=>a.type==='User'&&a.ghId===input.claimantGhId))throw new AuthError(409,'Complete commit evidence must identify this contributor; a trailer alone is insufficient.');
 return db.withTransaction(async tx=>{
  await access.guard(tx);const fresh=await lockBounty(tx,bounty.id);if(!fresh)throw new AuthError(404);await assertInstallation(tx,fresh);
  const [current]=await tx.select().from(submissions).where(eq(submissions.id,id)).for('update');
  const [award]=await tx.select().from(awards).where(eq(awards.bountyId,bounty.id));
  if(award||fresh.fundingHold||!['FUNDED','NEEDS_REVIEW'].includes(fresh.status)||!current||current.status!=='OPEN'||current.headSha!==input.headSha||current.baseSha!==input.baseSha)throw new AuthError(409,'Contribution state changed or an award already exists.');
  const rows=await tx.select().from(contributorAttestations).where(and(eq(contributorAttestations.submissionId,id),eq(contributorAttestations.headSha,input.headSha),eq(contributorAttestations.baseSha,input.baseSha),eq(contributorAttestations.claimantGhId,input.claimantGhId)));
  const claim=rows.find(r=>r.kind==='claim');if(input.kind==='confirm'&&!claim)throw new AuthError(409,'The contributor must confirm first.');
  const existing=rows.find(r=>r.kind===input.kind);if(existing)return existing;
  const [saved]=await tx.insert(contributorAttestations).values({...input,submissionId:id,actorGhId:actor.ghId,claimantLogin:claim?.claimantLogin??actor.ghLogin}).returning();
  // Fence in-flight model results and financial approvals, without spending a model request.
  await tx.update(submissions).set({evidenceVersion:sql`${submissions.evidenceVersion}+1`}).where(eq(submissions.id,id));
  await tx.update(bounties).set({version:sql`${bounties.version}+1`,updatedAt:access.now()}).where(eq(bounties.id,bounty.id));
  await tx.insert(bountyActivity).values({bountyId:bounty.id,actorGhId:actor.ghId,source:access.source,action:'contributor_'+input.kind,metadata:{submissionId:id,headSha:input.headSha,baseSha:input.baseSha,claimantGhId:input.claimantGhId}});
  if(saved)await enqueue(tx,{kind:'sync_submission',payload:{submissionId:id},dedupeKey:`attribution-projection:${saved.id}`,maxAttempts:3});
  return saved;
 });
}
