import { expect, it,vi } from 'vitest';
import { githubFixture, createWork, testEnv } from '../helpers/github.js';
import { handleJob } from '../../src/jobs/runner.js';
import { claimJob, finishJob } from '../../src/jobs/queue.js';
import { bounties,jobs } from '../../src/db/schema.js';
import { syncBounty, withProjectionLock } from '../../src/github/comments.js';
it('lost comment response reconciles by trusted marker, ignoring forged user marker',async()=>{
 const f=await githubFixture();try{
  const a=await f.job(createWork());await handleJob(f.database,f.api,testEnv,a);await finishJob(f.database,a);
  const [bounty]=await f.database.orm.select().from(bounties);if(!bounty)throw new Error('missing bounty');
  f.comments.push({id:'8',body:`<!-- gitpay:bounty:${bounty.id} -->`,user:{id:'4',type:'User'}});
  const job=await claimJob(f.database,'sync',120);if(!job)throw new Error('missing sync');
  f.state.lostResponse=true;await expect(syncBounty(f.database,f.api,testEnv,job,bounty.id)).rejects.toThrow('lost');
  await syncBounty(f.database,f.api,testEnv,job,bounty.id);
  expect(f.comments).toHaveLength(2);expect(f.api.createComment).toHaveBeenCalledTimes(1);expect(f.api.updateComment).toHaveBeenCalledTimes(1);
  expect(f.comments[1]?.body).toContain('$50.00 USD');expect(f.comments[1]?.body).not.toContain('Fund $');
  expect(f.api.createComment).toHaveBeenCalledWith('1',{id:'2',full_name:'owner/repo',archived:false},12,expect.any(String));
 }finally{await f.close();}
});
it('delayed cancelled projection keeps the open badge of a replacement draft on the same issue',async()=>{
 const f=await githubFixture();try{
  const a=await f.job(createWork());await handleJob(f.database,f.api,testEnv,a);await finishJob(f.database,a);
  const [old]=await f.database.orm.select().from(bounties);if(!old)throw new Error('missing bounty');
  await f.database.orm.update(bounties).set({status:'CANCELLED'});
  await f.database.orm.insert(bounties).values({installationId:old.installationId,repoId:old.repoId,repoFullName:old.repoFullName,issueNumber:old.issueNumber,amountCents:3000,createdByGhId:'4',createdVia:'command'});
  const late=await f.job({kind:'sync_bounty',bountyId:old.id});await handleJob(f.database,f.api,testEnv,late);
  expect(f.comments.find(c=>c.body?.includes(`gitpay:bounty:${old.id}`))?.body).toContain('CANCELLED');
  expect(f.api.badge).not.toHaveBeenCalledWith(expect.anything(),expect.anything(),old.issueNumber,'CANCELLED');
 }finally{await f.close();}
});
it('status reply for a funded bounty reports confirmed funding, not reconciliation',async()=>{
 const f=await githubFixture();try{
  const create=await f.job(createWork());await handleJob(f.database,f.api,testEnv,create);await finishJob(f.database,create);
  const projection=await claimJob(f.database,'sync',120);if(!projection)throw new Error('missing sync');await handleJob(f.database,f.api,testEnv,projection);await finishJob(f.database,projection);
  await f.database.orm.update(bounties).set({status:'FUNDED',fundedAt:new Date(),captureId:'CAPTURE1'});
  f.state.permission='read';
  const status=await f.job(createWork({commentId:'30',command:{kind:'status'}}));await handleJob(f.database,f.api,testEnv,status);
  const body=f.comments.find(c=>c.body?.includes(`gitpay:reply:${status.id}`))?.body;
  expect(body).toContain('FUNDED');expect(body).toContain('Funding confirmed');expect(body).not.toContain('requires reconciliation');
 }finally{await f.close();}
});
it('projection lock serializes workers across connections',async()=>{
 const f=await githubFixture();try{await withProjectionLock(f.database,'same-bounty',async()=>{await expect(withProjectionLock(f.database,'same-bounty',async()=>{})).rejects.toThrow('busy');});await expect(withProjectionLock(f.database,'same-bounty',()=>Promise.resolve(true))).resolves.toBe(true);}finally{await f.close();}
});
it('each read-only status command gets a reply, while retries reconcile the same reply',async()=>{
 const f=await githubFixture();const clock=vi.spyOn(Date,'now').mockReturnValue(Date.now());try{
  const create=await f.job(createWork());await handleJob(f.database,f.api,testEnv,create);await finishJob(f.database,create);
  const projection=await claimJob(f.database,'sync',120);if(!projection)throw new Error('missing sync');
  await handleJob(f.database,f.api,testEnv,projection);await finishJob(f.database,projection);
  f.state.permission='read';
  for(const commentId of ['21','22']) {
   const job=await f.job(createWork({commentId,command:{kind:'status'}}));
   if(commentId==='21'){
    f.state.lostResponse=true;
    await expect(handleJob(f.database,f.api,testEnv,job)).rejects.toThrow('lost');
   }
   await handleJob(f.database,f.api,testEnv,job);
   await handleJob(f.database,f.api,testEnv,job);
   await finishJob(f.database,job);
   const sync=await claimJob(f.database,'sync',120);
   if(sync){await handleJob(f.database,f.api,testEnv,sync);await finishJob(f.database,sync);}
  }
  expect((await f.database.orm.select().from(jobs)).filter(j=>j.dedupeKey?.startsWith('status:'))).toHaveLength(1);
  const replies=f.comments.filter(c=>c.body?.includes('gitpay:reply:'));
  expect(replies).toHaveLength(2);
  for(const reply of replies){expect(reply.body).toContain('$50.00 USD');expect(reply.body).toContain('OPEN');expect(reply.body).toContain('No money has been collected');}
  expect(f.comments.filter(c=>c.body?.includes('gitpay:bounty:'))).toHaveLength(1);
 }finally{clock.mockRestore();await f.close();}
});
