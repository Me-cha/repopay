import { expect,it } from 'vitest';
import { eq } from 'drizzle-orm';
import { captureFixture } from '../helpers/funding.js';
import { fundingAttempts,bounties,bountyActivity } from '../../src/db/schema.js';
import { createFunding } from '../../src/settlement/funding.js';
import { handleJob } from '../../src/jobs/runner.js';
import { claimJob,finishJob } from '../../src/jobs/queue.js';
import { parseCommand } from '../../src/github/commands.js';
it('new worker resumes a due attempt; funded activity is durable and projection preserves financial holds',async()=>{
 const f=await captureFixture();try {
  await f.service.reconcile(f.attempt.id);f.order.status='APPROVED';f.advance(120000);
  const restarted=createFunding(f.database,f.env,f.api,f.clock);await restarted.tick();expect((await f.getBounty()).status).toBe('FUNDED');
  expect((await f.database.orm.select().from(bountyActivity)).filter(a=>a.action==='funded')).toHaveLength(1);
  await f.database.orm.update(bounties).set({fundingHold:true,needsAttention:true,attentionReason:'Provider reversal'});
  const job=await claimJob(f.database,'projection',120);if(!job)throw new Error('missing projection');
  await handleJob(f.database,f.githubApi,f.env,job);await finishJob(f.database,job);
  expect((await f.getBounty()).needsAttention).toBe(true);expect(f.comments[0]?.body).toContain('FUNDED');expect(f.comments[0]?.body).toContain('first qualifying');expect(f.comments[0]?.body).not.toContain('Review cancellation');
 }finally{await f.close();}
});
it('stale approved order cannot capture for a newer attempt; funded cancellation remains blocked',async()=>{
 const f=await captureFixture();try {
  await f.service.reconcile(f.attempt.id);f.order.status='APPROVED';
  await f.database.orm.update(fundingAttempts).set({active:false,status:'VOIDED'});await f.database.orm.update(bounties).set({currentFundingAttemptId:null});
  await f.service.reconcile(f.attempt.id);expect(f.api.captureOrder).not.toHaveBeenCalled();
  await f.database.orm.update(bounties).set({status:'FUNDED'});expect((await f.request(`/bounties/${f.bounty.id}/cancel`)).status).toBe(409);
 }finally{await f.close();}
});
it('fund command offers confirmation only; a status command schedules existing-attempt reconciliation',async()=>{
 const f=await captureFixture();try {
  expect(parseCommand('/bounty fund')).toEqual({kind:'fund'});
  const fund=await f.job({kind:'run_command',installationId:'1',repoId:'2',issueNumber:12,actorId:'4',commentId:'42',command:{kind:'fund'}});
  await handleJob(f.database,f.githubApi,f.env,fund);await finishJob(f.database,fund);expect(f.comments[0]?.body).toContain(`/bounties/${f.bounty.id}/fund`);expect(f.api.createOrder).not.toHaveBeenCalled();
  const status=await f.job({kind:'run_command',installationId:'1',repoId:'2',issueNumber:12,actorId:'4',commentId:'43',command:{kind:'status'}});
  await handleJob(f.database,f.githubApi,f.env,status);await finishJob(f.database,status);
  // The due attempt survives regardless of which ordinary job is claimed first.
  const stored=await f.get();expect(stored.id).toBe(f.attempt.id);
  await f.database.orm.update(fundingAttempts).set({nextReconcileAt:new Date(0)}).where(eq(fundingAttempts.id,stored.id));await f.service.tick();expect(f.api.createOrder).toHaveBeenCalledTimes(1);
 }finally{await f.close();}
});
