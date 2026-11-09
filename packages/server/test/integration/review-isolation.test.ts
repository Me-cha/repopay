import { expect,it,vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { intentFixture } from '../helpers/funding.js';
import { required } from '../helpers/auth.js';
import { bounties,submissions,jobs } from '../../src/db/schema.js';
import { configureReviews } from '../../src/reviews/store.js';
import { dispatchOnce } from '../../src/reviews/dispatcher.js';
import { enqueue } from '../../src/jobs/queue.js';
import { runOnce } from '../../src/jobs/runner.js';
import { parseReviewSettings } from '../../src/reviews/config.js';

it('processes 50 ordinary projections while a remote launch is blocked',async()=>{
 const f=await intentFixture();let release=()=>{};const blocked=new Promise<string>(resolve=>{release=()=> { resolve('run-test'); };});
 const settings=parseReviewSettings({REVIEW_BACKEND:'render',REVIEW_EXECUTOR_KEY:Buffer.alloc(32,4).toString('base64'),RENDER_API_KEY:'r'.repeat(25),RENDER_REVIEW_TASK:'review/verifySubmission:abc'});
 let dispatch:Promise<void>|undefined;
 try{
  await configureReviews(f.database,'render',1);
  await f.database.orm.update(bounties).set({status:'FUNDED',fundedTerms:f.terms}).where(eq(bounties.id,f.bounty.id));
  const sub=required((await f.database.orm.insert(submissions).values({bountyId:f.bounty.id,repoId:'2',prId:'501',prNumber:42,authorGhId:'8',authorLogin:'author',headSha:'a'.repeat(40),baseSha:'b'.repeat(40)}).returning())[0]);
  await f.database.withTransaction(tx=>enqueue(tx,{kind:'verify_submission',payload:{submissionId:sub.id,headSha:sub.headSha},dedupeKey:'blocked-review',maxAttempts:3}));
  let started=()=>{};const ready=new Promise<void>(resolve=>{started=resolve;});
  dispatch=dispatchOnce(f.database,settings,{start:()=>{started();return blocked;},status:()=>Promise.resolve('running')});await ready;
  for(let i=0;i<50;i++)await f.database.withTransaction(tx=>enqueue(tx,{kind:'sync_bounty',payload:{bountyId:f.bounty.id},dedupeKey:`ordinary:${String(i)}`,maxAttempts:3}));
  const phase5={syncPullRequest:vi.fn(),refreshVerificationSha:vi.fn(),manualLink:vi.fn(),verifySubmission:vi.fn()};
  for(let i=0;i<50;i++)expect(await runOnce(f.database,f.api,{...f.env,REVIEW_BACKEND:'render'},'ordinary',undefined,phase5)).toBe(true);
  expect((await f.database.orm.select().from(jobs)).filter(row=>row.kind==='sync_bounty'&&row.status==='done')).toHaveLength(50);
  expect(phase5.verifySubmission).not.toHaveBeenCalled();
 }finally{release();await dispatch;await f.close();}
});
