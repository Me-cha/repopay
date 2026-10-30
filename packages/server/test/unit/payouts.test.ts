import nock from 'nock';
import { expect,it } from 'vitest';
import { createPayouts } from '../../src/paypal/payouts.js';
import { fundingEnv } from '../helpers/funding.js';
const base='https://api-m.sandbox.paypal.com';
const auth=()=>nock(base).post('/v1/oauth2/token').reply(200,{access_token:'synthetic',token_type:'Bearer'});
it('submits exact decimal cents and recovers only a trusted duplicate-batch link',async()=>{
 const api=createPayouts(fundingEnv());const request={senderBatchId:'batch-1',items:[{senderItemId:'item-1',email:'synthetic@example.com',amountCents:101}]};
 auth();nock(base).post('/v1/payments/payouts',{sender_batch_header:{sender_batch_id:'batch-1',email_subject:'GitPay sandbox bounty award'},items:[{recipient_type:'EMAIL',receiver:'synthetic@example.com',sender_item_id:'item-1',amount:{currency:'USD',value:'1.01'}}]}).reply(201,{batch_header:{payout_batch_id:'BATCH1'}});
 expect(await api.submit(request,new Date(Date.now()+10000))).toBe('BATCH1');
 auth();nock(base).post('/v1/payments/payouts').reply(400,{name:'DUPLICATE_BATCH_ID',links:[{rel:'duplicate_batch',href:base+'/v1/payments/payouts/BATCH1'}]});
 expect(await api.submit(request,new Date(Date.now()+10000))).toBe('BATCH1');
 auth();nock(base).post('/v1/payments/payouts').reply(400,{name:'DUPLICATE_BATCH_ID',links:[{rel:'duplicate_batch',href:'https://evil.example/BATCH1'}]});
 await expect(api.submit(request,new Date(Date.now()+10000))).rejects.toThrow();
});
it('expired deadline prevents a payout POST after authentication',async()=>{
 const api=createPayouts(fundingEnv());auth();await expect(api.submit({senderBatchId:'batch-1',items:[{senderItemId:'item-1',email:'synthetic@example.com',amountCents:100}]},new Date(0))).rejects.toThrow('expired');
});
it('parses item-level evidence and detects incomplete pagination',async()=>{
 const api=createPayouts({...fundingEnv(),RECONCILIATION_PAGE_LIMIT:1});auth();
 nock(base).get('/v1/payments/payouts/BATCH1').query({page:1,page_size:100,total_required:true}).reply(200,{total_pages:2,total_items:2,batch_header:{payout_batch_id:'BATCH1',sender_batch_header:{sender_batch_id:'batch-1'}},items:[{payout_item_id:'ITEM1',transaction_status:'SUCCESS',payout_item:{sender_item_id:'item-1',receiver:'synthetic@example.com',amount:{value:'1.01',currency:'USD'}}}]});
 const result=await api.get('BATCH1');expect(result.complete).toBe(false);expect(result.items[0]?.amountCents).toBe(101);
});
