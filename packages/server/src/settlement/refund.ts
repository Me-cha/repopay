import { randomUUID } from 'node:crypto';
import { and,eq,inArray,lte,sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import type { FundingEnv } from '../env.js';
import { awards,bounties,bountyActivity,cancellationRequests as requests,fundingAttempts,refundIntents,type RefundIntent } from '../db/schema.js';
import { assertInstallation,lockBounty } from '../actions/guards.js';
import { AuthError } from '../github/oauth.js';
import type { CancellationService } from '../cancellation/service.js';
import type { Orders } from '../paypal/orders.js';
import type { Refunds,RefundSnapshot } from '../paypal/refunds.js';
import { enqueue } from '../jobs/queue.js';
export function createRefundSettlement(db:Database,env:FundingEnv,cancel:CancellationService,orders:Orders,provider:Refunds,chain?:{reserveRefund:(id:string)=>Promise<unknown>;tick:()=>Promise<void>}){
 const now=()=>cancel.clock.now(),next=()=>new Date(now().getTime()+env.RECONCILIATION_INTERVAL_SEC*1000);
 async function capture(id:string,cents:number){const c=await orders.getCapture(id);if(c.id!==id||c.status!=='COMPLETED'||c.amountCents!==cents||c.currency!=='USD'||!c.finalCapture)throw new AuthError(409,'Full captured principal could not be verified.');}
 async function authorizeRefund(requestId:string){
  const v=await cancel.refresh(requestId),r=v.request,b=v.bounty;if(b.currency!=='USD')throw new AuthError(409,'Use the PYUSD refund adapter');cancel.enabled(b);if(!r.reviewerId||r.status!=='APPROVED'||!v.bundle.complete||!r.noticeEndsAt||r.noticeEndsAt>now()||!b.captureId)throw new AuthError(409,'Current independent approval required.');await cancel.operator(r.reviewerId,b,r);await capture(b.captureId,b.amountCents);
  return db.withTransaction(async tx=>{const current=await lockBounty(tx,b.id);if(!current)throw new AuthError(404);await cancel.eligible(tx,current);const [fresh]=await tx.select().from(requests).where(eq(requests.id,r.id)).for('update');
   if(!fresh||fresh.status!=='APPROVED'||fresh.evidenceVersion!==r.evidenceVersion||fresh.reviewerId!==r.reviewerId||current.version!==b.version)throw new AuthError(409,'Cancellation approval changed.');
   const [funding]=await tx.select().from(fundingAttempts).where(and(eq(fundingAttempts.bountyId,b.id),eq(fundingAttempts.captureId,b.captureId??''),eq(fundingAttempts.status,'COMPLETED')));if(!funding||funding.amountCents!==b.amountCents||funding.actorGhId!==r.funderId)throw new AuthError(409,'Original funding record required.');
   const [intent]=await tx.insert(refundIntents).values({requestId:r.id,bountyId:b.id,evidenceVersion:r.evidenceVersion,bountyVersion:b.version,priorStatus:b.status,captureId:b.captureId??'',amountCents:b.amountCents,requestKey:randomUUID()}).returning();if(!intent)throw new Error('Refund reservation missing');
   await tx.update(requests).set({status:'EXECUTING'}).where(eq(requests.id,r.id));await tx.update(bounties).set({status:'REFUNDING',version:sql`${bounties.version}+1`}).where(eq(bounties.id,b.id));await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:b.id},dedupeKey:'refund-reserved:'+intent.id,maxAttempts:5});return intent;});
 }
 async function abortUnsent(i:RefundIntent){await db.withTransaction(async tx=>{const b=await lockBounty(tx,i.bountyId);const [r]=await tx.select().from(refundIntents).where(eq(refundIntents.id,i.id)).for('update');if(!b||!r||r.status!=='RESERVED'||r.boundaryAt)return;await tx.update(refundIntents).set({status:'ABORTED_UNSENT',attention:'Fresh independent review required'}).where(eq(refundIntents.id,r.id));await tx.update(requests).set({status:'REVIEW',reviewerId:null}).where(eq(requests.id,r.requestId));if(b.status==='REFUNDING')await tx.update(bounties).set({status:r.priorStatus,version:sql`${bounties.version}+1`}).where(eq(bounties.id,b.id));await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:b.id},dedupeKey:'refund-aborted:'+i.id,maxAttempts:5});});}
 async function observe(i:RefundIntent,s:RefundSnapshot){
  if(s.captureId!==i.captureId||s.amountCents!==i.amountCents||s.currency!=='USD'||(i.providerId&&i.providerId!==s.id))throw new Error('Refund financial identity mismatch');
  await db.withTransaction(async tx=>{const b=await lockBounty(tx,i.bountyId);const [current]=await tx.select().from(refundIntents).where(eq(refundIntents.id,i.id)).for('update');if(!b||!current||!current.boundaryAt||current.status==='SETTLED_OK')return;if(current.providerId&&current.providerId!==s.id)throw new Error('Refund identity changed');
   const done=s.status==='COMPLETED';await tx.update(refundIntents).set({providerId:s.id,status:done?'SETTLED_OK':s.status==='PENDING'?'IN_FLIGHT':'SETTLED_FAIL',attention:done?null:'Refund reserved; reconcile the existing operation',nextReconcileAt:next()}).where(eq(refundIntents.id,i.id));
   if(done){const [request]=await tx.select().from(requests).where(eq(requests.id,i.requestId));const lateEvidence=request?.evidenceVersion!==i.evidenceVersion;await tx.update(fundingAttempts).set({active:false}).where(and(eq(fundingAttempts.bountyId,b.id),eq(fundingAttempts.captureId,i.captureId)));const [award]=await tx.select().from(awards).where(eq(awards.bountyId,b.id));if(award)throw new Error('Award/refund invariant violated');await tx.update(bounties).set({status:'CANCELLED',version:sql`${bounties.version}+1`,needsAttention:lateEvidence,attentionReason:lateEvidence?'Evidence changed after refund authorization; independent investigation required':null}).where(eq(bounties.id,b.id));await tx.update(requests).set({status:'COMPLETED'}).where(eq(requests.id,i.requestId));await tx.insert(bountyActivity).values({bountyId:b.id,source:'paypal',action:'refund_completed',metadata:{intentId:i.id,amountCents:i.amountCents}});await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:b.id},dedupeKey:'refund-completed:'+i.id,maxAttempts:5});}
   else await tx.update(bounties).set({needsAttention:true,attentionReason:'Refund reserved pending provider reconciliation'}).where(eq(bounties.id,b.id));});
 }
 async function submitRefund(id:string){
  const connection=await db.pool.connect(),key='repopay-refund:'+id;
  let broken=false;const onError=()=>{broken=true;};connection.on('error',onError);
  try{const lock=await connection.query<{locked:boolean}>('SELECT pg_try_advisory_lock(hashtextextended(current_schema()||$1,0)) AS locked',[key]);if(!lock.rows[0]?.locked)return;
   let [i]=await db.orm.select().from(refundIntents).where(eq(refundIntents.id,id));if(!i||['ABORTED_UNSENT','SETTLED_OK'].includes(i.status))return;
   if(i.providerId){await cancel.refresh(i.requestId);await observe(i,await provider.get(i.providerId));return;}
   if(i.status==='SETTLED_FAIL')return;
   try{const v=await cancel.refresh(i.requestId);cancel.enabled(v.bounty);if(!v.request.reviewerId||v.request.status!=='EXECUTING'||v.request.evidenceVersion!==i.evidenceVersion||!v.bundle.complete||v.bounty.status!=='REFUNDING'||v.bounty.fundingHold||v.bounty.version!==i.bountyVersion+1)throw new Error('Refund evidence changed');await cancel.operator(v.request.reviewerId,v.bounty,v.request);if(i.status==='RESERVED')await capture(i.captureId,i.amountCents);
   }catch{if(i.status==='RESERVED')await abortUnsent(i);else await db.orm.update(refundIntents).set({attention:'Evidence changed after submission boundary; funds remain reserved',nextReconcileAt:next()}).where(eq(refundIntents.id,id));return;}
   if(i.status==='RESERVED'){
    const intent=i;i=await db.withTransaction(async tx=>{const b=await lockBounty(tx,intent.bountyId);if(!b)throw new AuthError(404);await assertInstallation(tx,b);const [r]=await tx.select().from(requests).where(eq(requests.id,intent.requestId)),[a]=await tx.select().from(awards).where(eq(awards.bountyId,b.id));if(a||b.fundingHold||b.status!=='REFUNDING'||b.version!==intent.bountyVersion+1||r?.evidenceVersion!==intent.evidenceVersion||r.status!=='EXECUTING')return undefined;const at=now();const [updated]=await tx.update(refundIntents).set({status:'MAY_HAVE_SUBMITTED',boundaryAt:at,safeRetryUntil:new Date(at.getTime()+env.PP_SAFE_RETRY_SEC*1000)}).where(and(eq(refundIntents.id,id),eq(refundIntents.status,'RESERVED'))).returning();return updated;});if(!i){await abortUnsent(intent);return;}
   }
   if(!i.safeRetryUntil||i.safeRetryUntil<=now()){await db.orm.update(refundIntents).set({attention:'Retry window elapsed; provider lookup required; never use a new request key',nextReconcileAt:next()}).where(eq(refundIntents.id,id));return;}
   await observe(i,await provider.submit(i.captureId,i.amountCents,i.requestKey,i.safeRetryUntil));
  }catch{await db.orm.update(refundIntents).set({attention:'Provider outcome unknown; retain reservation and original identity',nextReconcileAt:next()}).where(eq(refundIntents.id,id));}
  finally{await connection.query('SELECT pg_advisory_unlock(hashtextextended(current_schema()||$1,0))',[key]).catch(()=>{broken=true;});connection.off('error',onError);connection.release(broken);}
 }
 let lastTick=0;
 async function tick(){if(now().getTime()-lastTick<60000/env.RECONCILIATION_RATE_PER_MIN)return;lastTick=now().getTime();await chain?.tick();const [i]=await db.orm.select().from(refundIntents).where(and(inArray(refundIntents.status,['RESERVED','MAY_HAVE_SUBMITTED','IN_FLIGHT','SETTLED_FAIL']),lte(refundIntents.nextReconcileAt,now()))).orderBy(refundIntents.nextReconcileAt).limit(1);if(i)await submitRefund(i.id);
  if(!env.FUNDED_CANCELLATION_ENABLED)return;
  const [r]=await db.orm.select().from(requests).where(and(inArray(requests.status,['NOTICE','REVIEW','APPROVED']),lte(requests.nextReconcileAt,now()))).orderBy(requests.nextReconcileAt).limit(1);if(r){await db.orm.update(requests).set({nextReconcileAt:next()}).where(eq(requests.id,r.id));if(!r.noticePublishedAt)await cancel.publish(r.id);else{const v=await cancel.refresh(r.id);if(v.request.status==='APPROVED')try{if(v.bounty.currency==='PYUSD'){await chain?.reserveRefund(r.id);}else await authorizeRefund(r.id);}catch{/* no refund authorization on failed evidence */}}}
 }
 return {authorizeRefund,submitRefund,reconcileRefund:submitRefund,tick};
}
