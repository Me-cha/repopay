import { and,eq,lte,sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import type { FundingEnv } from '../env.js';
import { PayPalEvidenceError,type Orders,type OrderSnapshot } from '../paypal/orders.js';
import type { Clock } from '../domain/types.js';
import { bounties,bountyActivity,fundingAttempts,submissions,type FundingIntent } from '../db/schema.js';
import type { Transaction } from '../db/transaction.js';
import { openCryptoBuyer } from '../domain/funding-payment.js';
import { enqueue } from '../jobs/queue.js';
// Serialize provider operations without keeping a SQL transaction open. If this
// connection is lost, observation fencing and persisted provider keys still apply.
async function locked<T>(db:Database,key:string,work:()=>Promise<T>):Promise<T|undefined> {
 const client=await db.pool.connect();let acquired=false,destroy=false;
 const onError=()=>{destroy=true;};client.on('error',onError);
 try {
  acquired=(await client.query<{locked:boolean}>('select pg_try_advisory_lock(hashtext($1)) as locked',[db.schemaName+':'+key])).rows[0]?.locked===true;
  if(acquired)return await work();
 }catch(error){destroy=true;throw error;}finally{
  try{if(acquired){const result=await client.query<{unlocked:boolean}>('select pg_advisory_unlock(hashtext($1)) as unlocked',[db.schemaName+':'+key]);if(result.rows[0]?.unlocked!==true)destroy=true;}}catch{destroy=true;}
  client.off('error',onError);client.release(destroy);
 }
}
export function createFunding(db:Database,env:FundingEnv,provider:Orders,clock:Clock={now:()=>new Date()}) {
 const next=()=>new Date(clock.now().getTime()+env.RECONCILIATION_INTERVAL_SEC*1000);
 async function rows(tx:Transaction,id:string) {
  const [ref]=await tx.select({bountyId:fundingAttempts.bountyId}).from(fundingAttempts).where(eq(fundingAttempts.id,id));if(!ref)return;
  const [b]=await tx.select().from(bounties).where(eq(bounties.id,ref.bountyId)).for('update');
  const [a]=await tx.select().from(fundingAttempts).where(eq(fundingAttempts.id,id)).for('update');
  if(!a||!b||b.currentFundingAttemptId!==id||!a.active)return;return {a,b};
 }
 async function projection(tx:Transaction,a:FundingIntent) {
  await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:a.bountyId},dedupeKey:`funding:${a.id}:${String(a.observationVersion)}`,maxAttempts:env.RECONCILIATION_MAX_ATTEMPTS});
 }
 async function attention(a:FundingIntent,reason:string,hold=false) {
  await db.withTransaction(async tx=>{
   const r=await rows(tx,a.id);if(!r||r.a.observationVersion!==a.observationVersion)return;
   await tx.update(fundingAttempts).set({attention:reason,...(hold?{status:'HOLD'}:{}),nextReconcileAt:next(),updatedAt:clock.now()}).where(eq(fundingAttempts.id,a.id));
   await tx.update(bounties).set({needsAttention:true,attentionReason:reason,...(hold?{fundingHold:true}:{}),updatedAt:clock.now()}).where(eq(bounties.id,a.bountyId));await projection(tx,a);
  });
 }
 function validate(a:FundingIntent,o:OrderSnapshot) {
  // Display-name changes cannot rewrite references on previously saved orders.
  // Legacy references are allowed only for an exact, already-bound order ID.
  const referenceMatches=o.reference===`repopay:${a.id}`||(a.orderId===o.id&&o.reference===`gitpay:${a.id}`);
  if((a.orderId&&o.id!==a.orderId)||!referenceMatches||o.customId!==a.termsHash||o.merchantId!==a.terms.merchantId||o.amountCents!==a.amountCents||o.currency!=='USD')throw new Error('Order binding mismatch');
  if(o.captures.length>1||o.captures.some(c=>c.amountCents!==a.amountCents||c.currency!=='USD'||!c.finalCapture||(a.captureId&&a.captureId!==c.id)))throw new Error('Capture binding mismatch');
 }
 async function observe(a:FundingIntent,o:OrderSnapshot) {
  try{validate(a,o);}catch{await attention(a,'Provider amount, receiver or reference mismatch; investigate before continuing',true);return;}
  await db.withTransaction(async tx=>{
   const r=await rows(tx,a.id);if(!r||r.a.observationVersion!==a.observationVersion)return;
   const {b}=r;const capture=o.captures[0];
   // Cancellation fences orphan orders, including ones approved in another tab.
   if(b.status==='CANCELLED') {await tx.update(fundingAttempts).set({status:'VOIDED',active:false,orderId:o.id}).where(eq(fundingAttempts.id,a.id));return;}
   const common={orderId:o.id,approvalUrl:o.approvalUrl,nextReconcileAt:next(),updatedAt:clock.now()};
   if(capture?.status==='COMPLETED'&&!b.fundingHold) {
    await tx.update(fundingAttempts).set({...common,captureId:capture.id,status:'COMPLETED',attention:null}).where(eq(fundingAttempts.id,a.id));
    if(['OPEN','CAPTURING'].includes(b.status)&&!b.fundedAt) {
     await tx.update(bounties).set({status:'FUNDED',captureId:capture.id,captureRequestKey:a.captureRequestKey,fundedAt:clock.now(),fundedTerms:a.terms,fundingActorGhId:a.actorGhId,version:sql`${bounties.version}+1`,needsAttention:false,attentionReason:null,updatedAt:clock.now()}).where(eq(bounties.id,b.id));
     await tx.insert(bountyActivity).values({bountyId:b.id,actorGhId:a.actorGhId,source:'paypal',action:'funded',metadata:{attemptId:a.id,captureId:capture.id,termsHash:a.termsHash,grossCents:capture.amountCents,feeCents:capture.feeCents??null,netCents:capture.netCents??null,currency:capture.currency}});await projection(tx,a);
     const linked=await tx.select({id:submissions.id,headSha:submissions.headSha}).from(submissions).where(eq(submissions.bountyId,b.id));
     for(const submission of linked)await enqueue(tx,{kind:'verify_submission',payload:{submissionId:submission.id,headSha:submission.headSha},dedupeKey:`funded-review:${submission.id}:${submission.headSha}`,maxAttempts:env.RECONCILIATION_MAX_ATTEMPTS});
    }
   } else if(capture&&['REFUNDED','PARTIALLY_REFUNDED','REVERSED'].includes(capture.status)) {
    await tx.update(fundingAttempts).set({...common,captureId:capture.id,status:'HOLD',attention:'Capture refunded or reversed'}).where(eq(fundingAttempts.id,a.id));
    await tx.update(bounties).set({fundingHold:true,needsAttention:true,attentionReason:'Captured funds refunded or reversed; disbursement frozen',updatedAt:clock.now()}).where(eq(bounties.id,b.id));await projection(tx,a);
   } else if(capture&&!['PENDING','DECLINED','FAILED','COMPLETED'].includes(capture.status)) {
    await tx.update(fundingAttempts).set({...common,status:'HOLD',attention:'Unknown capture status'}).where(eq(fundingAttempts.id,a.id));
    await tx.update(bounties).set({fundingHold:true,needsAttention:true,attentionReason:'Unknown capture status; disbursement frozen'}).where(eq(bounties.id,b.id));await projection(tx,a);
   } else if(b.fundedAt||b.status==='FUNDED') {
    // A later-arriving nonterminal observation cannot undo confirmed funding.
    await tx.update(fundingAttempts).set({nextReconcileAt:next()}).where(eq(fundingAttempts.id,a.id));
   } else if(capture) {
    const known=['PENDING','DECLINED','FAILED'].includes(capture.status);
    await tx.update(fundingAttempts).set({...common,captureId:capture.id,status:known?(capture.status==='PENDING'?'PENDING':'DECLINED'):'HOLD',attention:known?null:'Unknown capture status'}).where(eq(fundingAttempts.id,a.id));
    await tx.update(bounties).set({status:'CAPTURING',captureRequestKey:a.captureRequestKey,needsAttention:capture.status!=='PENDING',attentionReason:capture.status==='PENDING'?null:'Capture requires reconciliation',fundingHold:!known||b.fundingHold,updatedAt:clock.now()}).where(eq(bounties.id,b.id));
   } else if(o.status==='VOIDED'&&!a.captureSubmissionBoundaryAt&&!b.captureId) {
    await tx.update(fundingAttempts).set({...common,status:'VOIDED',active:false,attention:null}).where(eq(fundingAttempts.id,a.id));
    await tx.update(bounties).set({...(a.paymentMethod==='crypto'?{captureRequestKey:null}:{}),version:sql`${bounties.version}+1`,updatedAt:clock.now()}).where(eq(bounties.id,b.id));await projection(tx,a);
   } else {
    const known=['CREATED','SAVED','PAYER_ACTION_REQUIRED','APPROVED'].includes(o.status);
    await tx.update(fundingAttempts).set({...common,status:known?(o.status==='APPROVED'?'APPROVED':'CREATED'):'HOLD',attention:known?null:'Unknown or incomplete order state'}).where(eq(fundingAttempts.id,a.id));
    if(!known)await tx.update(bounties).set({fundingHold:true,needsAttention:true,attentionReason:'Unknown or incomplete provider state'}).where(eq(bounties.id,b.id));
   }
  });
 }
 async function reserve(a:FundingIntent,stage:'order'|'capture') {
  return db.withTransaction(async tx=>{
   const r=await rows(tx,a.id);if(!r||r.a.observationVersion!==a.observationVersion||r.b.status==='CANCELLED'||r.b.fundingHold)return;
   if(stage==='capture'&&(r.a.paymentMethod==='crypto'||!['OPEN','CAPTURING'].includes(r.b.status)))return;
   if(stage==='order'&&r.a.paymentMethod==='crypto'&&!r.a.orderSubmissionBoundaryAt&&!env.PP_CRYPTO_ENABLED)return;
   const boundary=stage==='order'?r.a.orderSubmissionBoundaryAt:r.a.captureSubmissionBoundaryAt;
   const priorDeadline=stage==='order'?r.a.orderSafeRetryUntil:r.a.captureSafeRetryUntil;
   const now=clock.now(),deadline=boundary?priorDeadline:new Date(now.getTime()+env.PP_SAFE_RETRY_SEC*1000);
   if(!deadline||now>=deadline)return;
   await tx.update(fundingAttempts).set(stage==='order'?{orderSubmissionBoundaryAt:boundary??now,orderSafeRetryUntil:deadline}:{captureSubmissionBoundaryAt:boundary??now,captureSafeRetryUntil:deadline,status:'CAPTURING'}).where(eq(fundingAttempts.id,a.id));
   // Crypto order creation authorizes automatic capture: fence draft cancellation
   // before the network call, including when its response is lost.
   if(stage==='order'&&r.a.paymentMethod==='crypto')await tx.update(bounties).set({captureRequestKey:a.captureRequestKey,updatedAt:now}).where(eq(bounties.id,a.bountyId));
   if(stage==='capture')await tx.update(bounties).set({status:'CAPTURING',captureRequestKey:a.captureRequestKey,version:sql`${bounties.version}+1`,updatedAt:now}).where(eq(bounties.id,a.bountyId));
   return deadline;
  });
 }
 async function reconcile(id:string) {
  await locked(db,`funding:${id}`,async()=>{
   const a=await db.withTransaction(async tx=>{
    const r=await rows(tx,id);if(!r)return;
    if(r.b.status==='CANCELLED'){await tx.update(fundingAttempts).set({active:false,status:'VOIDED'}).where(eq(fundingAttempts.id,id));return;}
    const [a]=await tx.update(fundingAttempts).set({observationVersion:sql`${fundingAttempts.observationVersion}+1`,nextReconcileAt:next()}).where(eq(fundingAttempts.id,id)).returning();return a;
   });if(!a)return;
   try {
    let order:OrderSnapshot;
    if(!a.orderId) {
     const deadline=await reserve(a,'order');if(!deadline){await attention(a,'Order outcome unknown after safe retry window; recover existing order ID');return;}
     const path=`/bounties/${a.bountyId}/funding/${a.id}`;
     const cryptoBuyer=a.paymentMethod==='crypto'?openCryptoBuyer(a.buyerNameEnc??'',env,a.orderRequestKey):undefined;
     order=await provider.createOrder({...(cryptoBuyer?{cryptoBuyer}:{}),attemptId:a.id,termsHash:a.termsHash,amountCents:a.amountCents,merchantId:a.terms.merchantId,returnUrl:new URL(path+'/return',a.checkoutOrigin).href,cancelUrl:new URL(path+'/cancel',a.checkoutOrigin).href},a.orderRequestKey,deadline);
    } else {
     order=await provider.getOrder(a.orderId);
     // Capture resource reads detect refunds even if the order projection lags.
     if(a.captureId){const capture=await provider.getCapture(a.captureId);if(order.captures.length===1&&order.captures[0]?.id===capture.id)order={...order,captures:[capture]};else throw new PayPalEvidenceError();}
    }
    await observe(a,order);
    if(a.paymentMethod==='paypal'&&order.status==='APPROVED'&&!order.captures.length) {
     const deadline=await reserve(a,'capture');if(!deadline){await attention(a,'Capture held or retry window expired; reconcile existing order');return;}
     const result=await provider.captureOrder(order.id,a.captureRequestKey,deadline);
     await observe({...a,orderId:order.id},result);
    }
   }catch(error){await attention(a,error instanceof PayPalEvidenceError?'Invalid provider financial evidence; disbursement frozen':'PayPal outcome unavailable; saved request identity retained for reconciliation',error instanceof PayPalEvidenceError);}
  });
 }
 let lastTick=0;
 async function tick() {
  const now=clock.now();if(now.getTime()-lastTick<60000/env.RECONCILIATION_RATE_PER_MIN)return;lastTick=now.getTime();
  const [due]=await db.orm.select({id:fundingAttempts.id}).from(fundingAttempts).where(and(eq(fundingAttempts.active,true),lte(fundingAttempts.nextReconcileAt,now))).orderBy(fundingAttempts.nextReconcileAt).limit(1);
  if(due)await reconcile(due.id);
 }
 return {reconcile,tick};
}
export type FundingService=ReturnType<typeof createFunding>;
