import { describe,expect,it,vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { intentFixture } from '../helpers/funding.js';
import { required } from '../helpers/auth.js';
import { bounties,submissions,reviewDispatches } from '../../src/db/schema.js';
import { configureReviews,claimReview,recoverTerminatedRenderRun } from '../../src/reviews/store.js';
import { dispatchOnce } from '../../src/reviews/dispatcher.js';
import { enqueue,claimJob } from '../../src/jobs/queue.js';
import { artifactVersion,parseReviewSettings } from '../../src/reviews/config.js';
const settings=parseReviewSettings({REVIEW_BACKEND:'render',REVIEW_EXECUTOR_KEY:Buffer.alloc(32,3).toString('base64'),RENDER_API_KEY:'r'.repeat(25),RENDER_REVIEW_TASK:'repopay-reviews/verifySubmission:abc123'});
async function fixture(){
 const f=await intentFixture();await configureReviews(f.database,'render',1);
 await f.database.orm.update(bounties).set({status:'FUNDED',fundedTerms:f.terms}).where(eq(bounties.id,f.bounty.id));
 const sub=required((await f.database.orm.insert(submissions).values({bountyId:f.bounty.id,repoId:'2',prId:'501',prNumber:42,authorGhId:'8',authorLogin:'author',headSha:'a'.repeat(40),baseSha:'b'.repeat(40)}).returning())[0]);
 await f.database.withTransaction(tx=>enqueue(tx,{kind:'verify_submission',payload:{submissionId:sub.id,headSha:sub.headSha},dedupeKey:'launch',maxAttempts:3}));return f;
}
describe('Render launch durability',()=>{
 it('reuses the original dispatch and refuses a new launch after the retention window',async()=>{
  const f=await fixture();try{
   const provider={start:vi.fn(()=>Promise.reject(new Error('lost response'))),status:vi.fn(()=>Promise.resolve('running'))};
   await dispatchOnce(f.database,settings,provider);
   const row=required((await f.database.orm.select().from(reviewDispatches))[0]);expect(row.status).toBe('LAUNCH_UNKNOWN');
   expect(await claimJob(f.database,'old-shared-worker',30)).toBeNull();
   await f.database.orm.update(reviewDispatches).set({nextLaunchAt:new Date(0)}).where(eq(reviewDispatches.id,row.id));
   await dispatchOnce(f.database,settings,provider);
   expect(provider.start.mock.calls).toEqual([[settings.RENDER_REVIEW_TASK,row.id],[settings.RENDER_REVIEW_TASK,row.id]]);
   await f.database.orm.update(reviewDispatches).set({nextLaunchAt:new Date(0),launchStartedAt:new Date(Date.now()-24*3600000)}).where(eq(reviewDispatches.id,row.id));
   await dispatchOnce(f.database,settings,provider);expect(provider.start).toHaveBeenCalledTimes(2);
   expect((await f.database.orm.select().from(reviewDispatches))[0]).toMatchObject({capacityHeld:true,errorCode:'LAUNCH_WINDOW_EXPIRED'});
   await expect(recoverTerminatedRenderRun(f.database,row.id,'run-found',{id:'run-found',status:'running',input:[{dispatchId:row.id}]})).rejects.toThrow();
   await expect(recoverTerminatedRenderRun(f.database,row.id,'run-found',{id:'run-found',status:'completed',input:[{dispatchId:'different'}]})).rejects.toThrow();
   await recoverTerminatedRenderRun(f.database,row.id,'run-found',{id:'run-found',status:'completed',input:[{dispatchId:row.id}]});
   expect((await f.database.orm.select().from(reviewDispatches))[0]).toMatchObject({capacityHeld:false,status:'FAILED_BEFORE_INFERENCE',runId:'run-found'});
   expect(await claimReview(f.database,row.id,'late-old-run','render',1,artifactVersion)).toBeNull();
  }finally{await f.close();}
 });
 it('binds task-side ownership before launch acknowledgment and releases only on terminal evidence',async()=>{
  const f=await fixture();try{
   const provider={start:vi.fn(async(_task:string,id:string)=>{expect(await claimReview(f.database,id,'run-one','render',1,artifactVersion)).not.toBeNull();return 'run-one';}),status:vi.fn(()=>Promise.resolve('running'))};
   await dispatchOnce(f.database,settings,provider);await dispatchOnce(f.database,settings,provider);
   expect(provider.start).toHaveBeenCalledTimes(1);expect((await f.database.orm.select().from(reviewDispatches))[0]?.capacityHeld).toBe(true);
   provider.status.mockResolvedValue('canceled');await dispatchOnce(f.database,settings,provider);
   expect((await f.database.orm.select().from(reviewDispatches))[0]).toMatchObject({capacityHeld:false,status:'FAILED_BEFORE_INFERENCE'});
  }finally{await f.close();}
 });
});
