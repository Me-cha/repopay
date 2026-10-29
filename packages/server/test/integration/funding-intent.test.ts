import { expect,it } from 'vitest';
import { eq } from 'drizzle-orm';
import { required } from '../helpers/auth.js';
import { makeTerms } from '../../src/domain/funded-terms.js';
import { prepareFunding,confirmFunding } from '../../src/actions/fund.js';
import { fundingAttempts,bounties } from '../../src/db/schema.js';
import { intentFixture } from '../helpers/funding.js';
it('snapshots exact accepted criteria and policy, stores keys, and duplicate confirmation creates one attempt',async()=>{
 const f=await intentFixture();try {
  expect(f.terms).toMatchObject({version:3,policy:{provider:'copilot',model:'test-model',sdkVersion:'1.0.28'},sponsor:{kind:'user',id:'4',login:'maintainer'}});
  const token=await f.prepare();const results=await Promise.allSettled([confirmFunding(f.database,f.env,f.session,f.ctx,token),confirmFunding(f.database,f.env,f.session,f.ctx,token)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const attempts=await f.database.orm.select().from(fundingAttempts);expect(attempts).toHaveLength(1);
  const attempt=required(attempts[0]);expect(attempt.terms).toEqual(f.terms);expect(attempt.actorGhId).toBe(f.session.ghId);
  expect(attempt.orderRequestKey).not.toBe(attempt.captureRequestKey);expect(attempt.orderId).toBeNull();
  f.terms.criteria='Edited after confirmation';expect(required((await f.database.orm.select().from(fundingAttempts))[0]).terms.criteria).toBe('Must reject invalid input');
 }finally{await f.close();}
});
it('pending or unknown attempts cannot be replaced; a resolved terminal attempt retains history',async()=>{
 const f=await intentFixture();try {
  const first=await f.start();await expect(f.prepare()).rejects.toThrow(/existing|changed/i);
  await f.database.orm.update(fundingAttempts).set({active:false,status:'VOIDED'}).where(eq(fundingAttempts.id,first.id));
  const bounty=required((await f.database.orm.select().from(bounties))[0]);
  const token=await prepareFunding(f.database,f.env,f.session,f.ctx,bounty,f.terms);await confirmFunding(f.database,f.env,f.session,f.ctx,token);
  expect(await f.database.orm.select().from(fundingAttempts)).toHaveLength(2);
 }finally{await f.close();}
});
it('blocks funding without trusted CI policy or receiver and rejects stale terms/permission context',async()=>{
 const f=await intentFixture();try {
  expect(()=>makeTerms({...f.env,COPILOT_MODEL:''},f.bounty,{title:'Fix',body:'criteria',updatedAt:'now'})).toThrow(/model/i);
  expect(()=>makeTerms({...f.env,POLICY_CI_CONTEXTS:{}},f.bounty,{title:'Fix',body:'criteria',updatedAt:'now'})).toThrow(/CI/);
  expect(()=>makeTerms({...f.env,PP_MERCHANT_ID:''},f.bounty,{title:'Fix',body:'criteria',updatedAt:'now'})).toThrow(/merchant/i);
  const token=await f.prepare();await f.database.orm.update(bounties).set({version:1});
  await expect(confirmFunding(f.database,f.env,f.session,f.ctx,token)).rejects.toThrow(/changed/);
  expect(await f.database.orm.select().from(fundingAttempts)).toHaveLength(0);
 }finally{await f.close();}
});
