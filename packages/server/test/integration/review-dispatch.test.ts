import { describe,it,expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { intentFixture } from '../helpers/funding.js';
import { required } from '../helpers/auth.js';
import { bounties,submissions,reviewDispatches } from '../../src/db/schema.js';
import { enqueue,claimJob } from '../../src/jobs/queue.js';
import { configureReviews,createDispatch,admitReview,claimReview,pauseReviews,terminateReview } from '../../src/reviews/store.js';
import { artifactVersion } from '../../src/reviews/config.js';
import { isSponsoredTerms } from '../../src/domain/funded-terms.js';

describe('durable review admission',()=>{
 it('atomically limits sponsors and global capacity while skipping a busy sponsor',async()=>{
  const f=await intentFixture();try{
   if(!isSponsoredTerms(f.terms))throw new Error('Sponsored fixture required');
   await configureReviews(f.database,'dedicated',1);
   const created=[];
   for(const [index,sponsor] of ['4','4','5','6'].entries()){
    const bounty=required((await f.database.orm.insert(bounties).values({installationId:'1',repoId:String(index+10),repoFullName:`owner/repo${String(index)}`,issueNumber:1,amountCents:5000,createdByGhId:'4',createdVia:'command',status:'FUNDED',fundedTerms:{...f.terms,sponsor:{...f.terms.sponsor,id:sponsor}}}).returning())[0]);
    const sub=required((await f.database.orm.insert(submissions).values({bountyId:bounty.id,repoId:bounty.repoId,prId:String(index+100),prNumber:2,authorGhId:'8',authorLogin:'author',headSha:'a'.repeat(40),baseSha:'b'.repeat(40)}).returning())[0]);
    await f.database.withTransaction(tx=>enqueue(tx,{kind:'verify_submission',payload:{submissionId:sub.id,headSha:sub.headSha},dedupeKey:`dispatch:${String(index)}`,maxAttempts:3}));
    const job=required(await claimJob(f.database,'dispatcher',30,{only:'verify_submission'}));
    const dispatch=required(await createDispatch(f.database,job,'dedicated',1));
    expect((await createDispatch(f.database,job,'dedicated',1))?.id).toBe(dispatch.id);
    created.push(dispatch);
   }
   const admitted=(await Promise.all([admitReview(f.database),admitReview(f.database),admitReview(f.database)])).filter(Boolean);
   expect(admitted).toHaveLength(2);
   expect(admitted.map(d=>d?.sponsorGhId).sort()).toEqual(['4','5']);
   expect(await f.database.orm.select().from(reviewDispatches).where(eq(reviewDispatches.capacityHeld,true))).toHaveLength(2);
   const first=required(admitted[0]);
   const claims=await Promise.all([claimReview(f.database,first.id,'run-a','dedicated',1,artifactVersion),claimReview(f.database,first.id,'run-b','dedicated',1,artifactVersion)]);
   expect(claims.filter(Boolean)).toHaveLength(1);
   // A heartbeat timeout alone never frees capacity or permits another owner.
   await f.database.orm.update(reviewDispatches).set({heartbeatUntil:new Date(0)}).where(eq(reviewDispatches.id,first.id));
   expect(await claimReview(f.database,first.id,'run-c','dedicated',1,artifactVersion)).toBeNull();
   expect(await admitReview(f.database)).toBeNull();
   await terminateReview(f.database,first.id,required(required(claims.find(Boolean)).runId));
   expect(await admitReview(f.database)).not.toBeNull();
   await pauseReviews(f.database);
   expect(await admitReview(f.database)).toBeNull();
   await expect(configureReviews(f.database,'render',2)).rejects.toThrow('active');
   expect(created).toHaveLength(4);
  }finally{await f.close();}
 });
});
