import { z } from 'zod';
import { required } from '../helpers/auth.js';
import { expect,it } from 'vitest';
import nock from 'nock';
import { createOrders,normalizeOrder } from '../../src/paypal/orders.js';
import { fundingEnv } from '../helpers/funding.js';
const body=()=>({id:'ORDER123',status:'CREATED',purchase_units:[{reference_id:'repopay:1',custom_id:'terms-hash',amount:{value:'50.00',currency_code:'USD'},payee:{merchant_id:'MERCHANT12345'}}],links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token=ORDER123'}]});
it('normalizes documented order fields and rejects unsafe approval URLs and ambiguous money',()=>{
 expect(normalizeOrder(body())).toMatchObject({id:'ORDER123',amountCents:5000,reference:'repopay:1',captures:[]});
 for(const url of ['http://www.sandbox.paypal.com/checkoutnow?token=ORDER123','https://paypal.com/checkoutnow?token=ORDER123','https://www.sandbox.paypal.com.evil.test/','https://www.sandbox.paypal.com/checkoutnow?token=OTHER']) {
  expect(()=>normalizeOrder({...body(),links:[{rel:'approve',href:url}]})).toThrow();
 }
 const invalid=body();required(invalid.purchase_units[0]).amount.value='50.001';expect(()=>normalizeOrder(invalid)).toThrow();
 expect(()=>normalizeOrder({...body(),purchase_units:[...body().purchase_units,...body().purchase_units]})).toThrow();
});
it('sends saved request key, exact USD amount, explicit payee and bound return URLs to sandbox only',async()=>{
 const env=fundingEnv(),api=createOrders(env);
 nock(env.PP_BASE).post('/v1/oauth2/token').reply(200,{access_token:'access',token_type:'Bearer'});
 const scope=nock(env.PP_BASE).post('/v2/checkout/orders',(value:unknown)=>z.object({intent:z.literal('CAPTURE'),purchase_units:z.array(z.object({amount:z.object({value:z.literal('50.00')}),payee:z.object({merchant_id:z.literal(env.PP_MERCHANT_ID)})})).length(1),payment_source:z.object({paypal:z.object({experience_context:z.object({return_url:z.literal('https://repopay.test/return')})})})}).safeParse(value).success).matchHeader('PayPal-Request-Id','saved-key').matchHeader('Prefer','return=representation').reply(201,body());
 await api.createOrder({attemptId:'1',termsHash:'terms-hash',amountCents:5000,merchantId:env.PP_MERCHANT_ID,returnUrl:'https://repopay.test/return',cancelUrl:'https://repopay.test/cancel'},'saved-key',new Date(Date.now()+60000));expect(scope.isDone()).toBe(true);
});
it('an expired retry deadline cannot send a financial POST even after token authentication',async()=>{
 const env=fundingEnv(),api=createOrders(env);nock(env.PP_BASE).post('/v1/oauth2/token').reply(200,{access_token:'access',token_type:'Bearer'});
 await expect(api.captureOrder('ORDER123','saved-key',new Date(0))).rejects.toThrow(/expired/);
});
it('retains documented fees and net separately from the promised gross principal',()=>{
 const input=body();
 const order=normalizeOrder({...input,purchase_units:[{...input.purchase_units[0],payments:{captures:[{id:'CAPTURE',status:'COMPLETED',amount:{value:'50.00',currency_code:'USD'},final_capture:true,seller_receivable_breakdown:{gross_amount:{value:'50.00',currency_code:'USD'},paypal_fee:{value:'2.00',currency_code:'USD'},net_amount:{value:'48.00',currency_code:'USD'}}}]}}]});
 expect(order.captures[0]).toMatchObject({amountCents:5000,feeCents:200,netCents:4800});
});
