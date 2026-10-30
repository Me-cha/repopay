import { eq,sql } from 'drizzle-orm';
import { expect,it,vi } from 'vitest';
import { awardFixture } from '../helpers/awards.js';
import { required } from '../helpers/auth.js';
import { awards,bounties,contributors,payoutBatches,payoutItems } from '../../src/db/schema.js';
import { createPayoutService } from '../../src/settlement/payout.js';
import type { PayoutRequest,Payouts } from '../../src/paypal/payouts.js';
import { encrypt } from '../../src/util/crypto.js';
async function setup(twoAuthors=false){
 const f=await awardFixture(twoAuthors);await f.add('501','2026-10-30T01:00:00Z');await f.service.settleBounty(f.bounty.id);
 const award=required((await f.database.orm.select().from(awards))[0]);
 let request:PayoutRequest|undefined,status='SUCCESS',now=new Date(),lost=false;
 const api:Payouts={submit:vi.fn<Payouts['submit']>((input)=>{request=input;if(lost){lost=false;return Promise.reject(new Error('response lost'));}return Promise.resolve('BATCH1');}),get:vi.fn(()=>Promise.resolve({id:'BATCH1',senderBatchId:required(request).senderBatchId,complete:true,items:required(request).items.map((i,index)=>({id:`ITEM${String(index)}`,senderItemId:i.senderItemId,email:i.email,amountCents:i.amountCents,currency:'USD',status}))}))};
 const payout=createPayoutService(f.database,f.env,api,{now:()=>now});
 const connect=async(email='first@example.com')=>{await f.database.orm.insert(contributors).values({ghId:'8',ghLogin:'author',paypalEmailEnc:encrypt(email,f.env.PAYMENT_DATA_ENC_KEY,'contributor:8:paypal-email:v1')}).onConflictDoUpdate({target:contributors.ghId,set:{paypalEmailEnc:encrypt(email,f.env.PAYMENT_DATA_ENC_KEY,'contributor:8:paypal-email:v1'),connectionVersion:2}});};
 return {...f,httpRequest:f.request,githubApi:f.api,award,api,payout,connect,setStatus:(value:string)=>{status=value;},lose:()=>{lost=true;},advance:(ms:number)=>{now=new Date(now.getTime()+ms);},request:()=>required(request)};
}
it('concurrent reservations create one immutable intent; changing connection cannot redirect it',async()=>{
 const f=await setup();try{
  await f.connect();await Promise.all([f.payout.reserve(f.award.id),f.payout.reserve(f.award.id)]);
  const batches=await f.database.orm.select().from(payoutBatches);expect(batches).toHaveLength(1);
  await f.connect('second@example.com');const batch=required(batches[0]);
  await Promise.all([f.payout.reconcile(batch.id),f.payout.reconcile(batch.id)]);
  expect(f.api.submit).toHaveBeenCalledTimes(1);expect(f.request().items[0]?.email).toBe('first@example.com');
  expect((await f.database.orm.select().from(bounties))[0]?.status).toBe('PAID');
 }finally{await f.close();}
});
it('lost POST response retains sender identities; expired retry window never posts again',async()=>{
 const f=await setup();try{
  await f.connect();const batch=required(await f.payout.reserve(f.award.id));f.lose();await f.payout.reconcile(batch.id);
  const first=structuredClone(f.request());f.advance(f.env.PP_SAFE_RETRY_SEC*1000+1);await f.payout.reconcile(batch.id);
  expect(f.api.submit).toHaveBeenCalledTimes(1);expect(f.request()).toEqual(first);expect(await f.database.orm.select().from(awards)).toHaveLength(1);
 }finally{await f.close();}
});
it('return after success reopens delivery attention without another POST or changing entitlement',async()=>{
 const f=await setup();try{
  await f.connect();const batch=required(await f.payout.reserve(f.award.id));await f.payout.reconcile(batch.id);
  f.setStatus('RETURNED');f.advance(86400001);await f.payout.tick();
  expect((await f.database.orm.select().from(bounties))[0]).toMatchObject({status:'PAYING',needsAttention:true});
  expect((await f.database.orm.select().from(payoutItems))[0]?.status).toBe('RETURNED');expect(f.api.submit).toHaveBeenCalledTimes(1);
  expect(await f.database.orm.select().from(awards)).toHaveLength(1);
 }finally{await f.close();}
});
it('an unconnected award stays reserved and connection resumes only its original recipients',async()=>{
 const f=await setup();try{
  expect(await f.payout.reserve(f.award.id)).toBeUndefined();expect(await f.database.orm.select().from(payoutBatches)).toHaveLength(0);
  expect((await f.database.orm.select().from(bounties))[0]?.status).toBe('AWAITING_CLAIM');
  await f.connect();await Promise.all([f.payout.retryClaims('8',1),f.payout.retryClaims('8',1)]);
  expect(await f.database.orm.select().from(payoutBatches)).toHaveLength(1);expect(f.api.submit).not.toHaveBeenCalled();
 }finally{await f.close();}
});
it('unknown or incomplete provider evidence cannot mark an award paid',async()=>{
 const f=await setup();try{
  await f.connect();const batch=required(await f.payout.reserve(f.award.id));f.setStatus('FUTURE_STATUS');await f.payout.reconcile(batch.id);
  expect((await f.database.orm.select().from(bounties))[0]).toMatchObject({status:'PAYING',needsAttention:true});
  vi.mocked(f.api.get).mockResolvedValue({id:'BATCH1',senderBatchId:batch.senderBatchId,complete:false,items:[]});await f.payout.reconcile(batch.id);
  expect((await f.database.orm.select().from(bounties))[0]?.status).toBe('PAYING');
 }finally{await f.close();}
});
it('two-author award waits for both connections and mixed outcomes are not paid',async()=>{
 const f=await setup(true);try{
  await f.connect();expect(await f.payout.reserve(f.award.id)).toBeUndefined();
  expect(await f.database.orm.select().from(payoutItems)).toHaveLength(0);
  await f.database.orm.insert(contributors).values({ghId:'9',ghLogin:'second',paypalEmailEnc:encrypt('second@example.com',f.env.PAYMENT_DATA_ENC_KEY,'contributor:9:paypal-email:v1')});
  const batch=required(await f.payout.reserve(f.award.id));
  vi.mocked(f.api.get).mockImplementation(()=>Promise.resolve({id:'BATCH1',senderBatchId:batch.senderBatchId,complete:true,items:f.request().items.map((i,index)=>({id:`ITEM${String(index)}`,senderItemId:i.senderItemId,email:i.email,amountCents:i.amountCents,currency:'USD',status:index===0?'SUCCESS':'UNCLAIMED'}))}));
  await f.payout.reconcile(batch.id);expect((await f.database.orm.select().from(bounties))[0]?.status).toBe('PAYING');
  expect((await f.database.orm.select().from(payoutItems)).reduce((sum,i)=>sum+i.amountCents,0)).toBe(5000);
 }finally{await f.close();}
});
it('database guards reject redirecting or removing a payout; credential changes block provider calls',async()=>{
 const f=await setup();try{
  await f.connect();const batch=required(await f.payout.reserve(f.award.id));
  await expect(f.database.orm.update(payoutItems).set({destinationEnc:'changed'})).rejects.toThrow();
  await expect(f.database.orm.delete(payoutBatches)).rejects.toThrow();
  const changed=createPayoutService(f.database,{...f.env,PP_CLIENT_ID:'different-account'},f.api);await changed.reconcile(batch.id);
  expect(f.api.submit).not.toHaveBeenCalled();expect(f.api.get).not.toHaveBeenCalled();
 }finally{await f.close();}
});
it('observation fencing rejects a slow success after the reservation was superseded',async()=>{
 const f=await setup();try{
  await f.connect();const batch=required(await f.payout.reserve(f.award.id));
  vi.mocked(f.api.get).mockImplementation(async()=>{
   await f.database.orm.update(payoutBatches).set({observationVersion:sql`${payoutBatches.observationVersion}+1`}).where(eq(payoutBatches.id,batch.id));
   return {id:'BATCH1',senderBatchId:batch.senderBatchId,complete:true,items:f.request().items.map(i=>({id:'ITEM1',senderItemId:i.senderItemId,email:i.email,amountCents:i.amountCents,currency:'USD',status:'SUCCESS'}))};
  });
  await f.payout.reconcile(batch.id);expect((await f.database.orm.select().from(bounties))[0]?.status).toBe('PAYING');
  expect((await f.database.orm.select().from(payoutItems))[0]?.status).toBe('RESERVED');
 }finally{await f.close();}
});
it('a bounded retry after a lost response reuses every persisted request identity',async()=>{
 const f=await setup();try{
  await f.connect();const batch=required(await f.payout.reserve(f.award.id));f.lose();await f.payout.reconcile(batch.id);const first=structuredClone(f.request());
  await f.payout.reconcile(batch.id);expect(f.api.submit).toHaveBeenCalledTimes(2);expect(f.request()).toEqual(first);
  await f.payout.reconcile(batch.id);expect(f.api.submit).toHaveBeenCalledTimes(2);
  const response=await f.httpRequest(`/api/bounties/${f.bounty.id}`);const body=await response.text();expect(body).toContain('paidCents');expect(body).not.toContain('first@example.com');
 }finally{await f.close();}
});
it('an awaiting award refuses draft cancellation and retains its entitlement',async()=>{
 const f=await setup();try{
  const {cancelDraft}=await import('../../src/actions/cancel.js');
  const {authorizeAction}=await import('../../src/actions/guards.js');
  const bounty=required((await f.database.orm.select().from(bounties))[0]);
  const ctx=await authorizeAction(f.auth,f.githubApi,f.session,bounty,'cancel_draft');
  await expect(f.database.withTransaction(tx=>cancelDraft(tx,ctx,bounty.id,bounty.version))).rejects.toThrow();
  expect(await f.database.orm.select().from(awards)).toHaveLength(1);
 }finally{await f.close();}
});
