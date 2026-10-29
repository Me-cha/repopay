import { expect,it } from 'vitest';
import { eq,sql } from 'drizzle-orm';
import { authFixture,csrfFrom,form,prepare } from '../helpers/auth.js';
import { bounties,actionTokens } from '../../src/db/schema.js';
import { parseCommand } from '../../src/github/commands.js';
import { githubFixture,createWork,testEnv } from '../helpers/github.js';
import { handleJob } from '../../src/jobs/runner.js';
import { finishJob,claimJob } from '../../src/jobs/queue.js';
it.each([{status:'FUNDED'}, {status:'CAPTURING'}, {captureRequestKey:'reserved-unknown'}, {captureId:'captured'}, {fundedAt:new Date()}])('blocks cancellation for funding or reserved capture %j',async values=>{
 const f=await authFixture();try{
 const link=await prepare(f),csrf=csrfFrom(await(await f.request(link)).text());await f.database.orm.update(bounties).set(values);
 expect((await f.request(link,form(csrf))).status).toBe(409);expect((await f.database.orm.select().from(actionTokens))[0]?.usedAt).toBeNull();
 }finally{await f.close();}
});
it('capture reservation and cancellation serialize under the same bounty row lock',async()=>{
 const f=await authFixture();try{
 const link=await prepare(f),csrf=csrfFrom(await(await f.request(link)).text());
 const [response,reserved]=await Promise.all([f.request(link,form(csrf)),f.database.withTransaction(async tx=>{
  const [b]=await tx.select().from(bounties).where(eq(bounties.id,f.bounty.id)).for('update');if(b?.status!=='OPEN')return false;
  await tx.update(bounties).set({status:'CAPTURING',captureRequestKey:'reserved',version:sql`${bounties.version}+1`}).where(eq(bounties.id,b.id));return true;
 })]);
 const [final]=await f.database.orm.select().from(bounties);expect([303,409]).toContain(response.status);
 expect(final?.status).toBe(reserved?'CAPTURING':'CANCELLED');expect(response.status===303).toBe(!reserved);
 }finally{await f.close();}
});
it('cancel command produces a preview link without cancelling; cancelled projection explains no refund',async()=>{
 expect(parseCommand('/bounty cancel')).toEqual({kind:'cancel'});
 const f=await githubFixture();try{
 const create=await f.job(createWork());await handleJob(f.database,f.api,testEnv,create);await finishJob(f.database,create);
 const sync=await claimJob(f.database,'sync',120);if(!sync)throw new Error('missing');await handleJob(f.database,f.api,testEnv,sync);await finishJob(f.database,sync);
 const cancel=await f.job(createWork({commentId:'20',command:{kind:'cancel'}}));await handleJob(f.database,f.api,testEnv,cancel);await finishJob(f.database,cancel);
 const [bounty]=await f.database.orm.select().from(bounties);if(!bounty)throw new Error('missing bounty');expect(bounty.status).toBe('OPEN');expect(f.comments.some(c=>c.body?.includes(`/bounties/${bounty.id}/cancel`))).toBe(true);
 await f.database.orm.update(bounties).set({status:'CANCELLED'});
 const projection=await f.job({kind:'sync_bounty',bountyId:bounty.id});await handleJob(f.database,f.api,testEnv,projection);
 const body=f.comments.find(c=>c.body?.includes('gitpay:bounty:'))?.body;expect(body).toContain('CANCELLED');expect(body).toContain('No payment or refund');expect(body).not.toContain('Review cancellation');
 }finally{await f.close();}
});
