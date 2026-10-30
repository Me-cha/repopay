import { expect,it } from 'vitest';
import { authFixture,csrfFrom,form,required } from '../helpers/auth.js';
import { fundingEnv } from '../helpers/funding.js';
import { bounties,fundingAttempts,actionTokens } from '../../src/db/schema.js';
it('requires current write access on submit, binds displayed terms, and GET never creates or captures',async()=>{
 const f=await authFixture(undefined,fundingEnv());try {
  const path=`/bounties/${f.bounty.id}/fund`;const page=await f.request(path);expect(page.status).toBe(200);const html=await page.text();expect(html).toContain('Must reject invalid input');
  expect(await f.database.orm.select().from(fundingAttempts)).toHaveLength(0);expect(await f.database.orm.select().from(actionTokens)).toHaveLength(0);
  const hash=required(/name="termsHash" value="([a-f0-9]+)"/.exec(html)?.[1]);
  expect((await f.request(path,form(csrfFrom(html),{termsHash:'0'.repeat(64)}))).status).toBe(409);
  const prepared=await f.request(path,form(csrfFrom(html),{termsHash:hash}));expect(prepared.status).toBe(303);
  const link=required(prepared.headers.get('location'));const confirm=await f.request(link);expect(confirm.status).toBe(200);
  f.permissions.write=false;expect((await f.request(link,form(csrfFrom(await confirm.text())))).status).toBe(403);
  expect(await f.database.orm.select().from(fundingAttempts)).toHaveLength(0);
  f.permissions.write=true;const csrf=csrfFrom(await(await f.request(link)).text());expect((await f.request(link,form(csrf))).status).toBe(303);
  const a=required((await f.database.orm.select().from(fundingAttempts))[0]);expect(a.orderSubmissionBoundaryAt).toBeNull();expect(a.terms.criteria).toBe('Must reject invalid input');
 }finally{await f.close();}
});
it('return token must match the scoped attempt; cancel truthfully reads stored state without mutation',async()=>{
 const f=await authFixture(undefined,fundingEnv());try {
  const path=`/bounties/${f.bounty.id}/fund`;const html=await(await f.request(path)).text();
  const prepared=await f.request(path,form(csrfFrom(html),{termsHash:required(/name="termsHash" value="([a-f0-9]+)"/.exec(html)?.[1])}));const link=required(prepared.headers.get('location'));
  const confirmed=await f.request(link,form(csrfFrom(await(await f.request(link)).text())));expect(confirmed.status).toBe(303);
  const a=required((await f.database.orm.select().from(fundingAttempts))[0]);await f.database.orm.update(fundingAttempts).set({orderId:'ORDER123',status:'CREATED',approvalUrl:'https://www.sandbox.paypal.com/checkoutnow?token=ORDER123'});
  const target=`/bounties/${f.bounty.id}/funding/${a.id}`;
  expect((await f.request(target+'/return?token=OTHER')).status).toBe(400);
  expect((await f.request(target+'/return?token=ORDER123')).status).toBe(200);
  const cancelled=await f.request(target+'/cancel?token=ORDER123');expect(cancelled.status).toBe(200);expect(await cancelled.text()).toContain('does not prove');
  expect(required((await f.database.orm.select().from(bounties))[0]).status).toBe('OPEN');expect(required((await f.database.orm.select().from(fundingAttempts))[0]).captureSubmissionBoundaryAt).toBeNull();
  f.permissions.read=false;expect((await f.request(target)).status).toBe(403);
 }finally{await f.close();}
});
it('read-only contributors can follow the published funding link to frozen criteria but cannot prepare funding',async()=>{
 const f=await authFixture(undefined,fundingEnv());try{
  const path=`/bounties/${f.bounty.id}/fund`,html=await(await f.request(path)).text(),csrf=csrfFrom(html),hash=required(/name="termsHash" value="([a-f0-9]+)"/.exec(html)?.[1]);
  const prepared=await f.request(path,form(csrf,{termsHash:hash})),link=required(prepared.headers.get('location'));
  await f.request(link,form(csrfFrom(await(await f.request(link)).text())));await f.database.orm.update(bounties).set({status:'FUNDED'});
  f.permissions.write=false;const entry=await f.request(path);expect(entry.status).toBe(303);
  const terms=await f.request(required(entry.headers.get('location')));expect(terms.status).toBe(200);expect(await terms.text()).toContain('Must reject invalid input');
  expect((await f.request(path,form(csrf,{termsHash:hash}))).status).toBe(403);
 }finally{await f.close();}
});
