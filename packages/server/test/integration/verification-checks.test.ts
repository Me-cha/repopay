import { afterEach,describe,expect,it,vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { githubFixture,testEnv } from '../helpers/github.js';
import { bounties,installations,submissions,bountyActivity,verifications } from '../../src/db/schema.js';
import { runOnce } from '../../src/jobs/runner.js';
import { enqueue } from '../../src/jobs/queue.js';
import { required } from '../helpers/auth.js';
import { intentFixture } from '../helpers/funding.js';
import { linkPr } from '../../src/actions/link.js';
import { createPhase5 } from '../../src/verifier/service.js';
import type { PullRequest } from '../../src/github/app.js';

describe('verification job recovery',()=>{
 let f:Awaited<ReturnType<typeof githubFixture>>|undefined;
 afterEach(async()=>{await f?.close();f=undefined;});

 it('records attention when a verifier job exhausts without inventing a verdict or award',async()=>{
  f=await githubFixture();
  const fixture=required(f);
  await fixture.database.orm.insert(installations).values({id:'1',accountId:'10',accountLogin:'owner'});
  const bounty=required((await fixture.database.orm.insert(bounties).values({installationId:'1',repoId:'2',repoFullName:'owner/repo',issueNumber:12,amountCents:5000,createdByGhId:'4',createdVia:'command'}).returning())[0]);
  const submission=required((await fixture.database.orm.insert(submissions).values({bountyId:bounty.id,repoId:'2',prId:'501',prNumber:41,authorGhId:'8',authorLogin:'contributor',headSha:'a'.repeat(40),baseSha:'b'.repeat(40)}).returning())[0]);
  await fixture.database.withTransaction(tx=>enqueue(tx,{kind:'verify_submission',payload:{submissionId:submission.id,headSha:submission.headSha},dedupeKey:'test:verify-failure',maxAttempts:1}));
  const phase5={syncPullRequest:vi.fn(),refreshVerificationSha:vi.fn(),manualLink:vi.fn(),verifySubmission:vi.fn(()=>Promise.reject(new Error('provider details must not reach activity logs')))};

  await runOnce(fixture.database,fixture.api,testEnv,'test-worker',undefined,phase5);

  const [after]=await fixture.database.orm.select().from(bounties).where(eq(bounties.id,bounty.id));
  const activities=await fixture.database.orm.select().from(bountyActivity);
  expect(after?.needsAttention).toBe(true);
  expect(after?.attentionReason).toMatch(/review service unavailable/);
  expect(after?.status).toBe('OPEN');
  expect(activities.map(item=>item.action)).toContain('verification_job_failed');
  expect(activities.some(item=>item.action==='verification_job_failed'&&typeof item.metadata.jobId==='string')).toBe(true);
  expect(fixture.api.createCheckRun).not.toHaveBeenCalled();
 });

 it('publishes a neutral advisory check, deduplicates completed evidence, and retries as a new attempt',async()=>{
  const funding=await intentFixture();
  try {
   const [storedBounty]=await funding.database.orm.update(bounties).set({status:'FUNDED',fundedTerms:funding.terms}).where(eq(bounties.id,funding.bounty.id)).returning();
   const bounty=required(storedBounty);
   const pr:PullRequest={id:'501',number:42,state:'open',draft:false,title:'Fix parser',body:'Fixes #12',merged_at:null,closed_at:null,user:{id:'8',login:'contributor',type:'User'},head:{sha:'a'.repeat(40)},base:{sha:'b'.repeat(40),repo:{id:'2'}}};
   const linked=await linkPr(funding.database,bounty,pr);
   vi.mocked(funding.api.pullRequest).mockResolvedValue(pr);
   vi.mocked(funding.api.pullRequestFiles).mockResolvedValue({files:[{filename:'src/parser.ts',status:'modified',additions:1,deletions:0,patch:'@@ -1 +1 @@\n+throw new Error(\'invalid\')'}],complete:true});
   vi.mocked(funding.api.pullRequestCommits).mockResolvedValue({authors:[{ghId:'8',login:'contributor',type:'User'}],complete:true});
   vi.mocked(funding.api.checkRuns).mockResolvedValue({runs:[{id:'11',name:'test',head_sha:pr.head.sha,status:'completed',conclusion:'success',app:{id:'15368'}}],complete:true});
   const verifier=vi.fn(()=>Promise.resolve({value:{verdict:'RESOLVES' as const,coverage:1,confidence:0.95,reasoning:'Adds the required input guard.',unmet_requirements:[],splits:[{gh_id:'8',share:1,why:'PR author'}]},usage:{totalNanoAiu:500,totalPremiumRequestCost:0.1,totalApiDurationMs:42,totalUserRequests:1,inputTokens:10,outputTokens:12,cacheReadTokens:0,cacheWriteTokens:0},provider:'copilot' as const,requestedModel:'auto',model:'test-model',sdkVersion:'1.0.28',billingOwnerId:'4',elapsedMs:42,promptHash:'f'.repeat(64),promptVersion:'gitpay-verifier-v1'}));
   const service=createPhase5(funding.database,funding.api,{...funding.env,VERIFIER_MAX_ATTEMPTS_PER_SHA:2},funding.auth,verifier);

   await service.verifySubmission(linked.submission.id,pr.head.sha);
   await service.verifySubmission(linked.submission.id,pr.head.sha);
   expect(verifier).toHaveBeenCalledTimes(1);
   expect(funding.api.createCheckRun).toHaveBeenCalledTimes(1);
   expect(funding.api.updateCheckRun).toHaveBeenCalledWith('1',await funding.api.repository('1','2'),'900',expect.objectContaining({status:'completed',conclusion:'neutral'}));
   const rows=await funding.database.orm.select().from(verifications);expect(rows).toHaveLength(1);expect(rows[0]?.status).toBe('DONE');expect(rows[0]?.usageMetrics).toMatchObject({totalNanoAiu:500,totalPremiumRequestCost:0.1,inputTokens:10,outputTokens:12});

   await service.verifySubmission(linked.submission.id,pr.head.sha,true);
   await service.verifySubmission(linked.submission.id,pr.head.sha,true);
   expect(verifier).toHaveBeenCalledTimes(2);expect(funding.api.createCheckRun).toHaveBeenCalledTimes(3);
   const attempts=await funding.database.orm.select().from(verifications);expect(attempts.map(row=>row.attempt)).toEqual([1,2,3]);expect(attempts[2]?.errorCode).toBe('VERIFIER_BUDGET_EXHAUSTED');
   const [unchanged]=await funding.database.orm.select().from(bounties).where(eq(bounties.id,bounty.id));
   expect(unchanged?.status).toBe('FUNDED');expect(unchanged?.fundingHold).toBe(false);expect(unchanged?.amountCents).toBe(5000);
   expect(funding.api.createComment).not.toHaveBeenCalled();
  } finally { await funding.close(); }
 });

 async function creatorScenario(attentionReason:string) {
  const funding=await intentFixture();
  const [storedBounty]=await funding.database.orm.update(bounties).set({status:'FUNDED',fundedTerms:funding.terms,needsAttention:true,attentionReason}).where(eq(bounties.id,funding.bounty.id)).returning();
  const bounty=required(storedBounty);
  // The bounty creator (GitHub ID 4) opened and authored this PR.
  const pr:PullRequest={id:'502',number:43,state:'open',draft:false,title:'Fix parser',body:'Fixes #12',merged_at:null,closed_at:null,user:{id:'4',login:'maintainer',type:'User'},head:{sha:'c'.repeat(40)},base:{sha:'d'.repeat(40),repo:{id:'2'}}};
  const linked=await linkPr(funding.database,bounty,pr);
  vi.mocked(funding.api.pullRequest).mockResolvedValue(pr);
  vi.mocked(funding.api.pullRequestFiles).mockResolvedValue({files:[{filename:'src/parser.ts',status:'modified',additions:1,deletions:0,patch:'@@ -1 +1 @@\n+guard()'}],complete:true});
  vi.mocked(funding.api.pullRequestCommits).mockResolvedValue({authors:[{ghId:'4',login:'maintainer',type:'User'}],complete:true});
  vi.mocked(funding.api.checkRuns).mockResolvedValue({runs:[],complete:true});
  const verifier=vi.fn();
  await createPhase5(funding.database,funding.api,funding.env,funding.auth,verifier).verifySubmission(linked.submission.id,pr.head.sha);
  return {funding,bounty,verifier};
 }

 it('explains that the bounty creator cannot earn the bounty, without calling the model',async()=>{
  const {funding,verifier}=await creatorScenario('Solution review service unavailable; maintainer review and retry required');
  try {
   expect(verifier).not.toHaveBeenCalled();
   const summary=vi.mocked(funding.api.updateCheckRun).mock.calls.at(-1)?.[3].summary??'';
   expect(summary).toContain('created this bounty');expect(summary).not.toContain('authorship is ambiguous');
   const [row]=await funding.database.orm.select().from(verifications);expect(row?.errorCode).toBe('INSUFFICIENT_EVIDENCE');
  } finally { await funding.close(); }
 });

 it('a completed review clears a stale review-unavailable warning but keeps funding attention',async()=>{
  const stale=await creatorScenario('Solution review service unavailable; maintainer review and retry required');
  try {
   const [after]=await stale.funding.database.orm.select().from(bounties).where(eq(bounties.id,stale.bounty.id));
   expect(after?.needsAttention).toBe(false);expect(after?.attentionReason).toBeNull();
  } finally { await stale.funding.close(); }
  const held=await creatorScenario('Captured funds refunded or reversed; disbursement frozen');
  try {
   const [after]=await held.funding.database.orm.select().from(bounties).where(eq(bounties.id,held.bounty.id));
   expect(after?.needsAttention).toBe(true);expect(after?.attentionReason).toBe('Captured funds refunded or reversed; disbursement frozen');
  } finally { await held.funding.close(); }
 });
});
