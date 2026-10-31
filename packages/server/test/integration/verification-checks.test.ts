import { afterEach,describe,expect,it,vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { githubFixture,testEnv } from '../helpers/github.js';
import { bounties,installations,submissions,submissionEvidence,bountyActivity,verifications,jobs,copilotSponsors } from '../../src/db/schema.js';
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

 it.each([1,2])('records review attention only at exhaustion (max attempts %i)',async maxAttempts=>{
  f=await githubFixture();
  const fixture=required(f);
  await fixture.database.orm.insert(installations).values({id:'1',accountId:'10',accountLogin:'owner'});
  const bounty=required((await fixture.database.orm.insert(bounties).values({installationId:'1',repoId:'2',repoFullName:'owner/repo',issueNumber:12,amountCents:5000,createdByGhId:'4',createdVia:'command'}).returning())[0]);
  const submission=required((await fixture.database.orm.insert(submissions).values({bountyId:bounty.id,repoId:'2',prId:'501',prNumber:41,authorGhId:'8',authorLogin:'contributor',headSha:'a'.repeat(40),baseSha:'b'.repeat(40)}).returning())[0]);
  await fixture.database.withTransaction(tx=>enqueue(tx,{kind:'verify_submission',payload:{submissionId:submission.id,headSha:submission.headSha},dedupeKey:'test:verify-failure',maxAttempts}));
  const phase5={syncPullRequest:vi.fn(),refreshVerificationSha:vi.fn(),manualLink:vi.fn(),verifySubmission:vi.fn(()=>Promise.reject(new Error('provider details must not reach activity logs')))};

  await runOnce(fixture.database,fixture.api,testEnv,'test-worker',undefined,phase5);

  const [after]=await fixture.database.orm.select().from(bounties).where(eq(bounties.id,bounty.id));
  const activities=await fixture.database.orm.select().from(bountyActivity);
  expect(after?.needsAttention).toBe(maxAttempts===1);
  if(maxAttempts===1)expect(after?.attentionReason).toMatch(/review service unavailable/);
  expect(after?.status).toBe('OPEN');
  expect(activities.some(item=>item.action==='verification_job_failed')).toBe(maxAttempts===1);
  expect(activities.some(item=>item.action==='verification_job_failed'&&typeof item.metadata.jobId==='string')).toBe(maxAttempts===1);
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
   vi.mocked(funding.api.fileAtRevision).mockResolvedValue('throw new Error("invalid");');
   vi.mocked(funding.api.pullRequestFiles).mockResolvedValue({files:[{filename:'src/parser.ts',sha:'c'.repeat(40),status:'modified',additions:1,deletions:0,patch:'@@ -1 +1 @@\n+throw new Error(\'invalid\')'}],complete:true});
   vi.mocked(funding.api.pullRequestCommits).mockResolvedValue({authors:[{ghId:'8',login:'contributor',type:'User'}],complete:true});
   vi.mocked(funding.api.checkRuns).mockResolvedValue({runs:[{id:'11',name:'test',head_sha:pr.head.sha,status:'completed',conclusion:'success',app:{id:'15368'}}],complete:true});
   const verifier=vi.fn(()=>Promise.resolve({value:{verdict:'RESOLVES' as const,coverage:1,confidence:0.95,reasoning:'Adds the required input guard.',unmet_requirements:[],splits:[{gh_id:'8',share:1,why:'PR author'}]},usage:{totalNanoAiu:500,totalPremiumRequestCost:0.1,totalApiDurationMs:42,totalUserRequests:1,inputTokens:10,outputTokens:12,cacheReadTokens:0,cacheWriteTokens:0},provider:'copilot' as const,requestedModel:'auto',model:'test-model',sdkVersion:'1.0.28',billingOwnerId:'4',elapsedMs:42,promptHash:'f'.repeat(64),promptVersion:'gitpay-verifier-v1'}));
   const service=createPhase5(funding.database,funding.api,{...funding.env,VERIFIER_MAX_ATTEMPTS_PER_SHA:2},funding.auth,verifier);

   await service.verifySubmission(linked.submission.id,pr.head.sha);
   await service.verifySubmission(linked.submission.id,pr.head.sha);
   expect(verifier).toHaveBeenCalledTimes(1);
   const snapshots=await funding.database.orm.select().from(submissionEvidence);expect(snapshots[0]?.diffText).toContain('gitpay-contribution-evidence-v1');
   expect(vi.mocked(funding.api.updateCheckRun).mock.calls[0]?.[3].summary).toContain('/bounty retry #12');
   await service.verifySubmission(linked.submission.id,pr.head.sha,true,undefined,'d'.repeat(40));expect(verifier).toHaveBeenCalledTimes(1);
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

 async function creatorScenario(attentionReason:string,changeDuring?:'collection'|'publication'|'lost') {
  const funding=await intentFixture();
  const [storedBounty]=await funding.database.orm.update(bounties).set({status:'FUNDED',fundedTerms:funding.terms,needsAttention:true,attentionReason}).where(eq(bounties.id,funding.bounty.id)).returning();
  const bounty=required(storedBounty);
  // The bounty creator (GitHub ID 4) opened and authored this PR.
  const pr:PullRequest={id:'502',number:43,state:'open',draft:false,title:'Fix parser',body:'Fixes #12',merged_at:null,closed_at:null,user:{id:'4',login:'maintainer',type:'User'},head:{sha:'c'.repeat(40)},base:{sha:'d'.repeat(40),repo:{id:'2'}}};
  const linked=await linkPr(funding.database,bounty,pr);
  vi.mocked(funding.api.pullRequest).mockResolvedValue(pr);
  vi.mocked(funding.api.fileAtRevision).mockResolvedValue('throw new Error("invalid");');
   vi.mocked(funding.api.pullRequestFiles).mockResolvedValue({files:[{filename:'src/parser.ts',sha:'c'.repeat(40),status:'modified',additions:1,deletions:0,patch:'@@ -1 +1 @@\n+guard()'}],complete:true});
  vi.mocked(funding.api.pullRequestCommits).mockResolvedValue({authors:[{ghId:'4',login:'maintainer',type:'User'}],complete:true});
  vi.mocked(funding.api.checkRuns).mockResolvedValue({runs:[],complete:true});
  const verifier=vi.fn();
  if(changeDuring==='lost'){
   vi.mocked(funding.api.createCheckRun).mockImplementationOnce((_inst,_repo,input)=>{
    vi.mocked(funding.api.checkRuns).mockResolvedValue({complete:true,runs:[{id:'900',name:'GitPay solution review',head_sha:pr.head.sha,external_id:input.externalId,app:{id:funding.env.GH_APP_ID},status:'in_progress',conclusion:null}]});
    return Promise.reject(new Error('create response lost'));
   });
   await expect(createPhase5(funding.database,funding.api,funding.env,funding.auth,verifier).verifySubmission(linked.submission.id,pr.head.sha)).rejects.toThrow('create response lost');
  }
  if(changeDuring==='collection')vi.mocked(funding.api.pullRequestFiles).mockImplementationOnce(async()=>{
   await linkPr(funding.database,bounty,{...pr,head:{sha:'e'.repeat(40)}});
   return {files:[],complete:true};
  });
  if(changeDuring==='publication')vi.mocked(funding.api.createCheckRun).mockImplementationOnce(async()=>{
   await linkPr(funding.database,bounty,{...pr,head:{sha:'e'.repeat(40)}});return '900';
  });
  if(changeDuring==='collection'){
   await expect(createPhase5(funding.database,funding.api,funding.env,funding.auth,verifier).verifySubmission(linked.submission.id,pr.head.sha)).rejects.toThrow();
   return {funding,bounty,verifier};
  }
  await createPhase5(funding.database,funding.api,funding.env,funding.auth,verifier).verifySubmission(linked.submission.id,pr.head.sha);
  return {funding,bounty,verifier};
 }

 it('refreshes evidence after a merge transition even when its diff hash is unchanged',async()=>{
  const f=await creatorScenario('');
  try{
   const original=await f.funding.api.pullRequest('1',await f.funding.api.repository('1','2'),43);
   const merged={...original,state:'closed' as const,merged_at:'2026-10-30T10:00:00Z',closed_at:'2026-10-30T10:00:00Z',merge_commit_sha:'f'.repeat(40)};
   const linked=await linkPr(f.funding.database,f.bounty,merged);
   vi.mocked(f.funding.api.pullRequest).mockResolvedValue(merged);
   await createPhase5(f.funding.database,f.funding.api,f.funding.env,f.funding.auth,f.verifier).verifySubmission(linked.submission.id,merged.head.sha);
   const evidence=await f.funding.database.orm.select().from(submissionEvidence);
   const [sub]=await f.funding.database.orm.select().from(submissions);
   expect(evidence).toHaveLength(2);expect(evidence[0]?.snapshotHash).toBe(evidence[1]?.snapshotHash);
   expect(sub?.evidenceVersion).toBe(Math.max(...evidence.map(row=>row.version)));
   expect(await f.funding.database.orm.select().from(verifications)).toHaveLength(2);
  }finally{await f.funding.close();}
 });

 it('does not save stale evidence or clear current attention after a revision race',async()=>{
  for(const stage of ['collection','publication'] as const){
   const f=await creatorScenario('Solution review service unavailable; maintainer review and retry required',stage);
   try{
    const [after]=await f.funding.database.orm.select().from(bounties).where(eq(bounties.id,f.bounty.id));
    expect(after?.needsAttention).toBe(true);
    if(stage==='collection')expect(await f.funding.database.orm.select().from(submissionEvidence)).toHaveLength(0);
   }finally{await f.funding.close();}
  }
 });
 it('recovers a lost Check Run create response by App-owned attempt marker',async()=>{
  const f=await creatorScenario('Solution review service unavailable; maintainer review and retry required','lost');
  try{
   expect(f.funding.api.createCheckRun).toHaveBeenCalledTimes(1);
   const rows=await f.funding.database.orm.select().from(verifications);
   expect(rows).toHaveLength(1);expect(rows[0]?.checkRunId).toBe('900');
   expect(rows[0]?.errorCode).toBe('INSUFFICIENT_EVIDENCE');
  }finally{await f.funding.close();}
 });
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
it('discards a connection when verifier lock acquisition has an unknown outcome',async()=>{
 const f=await intentFixture();const client=await f.database.pool.connect();
 const release=vi.spyOn(client,'release');
 vi.spyOn(client,'query').mockRejectedValueOnce(new Error('query timed out'));
 vi.spyOn(f.database.pool as {connect:()=>Promise<typeof client>},'connect').mockResolvedValueOnce(client);
 try{await expect(createPhase5(f.database,f.api,f.env,f.auth).verifySubmission('1','a'.repeat(40))).rejects.toThrow('query timed out');expect(release).toHaveBeenCalledWith(true);}
 finally{vi.restoreAllMocks();await f.close();}
});
it('an expired worker lease cannot collect evidence or write a verification',async()=>{
 const f=await intentFixture();try{
  const {claimJob}=await import('../../src/jobs/queue.js');
  const {jobs}=await import('../../src/db/schema.js');
  await f.database.withTransaction(tx=>enqueue(tx,{kind:'verify_submission',payload:{submissionId:'1',headSha:'a'.repeat(40)},dedupeKey:'expired',maxAttempts:2}));
  const lease=required(await claimJob(f.database,'old',30));
  await f.database.orm.update(jobs).set({lockedUntil:new Date(0)}).where(eq(jobs.id,lease.id));
  await expect(createPhase5(f.database,f.api,f.env,f.auth).verifySubmission('1','a'.repeat(40),false,lease)).rejects.toThrow('Job lease lost');
  expect(await f.database.orm.select().from(submissionEvidence)).toHaveLength(0);
  expect(await f.database.orm.select().from(verifications)).toHaveLength(0);
  expect(f.api.pullRequest).not.toHaveBeenCalled();
 }finally{await f.close();}
});

it('schedules changed PR descriptions at the same SHA and deduplicates identical metadata',async()=>{
 const f=await intentFixture();
 try{
  const bounty=required((await f.database.orm.update(bounties).set({status:'FUNDED',fundedTerms:f.terms}).where(eq(bounties.id,f.bounty.id)).returning())[0]);
  const pr:PullRequest={id:'501',number:42,state:'open',title:'Fix parser',body:'Original description',merged_at:null,closed_at:null,user:{id:'8',login:'contributor',type:'User'},head:{sha:'a'.repeat(40)},base:{sha:'b'.repeat(40),repo:{id:'2'}}};
  await linkPr(f.database,bounty,pr);
  vi.mocked(f.api.pullRequest).mockResolvedValue({...pr,body:'Fixes #12'});
  const service=createPhase5(f.database,f.api,f.env,f.auth,vi.fn());
  await service.syncPullRequest('1','2',42);await service.syncPullRequest('1','2',42);
  const queued=await f.database.orm.select().from(jobs).where(eq(jobs.kind,'verify_submission'));
  expect(queued).toHaveLength(1);expect(queued[0]?.payload).toMatchObject({headSha:pr.head.sha});
  vi.mocked(f.api.pullRequest).mockResolvedValue({...pr,body:'Fixes #12. Additional evidence.'});
  await service.syncPullRequest('1','2',42);
  expect(await f.database.orm.select().from(jobs).where(eq(jobs.kind,'verify_submission'))).toHaveLength(2);
 }finally{await f.close();}
});

it('rejects an in-flight verdict if the sponsor reconnects before the result is saved',async()=>{
 const f=await intentFixture();try{
  const bounty=required((await f.database.orm.update(bounties).set({status:'FUNDED',fundedTerms:f.terms}).where(eq(bounties.id,f.bounty.id)).returning())[0]);
  const pr:PullRequest={id:'501',number:42,state:'open',title:'Fix parser',body:'Fixes #12',merged_at:null,closed_at:null,user:{id:'8',login:'contributor',type:'User'},head:{sha:'a'.repeat(40)},base:{sha:'b'.repeat(40),repo:{id:'2'}}};
  const linked=await linkPr(f.database,bounty,pr);
  vi.mocked(f.api.pullRequest).mockResolvedValue(pr);
  vi.mocked(f.api.fileAtRevision).mockResolvedValue('validate(value);');
  vi.mocked(f.api.pullRequestFiles).mockResolvedValue({files:[{filename:'parser.ts',sha:'c'.repeat(40),status:'modified',additions:1,deletions:0,patch:'+validate(value)'}],complete:true});
  vi.mocked(f.api.pullRequestCommits).mockResolvedValue({authors:[{ghId:'8',login:'contributor',type:'User'}],complete:true});
  vi.mocked(f.api.checkRuns).mockResolvedValue({runs:[{id:'11',name:'test',head_sha:pr.head.sha,status:'completed',conclusion:'success',app:{id:'15368'}}],complete:true});
  const verify=vi.fn(async()=>{
   await f.auth.revokeCopilotSponsor('2');
   await f.database.orm.update(copilotSponsors).set({revokedAt:null,tokenGeneration:99}).where(eq(copilotSponsors.repoId,'2'));
   return {value:{verdict:'RESOLVES' as const,coverage:1,confidence:1,reasoning:'Fixed',unmet_requirements:[],splits:[{gh_id:'8',share:1,why:'author'}]},usage:{totalNanoAiu:1,totalPremiumRequestCost:1,totalApiDurationMs:1,totalUserRequests:1,inputTokens:1,outputTokens:1,cacheReadTokens:0,cacheWriteTokens:0},provider:'copilot' as const,requestedModel:'auto',model:'test-model',sdkVersion:'1.0.28',billingOwnerId:'4',elapsedMs:1,promptHash:'f'.repeat(64),promptVersion:'gitpay-verifier-v2'};
  });
  await createPhase5(f.database,f.api,f.env,f.auth,verify).verifySubmission(linked.submission.id,pr.head.sha);
  expect(verify).toHaveBeenCalledTimes(1);
  const rows=await f.database.orm.select().from(verifications);expect(rows).toHaveLength(1);expect(rows[0]?.status).toBe('ERROR');expect(rows[0]?.result).toBeNull();
 }finally{await f.close();}
});
