import { expect,it } from 'vitest';
import { eq } from 'drizzle-orm';
import { authFixture,csrfFrom,form,required } from '../helpers/auth.js';
import { fundingEnv } from '../helpers/funding.js';
import { bounties,submissions,jobs } from '../../src/db/schema.js';
it('a failed job before a verification row can be retried, while duplicate POSTs enqueue once',async()=>{
 const f=await authFixture(undefined,fundingEnv());try{
  await f.database.orm.update(bounties).set({status:'FUNDED'}).where(eq(bounties.id,f.bounty.id));
  const sub=required((await f.database.orm.insert(submissions).values({bountyId:f.bounty.id,repoId:'2',prId:'501',prNumber:41,authorGhId:'8',authorLogin:'contributor',headSha:'a'.repeat(40),baseSha:'b'.repeat(40)}).returning())[0]);
  const path=`/submissions/${sub.id}/retry`;
  const body=async()=>{const html=await(await f.request(path)).text();return form(csrfFrom(html),{headSha:sub.headSha,retryVersion:/name="retryVersion" value="(\d+)"/.exec(html)?.[1]??'0'});};
  const first=await body();await Promise.all([f.request(path,first),f.request(path,first)]);
  expect(await f.database.orm.select().from(jobs)).toHaveLength(1);
  await f.database.orm.update(jobs).set({status:'failed'});
  expect((await f.request(path,await body())).status).toBe(303);
  expect(await f.database.orm.select().from(jobs)).toHaveLength(2);
 }finally{await f.close();}
});
