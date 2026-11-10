import { expect,it,vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { captureFixture,intentFixture,fundingEnv } from '../helpers/funding.js';
import { authFixture,csrfFrom,form,required } from '../helpers/auth.js';
import { fundingAttempts,actionTokens,bounties,bountyActivity,jobs } from '../../src/db/schema.js';
import { makeTerms } from '../../src/domain/funded-terms.js';
import { prepareFunding,confirmFunding } from '../../src/actions/fund.js';
import { cancelDraft } from '../../src/actions/cancel.js';
import { createPayPalIntake } from '../../src/paypal/webhooks.js';
import type { FundingPayment } from '../../src/domain/funding-payment.js';
const payment:FundingPayment={method:'crypto',buyer:{givenName:'SandboxFirst',surname:'SandboxLast',countryCode:'US'}};
const complete={id:'CAPTURE123',status:'COMPLETED',amountCents:5000,currency:'USD',finalCapture:true};
it('freezes encrypted buyer details, rejects duplicate confirmation and prevents method switching',async()=>{
 const f=await intentFixture(payment);try{
  const token=await f.prepare();const pending=await f.database.orm.select().from(actionTokens);
  expect(JSON.stringify(pending)).not.toContain('SandboxFirst');
  const results=await Promise.allSettled([confirmFunding(f.database,f.env,f.session,f.ctx,token),confirmFunding(f.database,f.env,f.session,f.ctx,token)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const attempts=await f.database.orm.select().from(fundingAttempts);expect(attempts).toHaveLength(1);
  expect(attempts[0]?.paymentMethod).toBe('crypto');expect(JSON.stringify(attempts)).not.toContain('SandboxFirst');
  await expect(f.database.orm.update(fundingAttempts).set({paymentMethod:'paypal',buyerNameEnc:null})).rejects.toThrow();
 }finally{await f.close();}
});
it('disabled crypto cannot prepare or confirm new checkout',async()=>{
 const f=await intentFixture(payment);try{
  f.env.PP_CRYPTO_ENABLED=false;await expect(f.prepare()).rejects.toThrow(/not enabled/);
  f.env.PP_CRYPTO_ENABLED=true;const token=await f.prepare();f.env.PP_CRYPTO_ENABLED=false;
  await expect(confirmFunding(f.database,f.env,f.session,f.ctx,token)).rejects.toThrow(/not enabled/);
  expect(await f.database.orm.select().from(fundingAttempts)).toHaveLength(0);
 }finally{await f.close();}
});
it('auto-capture reserves before creation, blocks cancellation, and confirms once without a capture POST',async()=>{
 const f=await captureFixture(payment);try{
  vi.mocked(f.api.createOrder).mockImplementation(async input=>{
   expect(input.cryptoBuyer).toEqual(payment.buyer);
   expect((await f.getBounty()).captureRequestKey).toBe(f.attempt.captureRequestKey);
   return structuredClone(f.order);
  });
  await f.service.reconcile(f.attempt.id);
  const b=await f.getBounty();
  await expect(f.database.withTransaction(tx=>cancelDraft(tx,{...f.ctx,authorization:{...f.ctx.authorization,action:'cancel_draft'}},b.id,b.version))).rejects.toThrow(/cannot be cancelled/);
  f.order.status='APPROVED';await f.service.reconcile(f.attempt.id);
  expect(f.api.captureOrder).not.toHaveBeenCalled();expect((await f.getBounty()).fundedAt).toBeNull();
  f.order.status='COMPLETED';f.order.captures=[complete];
  await Promise.all([f.service.reconcile(f.attempt.id),f.service.reconcile(f.attempt.id)]);
  await f.service.reconcile(f.attempt.id);
  expect((await f.getBounty()).status).toBe('FUNDED');expect(f.api.captureOrder).not.toHaveBeenCalled();
  expect(await f.database.orm.select().from(bountyActivity).where(eq(bountyActivity.action,'funded'))).toHaveLength(1);
 }finally{await f.close();}
});
it('lost crypto create response retains the request key and cancellation fence even after disabling new checkout',async()=>{
 const f=await captureFixture(payment);try{
  vi.mocked(f.api.createOrder).mockRejectedValueOnce(new Error('Response lost'));
  await f.service.reconcile(f.attempt.id);
  expect((await f.getBounty()).captureRequestKey).toBe(f.attempt.captureRequestKey);
  await expect(f.prepare()).rejects.toThrow();
  f.env.PP_CRYPTO_ENABLED=false;
  await f.service.reconcile(f.attempt.id);
  const calls=vi.mocked(f.api.createOrder).mock.calls;expect(calls).toHaveLength(2);expect(calls[0]?.[1]).toBe(calls[1]?.[1]);expect(calls[0]?.[0]).toEqual(calls[1]?.[0]);
  f.order.status='COMPLETED';f.order.captures=[complete];await f.service.reconcile(f.attempt.id);
  expect((await f.getBounty()).status).toBe('FUNDED');expect(f.api.captureOrder).not.toHaveBeenCalled();
 }finally{await f.close();}
});
it.each(['PENDING','DECLINED','UNKNOWN'])('crypto %s capture cannot fund or allow replacement',async status=>{
 const f=await captureFixture(payment);try{
  await f.service.reconcile(f.attempt.id);f.order.captures=[{...complete,status}];await f.service.reconcile(f.attempt.id);
  expect((await f.getBounty()).fundedAt).toBeNull();await expect(f.prepare()).rejects.toThrow();expect(f.api.captureOrder).not.toHaveBeenCalled();
 }finally{await f.close();}
});
it('crypto capture mismatches hold funds and a verified void releases the unused order fence',async()=>{
 const f=await captureFixture(payment);try{
  await f.service.reconcile(f.attempt.id);f.order.status='VOIDED';await f.service.reconcile(f.attempt.id);
  expect((await f.get()).active).toBe(false);expect((await f.getBounty()).captureRequestKey).toBeNull();
 }finally{await f.close();}
 const f2=await captureFixture(payment);try{
  await f2.service.reconcile(f2.attempt.id);f2.order.captures=[{...complete,amountCents:1}];await f2.service.reconcile(f2.attempt.id);
  expect((await f2.getBounty()).fundingHold).toBe(true);expect((await f2.getBounty()).fundedAt).toBeNull();
 }finally{await f2.close();}
});
it('checkout presents crypto disclosure, validates buyer inputs and preserves USD terms',async()=>{
 const env={...fundingEnv(),PP_CRYPTO_ENABLED:true},f=await authFixture(undefined,env);try{
  const path=`/bounties/${f.bounty.id}/fund`,html=await(await f.request(path)).text();expect(html).toContain('Continue with crypto');expect(html).toContain('PYUSD');
  const params={termsHash:required(/name="termsHash" value="([a-f0-9]+)"/.exec(html)?.[1]),paymentMethod:'crypto',givenName:'SandboxFirst',surname:'SandboxLast',countryCode:'US'};
  expect((await f.request(path,form(csrfFrom(html),{...params,givenName:''}))).status).toBe(400);
  expect((await f.request(path,form(csrfFrom(html),{...params,countryCode:'IN'}))).status).toBe(400);
  const prepared=await f.request(path,form(csrfFrom(html),params));expect(prepared.status).toBe(303);
  const url=required(prepared.headers.get('location')),confirmation=await(await f.request(url)).text();expect(confirmation).toContain('PYUSD');
  expect((await f.request(url,form(csrfFrom(confirmation)))).status).toBe(303);
  const saved=required((await f.database.orm.select().from(fundingAttempts))[0]);expect(saved).toMatchObject({paymentMethod:'crypto',currency:'USD',amountCents:5000});
  expect(JSON.stringify(saved)).not.toContain('SandboxFirst');
  const status=`/bounties/${f.bounty.id}/funding/${saved.id}`;
  await f.database.orm.update(fundingAttempts).set({orderId:'ORDER123',status:'CREATED',approvalUrl:'https://www.sandbox.paypal.com/checkoutnow?token=ORDER123'});
  expect(await(await f.request(status)).text()).toContain('PayPal Crypto Sandbox');
  expect((await f.request(status+'/return?token=FOREIGN')).status).toBe(400);
  await f.request(status+'/cancel?token=ORDER123');expect((await f.database.orm.select().from(bounties))[0]?.status).toBe('OPEN');
 }finally{await f.close();}
});
it('signed crypto webhook with only an up link queues a bound read, never directly confirms funds',async()=>{
 const f=await captureFixture(payment);try{
  await f.service.reconcile(f.attempt.id);
  const intake=createPayPalIntake(f.database,f.env,()=>Promise.resolve(true));
  const headers={transmissionId:'t',transmissionTime:'2026-11-10T00:00:00Z',certUrl:'https://api.sandbox.paypal.com/v1/notifications/certs/CERT',authAlgo:'SHA256withRSA',transmissionSig:'signature'};
  const event=(id:string,href:string)=>Buffer.from(JSON.stringify({id,event_type:'PAYMENT.CAPTURE.COMPLETED',resource:{id:'CAPTURE123',links:[{rel:'up',href}]}}));
  await intake(event('BAD','https://evil.test/v2/checkout/orders/ORDER123'),headers);
  expect(await f.database.orm.select().from(jobs).where(eq(jobs.kind,'reconcile_funding'))).toHaveLength(0);
  const good=event('GOOD',f.env.PP_BASE+'/v2/checkout/orders/ORDER123');await intake(good,headers);await intake(good,headers);
  expect(await f.database.orm.select().from(jobs).where(eq(jobs.kind,'reconcile_funding'))).toHaveLength(1);expect((await f.getBounty()).fundedAt).toBeNull();
 }finally{await f.close();}
});
it('crypto terms cannot enable funded cancellation and an expired create retry never releases the reservation',async()=>{
 const f=await intentFixture(payment);try{
  const env={...f.env,COPILOT_MODEL:'auto',FUNDED_CANCELLATION_ENABLED:true,CANCELLATION_SANDBOX_REPO_ID:f.bounty.repoId,CANCELLATION_OPERATOR_GH_IDS:['123']};
  const terms=makeTerms(env,f.bounty,{title:'Fix',body:'Criteria',updatedAt:'now'},{sponsorGhId:'4',sponsorLogin:'maintainer',modelId:'auto',revokedAt:null});
  expect(terms.version).toBe(5);
  await expect(prepareFunding(f.database,env,f.session,f.ctx,f.bounty,terms,()=>new Date(),payment)).rejects.toThrow(/funded-cancellation/);expect(await f.database.orm.select().from(actionTokens)).toHaveLength(0);
 }finally{await f.close();}
 const c=await captureFixture(payment);try{
  vi.mocked(c.api.createOrder).mockRejectedValueOnce(new Error('lost response'));await c.service.reconcile(c.attempt.id);
  c.advance((c.env.PP_SAFE_RETRY_SEC+1)*1000);await c.service.reconcile(c.attempt.id);
  expect(c.api.createOrder).toHaveBeenCalledTimes(1);expect((await c.getBounty()).captureRequestKey).toBe(c.attempt.captureRequestKey);
  expect((await c.get()).attention).toContain('outcome unknown');
 }finally{await c.close();}
});
