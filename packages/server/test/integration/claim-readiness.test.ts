import { afterEach,describe,expect,it } from 'vitest';
import { jobs } from '../../src/db/schema.js';
import { authFixture,csrfFrom,form } from '../helpers/auth.js';
import { claimJob } from '../../src/jobs/queue.js';
import { handleJob } from '../../src/jobs/runner.js';
import { testEnv } from '../helpers/github.js';

describe('claim resume readiness',()=>{
 let f:Awaited<ReturnType<typeof authFixture>>|undefined;
 afterEach(async()=>{await f?.close();f=undefined;});
 it('records a durable revision-scoped event and does not send a payout without an award',async()=>{
  f=await authFixture();const page=await f.request('/connect');await f.request('/connect',form(csrfFrom(await page.text()),{paypalEmail:'payee@example.com'}));
  const job=await claimJob(f.database,'claim-test',30);expect(job?.kind).toBe('retry_claims');if(!job)throw new Error('expected claim event');
  await handleJob(f.database,f.api,testEnv,job);expect(f.api.createComment).not.toHaveBeenCalled();
  expect((await f.database.orm.select().from(jobs)).find(row=>row.id===job.id)?.status).toBe('running');
 });
});
