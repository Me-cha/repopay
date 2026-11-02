export interface CaptureSnapshot {id:string;status:string;amountCents:number;currency:string;finalCapture:boolean;feeCents?:number;netCents?:number}
export interface OrderSnapshot {id:string;status:string;reference:string;customId:string;merchantId:string;amountCents:number;currency:string;approvalUrl:string|null;captures:CaptureSnapshot[]}
export interface OrderInput {attemptId:string;termsHash:string;amountCents:number;merchantId:string;returnUrl:string;cancelUrl:string}
export interface Orders {
 createOrder:(input:OrderInput,key:string,deadline:Date)=>Promise<OrderSnapshot>;
 getOrder:(id:string)=>Promise<OrderSnapshot>;
 captureOrder:(id:string,key:string,deadline:Date)=>Promise<OrderSnapshot>;
 getCapture:(id:string)=>Promise<CaptureSnapshot>;
}
import { z } from 'zod';
import type { FundingEnv } from '../env.js';
import { paypalToken,assertSandbox } from './client.js';
import { requestJson } from '../preflight/http.js';
const id=z.string().regex(/^[A-Za-z0-9]+$/).max(64);
const money=z.object({value:z.string().regex(/^\d{1,9}\.\d{2}$/),currency_code:z.string().length(3)});
const capture=z.object({id,status:z.string().max(100),amount:money,final_capture:z.boolean(),seller_receivable_breakdown:z.object({gross_amount:money,paypal_fee:money,net_amount:money}).optional()});
function cents(value:string) {const result=Number(value.replace('.',''));if(!Number.isSafeInteger(result)||result>2147483647)throw new Error('Invalid provider amount');return result;}
export class PayPalEvidenceError extends Error {constructor(){super('Invalid PayPal financial evidence');}}
function normalizeCapture(input:unknown):CaptureSnapshot {try{return parseCapture(input);}catch{throw new PayPalEvidenceError();}}
function parseCapture(input:unknown):CaptureSnapshot {const c=capture.parse(input);const e=c.seller_receivable_breakdown;
 if(e&&(e.gross_amount.value!==c.amount.value||[e.gross_amount,e.paypal_fee,e.net_amount].some(m=>m.currency_code!==c.amount.currency_code)||cents(e.paypal_fee.value)+cents(e.net_amount.value)!==cents(c.amount.value)))throw new Error('Inconsistent capture economics');
 return {...(e?{feeCents:cents(e.paypal_fee.value),netCents:cents(e.net_amount.value)}:{}),id:c.id,status:c.status,amountCents:cents(c.amount.value),currency:c.amount.currency_code,finalCapture:c.final_capture};}
export function safeApprovalUrl(value:string,orderId:string) {
 const url=new URL(value);
 if(url.protocol!=='https:'||url.hostname!=='www.sandbox.paypal.com'||url.port||url.username||url.password||url.hash||!['/checkoutnow','/webapps/hermes'].includes(url.pathname)||url.searchParams.getAll('token').length!==1||url.searchParams.get('token')!==orderId)throw new Error('Unsafe PayPal approval URL');
 return url.href;
}
export function normalizeOrder(input:unknown):OrderSnapshot {try{return parseOrder(input);}catch{throw new PayPalEvidenceError();}}
function parseOrder(input:unknown):OrderSnapshot {
 const data=z.object({id,status:z.string().max(100),purchase_units:z.array(z.object({reference_id:z.string(),custom_id:z.string(),amount:money,payee:z.object({merchant_id:z.string()}),payments:z.object({captures:z.array(capture)}).optional()})).length(1),links:z.array(z.object({rel:z.string(),href:z.string()})).optional()}).parse(input);
 const unit=data.purchase_units[0];if(!unit)throw new Error('Missing purchase unit');
 const links=data.links?.filter(link=>['approve','payer-action'].includes(link.rel))??[];
 if(links.length>1)throw new Error('Ambiguous approval URL');
 const approval=links[0];
 return {id:data.id,status:data.status,reference:unit.reference_id,customId:unit.custom_id,merchantId:unit.payee.merchant_id,amountCents:cents(unit.amount.value),currency:unit.amount.currency_code,approvalUrl:approval?safeApprovalUrl(approval.href,data.id):null,captures:(unit.payments?.captures??[]).map(normalizeCapture)};
}
export function createOrders(env:FundingEnv):Orders {
 assertSandbox(env);
 async function call(path:string,method='GET',body?:unknown,key?:string,deadline?:Date) {
  const token=await paypalToken(env);
  if(deadline&&Date.now()>=deadline.getTime())throw new Error('Provider safe retry window expired');
  const res=await requestJson(env,env.PP_BASE+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation',...(key?{'PayPal-Request-Id':key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(![200,201].includes(res.status))throw new Error('PayPal operation unavailable; reconcile saved identity');return res.body;
 }
 return {
  async createOrder(input,key,deadline) {
   return normalizeOrder(await call('/v2/checkout/orders','POST',{intent:'CAPTURE',purchase_units:[{reference_id:`repopay:${input.attemptId}`,custom_id:input.termsHash,amount:{currency_code:'USD',value:`${String(Math.floor(input.amountCents/100))}.${String(input.amountCents%100).padStart(2,'0')}`},payee:{merchant_id:input.merchantId}}],payment_source:{paypal:{experience_context:{return_url:input.returnUrl,cancel_url:input.cancelUrl,shipping_preference:'NO_SHIPPING',user_action:'PAY_NOW'}}}},key,deadline));
  },
  async getOrder(orderId){return normalizeOrder(await call('/v2/checkout/orders/'+id.parse(orderId)));},
  async captureOrder(orderId,key,deadline){return normalizeOrder(await call('/v2/checkout/orders/'+id.parse(orderId)+'/capture','POST',{},key,deadline));},
  async getCapture(captureId){const result=normalizeCapture(await call('/v2/payments/captures/'+id.parse(captureId)));if(result.id!==captureId)throw new PayPalEvidenceError();return result;},
 };
}
