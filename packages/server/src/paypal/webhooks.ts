import { eq,or } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client.js';
import type { FundingEnv } from '../env.js';
import { deliveries,fundingAttempts } from '../db/schema.js';
import { enqueue } from '../jobs/queue.js';
import { paypalToken } from './client.js';
import { requestJson } from '../preflight/http.js';
import { fundingEvent } from './status-map.js';
export interface PayPalHeaders {transmissionId:string;transmissionTime:string;certUrl:string;authAlgo:string;transmissionSig:string}
export type VerifyPayPal=(event:unknown,headers:PayPalHeaders,raw:Buffer)=>Promise<boolean>;
export class PayPalWebhookError extends Error {constructor(readonly status:number){super('PayPal webhook not accepted');}}
const headerSchema=z.object({transmissionId:z.string().min(1).max(256),transmissionTime:z.string().min(1).max(100),certUrl:z.url().max(2048),authAlgo:z.string().min(1).max(100),transmissionSig:z.string().min(1).max(4096)});
const eventSchema=z.object({id:z.string().min(1).max(256),event_type:z.string().max(100),resource:z.object({links:z.array(z.object({rel:z.string(),href:z.string().max(2048)})).max(20).optional(),id:z.string().max(256).optional(),supplementary_data:z.object({related_ids:z.object({order_id:z.string().max(256).optional(),capture_id:z.string().max(256).optional()}).optional()}).optional()}).optional()});
export function createPayPalVerifier(env:FundingEnv):VerifyPayPal {
 return async(_event,headers,raw)=>{
  if(!env.PP_WEBHOOK_ID)throw new PayPalWebhookError(503);
  const token=await paypalToken(env);
  // Embed the original JSON bytes as webhook_event, preserving formatting and
  // content. Parsed event fields remain untrusted until SUCCESS is returned.
  const metadata=JSON.stringify({transmission_id:headers.transmissionId,transmission_time:headers.transmissionTime,cert_url:headers.certUrl,auth_algo:headers.authAlgo,transmission_sig:headers.transmissionSig,webhook_id:env.PP_WEBHOOK_ID});
  const res=await requestJson(env,env.PP_BASE+'/v1/notifications/verify-webhook-signature',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:metadata.slice(0,-1)+',"webhook_event":'+raw.toString('utf8')+'}'});
  if(res.status!==200)throw new PayPalWebhookError(503);
  return z.object({verification_status:z.enum(['SUCCESS','FAILURE'])}).parse(res.body).verification_status==='SUCCESS';
 };
}
export function createPayPalIntake(db:Database,env:FundingEnv,verify:VerifyPayPal=createPayPalVerifier(env)) {
 let inFlight=0;
 return async(raw:Buffer,headers:PayPalHeaders)=>{
  if(raw.length>env.WEBHOOK_BODY_MAX_BYTES)throw new PayPalWebhookError(413);
  const validHeaders=headerSchema.safeParse(headers);if(!validHeaders.success)throw new PayPalWebhookError(400);
  const cert=new URL(headers.certUrl);if(cert.protocol!=='https:'||cert.username||cert.password||cert.port||!['api.paypal.com','api.sandbox.paypal.com','api-m.paypal.com','api-m.sandbox.paypal.com'].includes(cert.hostname))throw new PayPalWebhookError(400);
  let untrusted:unknown;try{untrusted=JSON.parse(raw.toString('utf8'));}catch{throw new PayPalWebhookError(400);}
  if(inFlight>=env.PP_VERIFY_CONCURRENCY)throw new PayPalWebhookError(503);inFlight++;
  let valid:boolean;
  try{valid=await verify(untrusted,headers,raw);}catch{throw new PayPalWebhookError(503);}finally{inFlight--;}
  if(!valid)throw new PayPalWebhookError(401);
  const parsed=eventSchema.safeParse(untrusted);if(!parsed.success)throw new PayPalWebhookError(400);const event=parsed.data;
  await db.withTransaction(async tx=>{
   const saved=await tx.insert(deliveries).values({source:'paypal',deliveryId:event.id}).onConflictDoNothing().returning();if(!saved.length||!fundingEvent(event.event_type))return;
   const related=event.resource?.supplementary_data?.related_ids;
   const up=event.resource?.links?.filter(link=>link.rel==='up')??[];
   // Crypto completion can supply only an order link. Extract an ID, never fetch this URL.
   let linkedOrder:string|undefined;
   if(up.length===1&&up[0]){try{const url=new URL(up[0].href);if(url.origin===env.PP_BASE&&!url.username&&!url.password&&!url.search&&!url.hash)linkedOrder=/^\/v2\/checkout\/orders\/([A-Za-z0-9]{1,64})$/.exec(url.pathname)?.[1];}catch{/* A malformed hint cannot authorize a payment. */}}
   const orderId=event.event_type.startsWith('CHECKOUT.')?event.resource?.id:related?.order_id??linkedOrder;
   const captureId=related?.capture_id??event.resource?.id;
   const attempts=await tx.select({id:fundingAttempts.id}).from(fundingAttempts).where(or(eq(fundingAttempts.orderId,orderId??''),eq(fundingAttempts.captureId,captureId??'')));
   for(const a of attempts)await enqueue(tx,{kind:'reconcile_funding',payload:{attemptId:a.id},dedupeKey:`paypal:${event.id}:${a.id}`,maxAttempts:env.RECONCILIATION_MAX_ATTEMPTS});
  });
 };
}
