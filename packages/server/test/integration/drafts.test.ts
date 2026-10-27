import { expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { githubFixture, createWork, testEnv } from '../helpers/github.js';
import { handleJob } from '../../src/jobs/runner.js';
import { bounties, bountyActivity } from '../../src/db/schema.js';
import { finishJob } from '../../src/jobs/queue.js';
it('concurrent comment and label converge on one exact-cent draft and activity',async()=>{
 const f=await githubFixture();try{
  const a=await f.job(createWork());const b=await f.job({kind:'create_bounty_from_label',installationId:'1',repoId:'2',issueNumber:12,actorId:'4',amount:'50',occurrence:'delivery'});
  await Promise.all([a,b].map(job=>handleJob(f.database,f.api,testEnv,job)));
  expect(await f.database.orm.select().from(bounties)).toMatchObject([{amountCents:5000,status:'OPEN',createdByGhId:'4'}]);
  expect(await f.database.orm.select().from(bountyActivity)).toHaveLength(1);
 }finally{await f.close();}
});
it.each(['read','none'] as const)('current %s permission prevents creation',async permission=>{
 const f=await githubFixture();try{f.state.permission=permission;const job=await f.job(createWork());await handleJob(f.database,f.api,testEnv,job);expect(await f.database.orm.select().from(bounties)).toHaveLength(0);expect(f.comments).toHaveLength(1);}finally{await f.close();}
});
it('permission outage fails closed, invalid amount responds, future actions do not mutate',async()=>{
 const f=await githubFixture();try{
  const a=await f.job(createWork({command:{kind:'create',amount:'-2'}}));await handleJob(f.database,f.api,testEnv,a);await finishJob(f.database,a);
  const b=await f.job(createWork({command:{kind:'unavailable'}}));await handleJob(f.database,f.api,testEnv,b);await finishJob(f.database,b);
  f.api.permission=()=>Promise.reject(new Error('outage'));const c=await f.job(createWork());await expect(handleJob(f.database,f.api,testEnv,c)).rejects.toThrow();
  expect(await f.database.orm.select().from(bounties)).toHaveLength(0);
 }finally{await f.close();}
});
it('app removal retains draft and activity, with attention and no refund',async()=>{
 const f=await githubFixture();try{
  const a=await f.job(createWork());await handleJob(f.database,f.api,testEnv,a);await finishJob(f.database,a);
  // Process the projection queued by creation before the lifecycle event.
  const projection=await f.job({kind:'refresh_installation',installationId:'1',removedRepoIds:[]});await handleJob(f.database,f.api,testEnv,projection);await finishJob(f.database,projection);
  f.state.installation=null;
  const job=await import('../../src/jobs/queue.js').then(m=>m.claimJob(f.database,'removal',120));if(!job)throw new Error('missing lifecycle');
  await handleJob(f.database,f.api,testEnv,job);
  expect(await f.database.orm.select().from(bounties).where(eq(bounties.repoId,'2'))).toMatchObject([{status:'OPEN',needsAttention:true,amountCents:5000}]);
 }finally{await f.close();}
});
