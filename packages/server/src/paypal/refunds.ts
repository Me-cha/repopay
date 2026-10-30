import { z } from 'zod';
import type { FundingEnv } from '../env.js';
import { paypalToken,assertSandbox } from './client.js';
import { requestJson } from '../preflight/http.js';
export interface RefundSnapshot {id:string;status:'CANCELLED'|'FAILED'|'PENDING'|'COMPLETED';amountCents:number;currency:string;captureId:string}
export interface Refunds {submit:(captureId:string,cents:number,key:string,deadline:Date)=>Promise<RefundSnapshot>;get:(id:string)=>Promise<RefundSnapshot>}
const id=z.string().regex(/^[A-Za-z0-9]{1,64}$/);
export function normalizeRefund(raw:unknown):RefundSnapshot{
 const r=z.object({id,status:z.enum(['CANCELLED','FAILED','PENDING','COMPLETED']),amount:z.object({value:z.string().regex(/^\d{1,8}\.\d{2}$/),currency_code:z.literal('USD')}),links:z.array(z.object({rel:z.string(),href:z.string()}))}).parse(raw);
 const up=r.links.filter(l=>l.rel==='up');const match=up[0]?.href.match(/^https:\/\/api-m\.sandbox\.paypal\.com\/v2\/payments\/captures\/([A-Za-z0-9]{1,64})$/);
 if(up.length!==1||!match?.[1])throw new Error('Refund capture identity unavailable');
 return {id:r.id,status:r.status,amountCents:Number(r.amount.value.replace('.','')),currency:r.amount.currency_code,captureId:match[1]};
}
export function createRefunds(env:FundingEnv):Refunds{
 assertSandbox(env);
 async function call(path:string,body?:unknown,key?:string,deadline?:Date){const token=await paypalToken(env);if(deadline&&Date.now()>=deadline.getTime())throw new Error('Refund request deadline elapsed');const r=await requestJson(env,env.PP_BASE+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation',...(key?{'PayPal-Request-Id':key}:{})},...(body?{body:JSON.stringify(body)}:{})});if(r.status<200||r.status>=300)throw new Error('Refund requires reconciliation');return normalizeRefund(r.body);}
 return {submit:(capture,cents,key,deadline)=>call('/v2/payments/captures/'+id.parse(capture)+'/refund',{amount:{value:(cents/100).toFixed(2),currency_code:'USD'}},key,deadline),get:async refundId=>{const r=await call('/v2/payments/refunds/'+id.parse(refundId));if(r.id!==refundId)throw new Error('Refund identity changed');return r;}};
}
