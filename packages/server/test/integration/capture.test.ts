import { expect,it,vi } from 'vitest';
import nock from 'nock';
import { createOrders } from '../../src/paypal/orders.js';
import { eq,sql } from 'drizzle-orm';
import { required } from '../helpers/auth.js';
import { bounties,fundingAttempts } from '../../src/db/schema.js';
import { cancelDraft } from '../../src/actions/cancel.js';
import { captureFixture as fixture } from '../helpers/funding.js';
it.each(['gitpay','repopay'])('reconciles an existing %s order without changing payment identity',async prefix=>{
 const f=await fixture();try{
  // Simulate a saved order made before or after the display-name rebrand.
  await f.database.orm.update(fundingAttempts).set({orderId:f.order.id}).where(eq(fundingAttempts.id,f.attempt.id));
  f.order.reference=`${prefix}:${f.attempt.id}`;f.order.status='COMPLETED';
  f.order.captures=[{id:'CAPTURE123',status:'COMPLETED',amountCents:5000,currency:'USD',finalCapture:true}];
  await f.service.reconcile(f.attempt.id);await f.service.reconcile(f.attempt.id);
  const b=await f.getBounty(),a=await f.get();
  expect(b.status).toBe('FUNDED');expect(b.fundingHold).toBe(false);
  expect(b.captureId).toBe('CAPTURE123');expect(b.fundedTerms).toEqual(f.terms);
  expect(a.orderId).toBe(f.order.id);expect(a.orderRequestKey).toBe(f.attempt.orderRequestKey);expect(a.captureRequestKey).toBe(f.attempt.captureRequestKey);
  expect(f.api.createOrder).not.toHaveBeenCalled();expect(f.api.captureOrder).not.toHaveBeenCalled();
 }finally{await f.close();}
});
it.each(['gitpay:other','repopay:other','unknown:1'])('rejects a foreign reference %s on a saved order',async reference=>{
 const f=await fixture();try{
  await f.database.orm.update(fundingAttempts).set({orderId:f.order.id}).where(eq(fundingAttempts.id,f.attempt.id));
  f.order.reference=reference;await f.service.reconcile(f.attempt.id);
  expect((await f.getBounty()).fundingHold).toBe(true);expect(f.api.captureOrder).not.toHaveBeenCalled();
 }finally{await f.close();}
});
it('does not clear an existing funding hold merely because a legacy order now validates',async()=>{
 const f=await fixture();try{
  await f.database.orm.update(fundingAttempts).set({orderId:f.order.id,captureId:'CAPTURE123',status:'HOLD'}).where(eq(fundingAttempts.id,f.attempt.id));
  await f.database.orm.update(bounties).set({status:'FUNDED',captureId:'CAPTURE123',fundedAt:new Date(),fundingHold:true,needsAttention:true,attentionReason:'Provider amount, receiver or reference mismatch; investigate before continuing'}).where(eq(bounties.id,f.bounty.id));
  f.order.reference=`gitpay:${f.attempt.id}`;f.order.status='COMPLETED';f.order.captures=[{id:'CAPTURE123',status:'COMPLETED',amountCents:5000,currency:'USD',finalCapture:true}];
  await f.service.reconcile(f.attempt.id);
  expect((await f.getBounty()).fundingHold).toBe(true);expect((await f.get()).status).toBe('HOLD');
  expect(f.api.createOrder).not.toHaveBeenCalled();expect(f.api.captureOrder).not.toHaveBeenCalled();
 }finally{await f.close();}
});
it.each(['unbound','order','terms','merchant','amount','currency','capture'])('legacy reference compatibility retains the %s guard',async mismatch=>{
 const f=await fixture();try{
  if(mismatch!=='unbound')await f.database.orm.update(fundingAttempts).set({orderId:mismatch==='order'?'OTHERORDER':f.order.id,...(mismatch==='capture'?{captureId:'OTHERCAPTURE'}:{})}).where(eq(fundingAttempts.id,f.attempt.id));
  f.order.reference=`gitpay:${f.attempt.id}`;f.order.status='COMPLETED';f.order.captures=[{id:'CAPTURE123',status:'COMPLETED',amountCents:5000,currency:'USD',finalCapture:true}];
  if(mismatch==='terms')f.order.customId='other-terms';
  if(mismatch==='merchant')f.order.merchantId='OTHER';
  if(mismatch==='amount')f.order.amountCents=1;
  if(mismatch==='currency')f.order.currency='EUR';
  await f.service.reconcile(f.attempt.id);
  expect((await f.getBounty()).fundingHold).toBe(true);expect((await f.getBounty()).status).not.toBe('FUNDED');expect(f.api.captureOrder).not.toHaveBeenCalled();
 }finally{await f.close();}
});
it('polling captures without a browser return or webhook; concurrent reconciliation captures once',async()=>{
 const f=await fixture();try{
  await f.service.reconcile(f.attempt.id);f.order.status='APPROVED';
  await Promise.all([f.service.reconcile(f.attempt.id),f.service.reconcile(f.attempt.id)]);
  expect(f.api.captureOrder).toHaveBeenCalledTimes(1);expect((await f.getBounty()).status).toBe('FUNDED');
  expect((await f.getBounty()).fundingActorGhId).toBe(f.session.ghId);expect((await f.get()).status).toBe('COMPLETED');
 }finally{await f.close();}
});
it('crash after capture POST reconciles via reads and never sends a second capture',async()=>{
 const f=await fixture();try{
  await f.service.reconcile(f.attempt.id);f.order.status='APPROVED';
  vi.mocked(f.api.captureOrder).mockImplementationOnce(()=>{f.order.status='COMPLETED';f.order.captures=[{id:'CAPTURE123',status:'COMPLETED',amountCents:5000,currency:'USD',finalCapture:true}];return Promise.reject(new Error('response lost'));});
  await f.service.reconcile(f.attempt.id);expect((await f.getBounty()).status).toBe('CAPTURING');
  await f.service.reconcile(f.attempt.id);expect((await f.getBounty()).status).toBe('FUNDED');expect(f.api.captureOrder).toHaveBeenCalledTimes(1);
 }finally{await f.close();}
});
it.each(['PENDING','DECLINED','UNRECOGNIZED'])('%s capture never becomes funded or allows replacement',async status=>{
 const f=await fixture();try{
  await f.service.reconcile(f.attempt.id);f.order.status='COMPLETED';f.order.captures=[{id:'CAPTURE123',status,amountCents:5000,currency:'USD',finalCapture:true}];
  await f.service.reconcile(f.attempt.id);expect((await f.getBounty()).status).not.toBe('FUNDED');expect((await f.get()).active).toBe(true);
 }finally{await f.close();}
});
it('expired create/capture retry windows prohibit further POST, including the same key',async()=>{
 const f=await fixture();try{
  vi.mocked(f.api.createOrder).mockRejectedValue(new Error('unknown'));await f.service.reconcile(f.attempt.id);
  f.advance((f.env.PP_SAFE_RETRY_SEC+1)*1000);await f.service.reconcile(f.attempt.id);expect(f.api.createOrder).toHaveBeenCalledTimes(1);expect((await f.get()).active).toBe(true);
  // A recovered known order may be read, but a past capture boundary must not be retried.
  await f.database.orm.update(fundingAttempts).set({orderId:f.order.id,captureSubmissionBoundaryAt:new Date(0),captureSafeRetryUntil:new Date(1)});
  f.order.status='APPROVED';await f.service.reconcile(f.attempt.id);expect(f.api.captureOrder).not.toHaveBeenCalled();
 }finally{await f.close();}
});
it.each(['amount','merchant','reference','multiple'])('holds mismatched %s capture evidence',async mismatch=>{
 const f=await fixture();try{
  await f.service.reconcile(f.attempt.id);f.order.status='COMPLETED';f.order.captures=[{id:'CAPTURE123',status:'COMPLETED',amountCents:5000,currency:'USD',finalCapture:true}];
  if(mismatch==='amount')required(f.order.captures[0]).amountCents=4999;
  if(mismatch==='merchant')f.order.merchantId='OTHER';if(mismatch==='reference')f.order.reference='other';
  if(mismatch==='multiple')f.order.captures.push({...required(f.order.captures[0]),id:'CAPTURE456'});
  await f.service.reconcile(f.attempt.id);expect((await f.getBounty()).status).not.toBe('FUNDED');expect((await f.getBounty()).fundingHold).toBe(true);
 }finally{await f.close();}
});
it('external refund freezes funded bounty, preserves capture and terms, and stale pending cannot downgrade',async()=>{
 const f=await fixture();try{
  await f.service.reconcile(f.attempt.id);f.order.status='APPROVED';await f.service.reconcile(f.attempt.id);
  required(f.order.captures[0]).status='PENDING';await f.service.reconcile(f.attempt.id);expect((await f.getBounty()).status).toBe('FUNDED');
  required(f.order.captures[0]).status='REFUNDED';await f.service.reconcile(f.attempt.id);const b=await f.getBounty();
  expect(b.status).toBe('FUNDED');expect(b.fundingHold).toBe(true);expect(b.captureId).toBe('CAPTURE123');expect(b.fundedTerms).toEqual(f.terms);
 }finally{await f.close();}
});
it('cancellation and capture reservation share the bounty lock; only one wins',async()=>{
 const f=await fixture();try{
  await f.service.reconcile(f.attempt.id);f.order.status='APPROVED';const b=await f.getBounty();
  await Promise.allSettled([f.service.reconcile(f.attempt.id),f.database.withTransaction(tx=>cancelDraft(tx,{...f.ctx,authorization:{...f.ctx.authorization,action:'cancel_draft'}},b.id,b.version))]);
  const final=await f.getBounty();expect(['CANCELLED','FUNDED']).toContain(final.status);expect(vi.mocked(f.api.captureOrder).mock.calls.length).toBe(final.status==='FUNDED'?1:0);
 }finally{await f.close();}
});
it('observation fencing rejects an old approved read after a newer result commits',async()=>{
 const f=await fixture();try{
  await f.service.reconcile(f.attempt.id);f.order.status='APPROVED';
  let release!:()=>void,entered!:()=>void;
  const started=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
  vi.mocked(f.api.getOrder).mockImplementationOnce(async()=>{entered();await gate;return structuredClone(f.order);});
  const pending=f.service.reconcile(f.attempt.id);await started;
  await f.database.orm.update(fundingAttempts).set({observationVersion:sql`${fundingAttempts.observationVersion}+1`,status:'COMPLETED'}).where(eq(fundingAttempts.id,f.attempt.id));
  await f.database.orm.update(bounties).set({status:'FUNDED',captureId:'NEWCAPTURE'});release();await pending;
  expect((await f.getBounty()).status).toBe('FUNDED');expect((await f.get()).status).toBe('COMPLETED');expect(f.api.captureOrder).not.toHaveBeenCalled();
 }finally{await f.close();}
});
it('unknown capture status after funding preserves funding but freezes disbursement',async()=>{
 const f=await fixture();try{
  await f.service.reconcile(f.attempt.id);f.order.status='APPROVED';await f.service.reconcile(f.attempt.id);
  required(f.order.captures[0]).status='NEW_UNDOCUMENTED_STATUS';await f.service.reconcile(f.attempt.id);
  expect((await f.getBounty()).status).toBe('FUNDED');expect((await f.getBounty()).fundingHold).toBe(true);
 }finally{await f.close();}
});
it('lost create response retries the saved payload even after public origin changes',async()=>{
 const f=await fixture();try{
  vi.mocked(f.api.createOrder).mockRejectedValueOnce(new Error('lost create response'));
  await f.service.reconcile(f.attempt.id);f.env.PUBLIC_URL='https://new-tunnel.test';await f.service.reconcile(f.attempt.id);
  const calls=vi.mocked(f.api.createOrder).mock.calls;expect(calls).toHaveLength(2);expect(calls[1]?.[0]).toEqual(calls[0]?.[0]);expect(calls[1]?.[1]).toBe(calls[0]?.[1]);
 }finally{await f.close();}
});
it.each(['additional','missing','different'])('post-funding %s capture evidence freezes disbursement and preserves history',async shape=>{
 const f=await fixture();try{
  await f.service.reconcile(f.attempt.id);f.order.status='APPROVED';await f.service.reconcile(f.attempt.id);
  const capture=structuredClone(required(f.order.captures[0]));vi.mocked(f.api.getCapture).mockResolvedValue(capture);
  if(shape==='additional')f.order.captures.push({...capture,id:'EXTRACAPTURE'});
  if(shape==='missing')f.order.captures=[];
  if(shape==='different')f.order.captures=[{...capture,id:'OTHER'}];
  await f.service.reconcile(f.attempt.id);const b=await f.getBounty();expect(b.status).toBe('FUNDED');expect(b.captureId).toBe(capture.id);expect(b.fundingHold).toBe(true);
 }finally{await f.close();}
});
it('malformed actual REST evidence after funding freezes disbursement',async()=>{
 const f=await fixture();try{
  await f.service.reconcile(f.attempt.id);f.order.status='APPROVED';await f.service.reconcile(f.attempt.id);
  nock(f.env.PP_BASE).post('/v1/oauth2/token').reply(200,{access_token:'test',token_type:'Bearer'}).get('/v2/checkout/orders/ORDER123').reply(200,{id:'ORDER123',status:'COMPLETED',purchase_units:[]});
  vi.mocked(f.api.getOrder).mockImplementation(id=>createOrders(f.env).getOrder(id));await f.service.reconcile(f.attempt.id);
  expect((await f.getBounty()).fundingHold).toBe(true);expect((await f.getBounty()).status).toBe('FUNDED');
 }finally{await f.close();}
});
it('discards a connection when funding lock acquisition has an unknown outcome',async()=>{
 const f=await fixture();const client=await f.database.pool.connect();
 const release=vi.spyOn(client,'release');
 vi.spyOn(client,'query').mockRejectedValueOnce(new Error('query timed out'));
 vi.spyOn(f.database.pool as {connect:()=>Promise<typeof client>},'connect').mockResolvedValueOnce(client);
 try{await expect(f.service.reconcile(f.attempt.id)).rejects.toThrow('query timed out');expect(release).toHaveBeenCalledWith(true);}
 finally{vi.restoreAllMocks();await f.close();}
});
it.each(['AWAITING_CLAIM','PAYING','PAID','NEEDS_REVIEW'])('capture polling preserves later state %s',async status=>{
 const f=await fixture();try{
  await f.service.reconcile(f.attempt.id);f.order.status='APPROVED';await f.service.reconcile(f.attempt.id);
  await f.database.orm.update(bounties).set({status}).where(eq(bounties.id,f.bounty.id));
  await f.service.reconcile(f.attempt.id);expect((await f.getBounty()).status).toBe(status);
  const cap=required(f.order.captures[0]);cap.status='PENDING';await f.service.reconcile(f.attempt.id);expect((await f.getBounty()).status).toBe(status);
 }finally{await f.close();}
});
