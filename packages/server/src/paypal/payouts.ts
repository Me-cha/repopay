import { z } from 'zod';
import type { FundingEnv } from '../env.js';
import { assertSandbox,paypalToken } from './client.js';
import { requestJson } from '../preflight/http.js';
export interface PayoutRequest {senderBatchId:string;items:{senderItemId:string;email:string;amountCents:number}[]}
export interface PayoutSnapshot {id:string;senderBatchId:string;complete:boolean;items:{id:string;senderItemId:string;email:string;amountCents:number;currency:string;status:string}[]}
export interface Payouts {submit:(request:PayoutRequest,deadline:Date)=>Promise<string>;get:(id:string)=>Promise<PayoutSnapshot>}
const providerId=z.string().regex(/^[A-Za-z0-9]+$/).max(64);
const senderId=z.string().regex(/^[A-Za-z0-9-]+$/).min(1).max(50);
const requestSchema=z.object({senderBatchId:senderId,items:z.array(z.object({senderItemId:senderId,email:z.email(),amountCents:z.number().int().positive().max(2147483647)})).min(1).max(10)});
const money=z.object({value:z.string().regex(/^\d{1,9}\.\d{2}$/),currency:z.string()});
const snapshot=z.object({total_pages:z.number().int().nonnegative(),total_items:z.number().int().nonnegative(),batch_header:z.object({payout_batch_id:providerId,sender_batch_header:z.object({sender_batch_id:senderId})}),items:z.array(z.object({payout_item_id:providerId,transaction_status:z.string().max(100),payout_item:z.object({sender_item_id:senderId,receiver:z.email(),amount:money})}))});
export function createPayouts(env:FundingEnv):Payouts {
 assertSandbox(env);
 return {
  async submit(input,deadline){
   const request=requestSchema.parse(input);if(new Set(request.items.map(i=>i.senderItemId)).size!==request.items.length)throw new Error('Duplicate payout item');
   const token=await paypalToken(env);if(Date.now()>=deadline.getTime())throw new Error('Payout submission window expired');
   const response=await requestJson(env,env.PP_BASE+'/v1/payments/payouts',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({sender_batch_header:{sender_batch_id:request.senderBatchId,email_subject:'GitPay sandbox bounty award'},items:request.items.map(i=>({recipient_type:'EMAIL',receiver:i.email,sender_item_id:i.senderItemId,amount:{currency:'USD',value:`${String(Math.floor(i.amountCents/100))}.${String(i.amountCents%100).padStart(2,'0')}`}}))})});
   if(response.status===201)return z.object({batch_header:z.object({payout_batch_id:providerId})}).parse(response.body).batch_header.payout_batch_id;
   if(response.status===400){
    const duplicate=z.object({name:z.string(),details:z.array(z.object({issue:z.string()})).optional(),links:z.array(z.object({rel:z.string(),href:z.string()})).optional()}).safeParse(response.body);
    if(duplicate.success&&(duplicate.data.name==='DUPLICATE_BATCH_ID'||duplicate.data.details?.some(d=>d.issue==='DUPLICATE_BATCH_ID'))){
     const link=duplicate.data.links?.find(l=>l.rel==='duplicate_batch')?.href;
     const id=link?.match(/^https:\/\/api-m\.sandbox\.paypal\.com\/v1\/payments\/payouts\/([A-Za-z0-9]+)$/)?.[1];if(id)return providerId.parse(id);
    }
   }
   throw new Error('Payout outcome unavailable; retain saved identity');
  },
  async get(id){
   providerId.parse(id);const token=await paypalToken(env);const items:PayoutSnapshot['items']=[];let senderBatchId='';let total=-1;
   for(let page=1;page<=env.RECONCILIATION_PAGE_LIMIT;page++){
    const response=await requestJson(env,`${env.PP_BASE}/v1/payments/payouts/${id}?page=${String(page)}&page_size=100&total_required=true`,{headers:{Authorization:'Bearer '+token}});
    if(response.status!==200)throw new Error('Payout read unavailable');const data=snapshot.parse(response.body);
    if(data.batch_header.payout_batch_id!==id||(senderBatchId&&senderBatchId!==data.batch_header.sender_batch_header.sender_batch_id)||(total>=0&&total!==data.total_items))throw new Error('Conflicting payout pages');
    senderBatchId=data.batch_header.sender_batch_header.sender_batch_id;total=data.total_items;
    for(const i of data.items){const amountCents=Number(i.payout_item.amount.value.replace('.',''));if(!Number.isSafeInteger(amountCents)||amountCents>2147483647)throw new Error('Invalid payout amount');items.push({id:i.payout_item_id,senderItemId:i.payout_item.sender_item_id,email:i.payout_item.receiver,amountCents,currency:i.payout_item.amount.currency,status:i.transaction_status});}
    if(page>=data.total_pages)return {id,senderBatchId,items,complete:items.length===total&&new Set(items.map(i=>i.id)).size===items.length};
   }
   return {id,senderBatchId,items,complete:false};
  },
 };
}
