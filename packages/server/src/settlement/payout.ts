import { randomUUID,createHash } from 'node:crypto';
import { and,eq,lte,sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { awards,bounties,bountyActivity,contributors,payoutBatches,payoutItems } from '../db/schema.js';
import type { FundingEnv } from '../env.js';
import type { Clock } from '../domain/types.js';
import type { Payouts } from '../paypal/payouts.js';
import { encrypt,decrypt } from '../util/crypto.js';
import { enqueue } from '../jobs/queue.js';
import { lockBounty } from '../actions/guards.js';
const context=(id:string)=>`payout:${id}:destination:v1`;
export function createPayoutService(db:Database,env:FundingEnv,provider:Payouts,clock:Clock={now:()=>new Date()}) {
 const accountHash=createHash('sha256').update(env.PP_BASE+'\n'+env.PP_CLIENT_ID+'\n'+env.PP_MERCHANT_ID).digest('hex');
 async function reserve(awardId:string){
  return db.withTransaction(async tx=>{
   const [award]=await tx.select().from(awards).where(eq(awards.id,awardId));if(!award)return;
   const bounty=await lockBounty(tx,award.bountyId);if(!bounty||bounty.currency!=='USD'||bounty.fundingHold)return;
   const [existing]=await tx.select().from(payoutBatches).where(eq(payoutBatches.awardId,awardId));if(existing)return existing;
   const destinations=[];
   for(const part of [...award.allocation].sort((a,b)=>a.ghId<b.ghId?-1:1)){
    const [person]=await tx.select().from(contributors).where(eq(contributors.ghId,part.ghId)).for('share');if(!person)return;
    destinations.push({part,person});
   }
   const [batch]=await tx.insert(payoutBatches).values({awardId,senderBatchId:randomUUID(),accountHash}).returning();if(!batch)throw new Error('Payout reservation failed');
   for(const {part,person} of destinations){const senderItemId=randomUUID();const email=decrypt(person.paypalEmailEnc,env.PAYMENT_DATA_ENC_KEY,`contributor:${person.ghId}:paypal-email:v1`);await tx.insert(payoutItems).values({batchId:batch.id,awardId,ghId:part.ghId,amountCents:part.cents,senderItemId,destinationEnc:encrypt(email,env.PAYMENT_DATA_ENC_KEY,context(senderItemId)),connectionVersion:person.connectionVersion});}
   await tx.update(bounties).set({status:'PAYING',version:sql`${bounties.version}+1`,updatedAt:clock.now()}).where(eq(bounties.id,award.bountyId));
   await tx.insert(bountyActivity).values({bountyId:award.bountyId,source:'policy',action:'payout_reserved',metadata:{awardId,batchId:batch.id}});await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:award.bountyId},dedupeKey:`payout-reserved:${batch.id}`,maxAttempts:5});return batch;
  });
 }
 async function reconcile(batchId:string){
  const client=await db.pool.connect(),key=`${db.schemaName}:payout:${batchId}`;let locked=false,clean=false;
  try{
   const result=await client.query<{locked:boolean}>('select pg_try_advisory_lock(hashtext($1)) as locked',[key]);locked=result.rows[0]?.locked===true;clean=true;if(!locked)return;
   const reservation=await db.withTransaction(async tx=>{
    const [ref]=await tx.select().from(payoutBatches).where(eq(payoutBatches.id,batchId));if(!ref)return;
    const [award]=await tx.select().from(awards).where(eq(awards.id,ref.awardId));if(!award)return;
    const bounty=await lockBounty(tx,award.bountyId);if(!bounty)return;
    const [batch]=await tx.select().from(payoutBatches).where(eq(payoutBatches.id,batchId)).for('update');if(!batch)return;
    const items=await tx.select().from(payoutItems).where(eq(payoutItems.batchId,batchId));
    const now=clock.now(),boundary=batch.submissionBoundaryAt??now,deadline=batch.safeRetryUntil??new Date(now.getTime()+Math.min(env.PP_SAFE_RETRY_SEC,29*86400)*1000);
    // Existing batches are always readable, including during funding holds.
    const canPost=batch.accountHash===accountHash&&!bounty.fundingHold&&!batch.providerBatchId&&now<deadline;
    const [saved]=await tx.update(payoutBatches).set({observationVersion:batch.observationVersion+1,nextReconcileAt:new Date(now.getTime()+env.RECONCILIATION_INTERVAL_SEC*1000),...(canPost?{submissionBoundaryAt:boundary,safeRetryUntil:deadline}:{})}).where(eq(payoutBatches.id,batchId)).returning();
    if(!saved)return;return {batch:saved,items,bounty,canPost,deadline};
   });if(!reservation)return;
   const {batch,items,bounty,canPost,deadline}=reservation;
   const request={senderBatchId:batch.senderBatchId,items:items.map(i=>({senderItemId:i.senderItemId,email:decrypt(i.destinationEnc,env.PAYMENT_DATA_ENC_KEY,context(i.senderItemId)),amountCents:i.amountCents}))};
   let providerBatchId=batch.providerBatchId;
   try{
    if(batch.accountHash!==accountHash)throw new Error('Payout account changed; restore original credentials');
    if(!providerBatchId){if(!canPost)throw new Error('Submission held');providerBatchId=await provider.submit(request,deadline);
     // Persist recovered identity before fetching item states; a failed GET never
     // triggers another POST merely because it failed to save delivery status.
     await db.orm.update(payoutBatches).set({providerBatchId}).where(and(eq(payoutBatches.id,batchId),eq(payoutBatches.observationVersion,batch.observationVersion)));
    }
    const observed=await provider.get(providerBatchId);
    if(!observed.complete||observed.id!==providerBatchId||observed.senderBatchId!==batch.senderBatchId||observed.items.length!==items.length||new Set(observed.items.map(i=>i.senderItemId)).size!==items.length)throw new Error('Payout evidence mismatch');
    for(const item of items){const got=observed.items.find(i=>i.senderItemId===item.senderItemId),sent=request.items.find(i=>i.senderItemId===item.senderItemId);if(!got||!sent||got.email!==sent.email||got.amountCents!==item.amountCents||got.currency!=='USD'||(item.providerItemId&&item.providerItemId!==got.id))throw new Error('Payout item mismatch');}
    await db.withTransaction(async tx=>{
     const currentBounty=await lockBounty(tx,bounty.id);const [current]=await tx.select().from(payoutBatches).where(eq(payoutBatches.id,batchId)).for('update');if(current?.observationVersion!==batch.observationVersion)return;
     const allPaid=observed.items.every(i=>i.status==='SUCCESS');const attention=observed.items.some(i=>!['SUCCESS','PENDING'].includes(i.status))?'Award delivery requires investigation; do not resend or refund':null;
     for(const item of observed.items)await tx.update(payoutItems).set({providerItemId:item.id,status:item.status,updatedAt:clock.now()}).where(and(eq(payoutItems.batchId,batchId),eq(payoutItems.senderItemId,item.senderItemId)));
     await tx.update(payoutBatches).set({attention,nextReconcileAt:new Date(clock.now().getTime()+(allPaid?86400000:env.RECONCILIATION_INTERVAL_SEC*1000))}).where(eq(payoutBatches.id,batchId));
     await tx.update(bounties).set({status:allPaid?'PAID':'PAYING',version:sql`${bounties.version}+1`,...(attention?{needsAttention:true,attentionReason:attention}:currentBounty&&!currentBounty.fundingHold&&(currentBounty.attentionReason?.startsWith('Payout outcome')||currentBounty.attentionReason?.startsWith('Award delivery'))?{needsAttention:false,attentionReason:null}:{}),updatedAt:clock.now()}).where(eq(bounties.id,bounty.id));
     await tx.insert(bountyActivity).values({bountyId:bounty.id,source:'paypal',action:'payout_observed',metadata:{batchId,paidCents:observed.items.filter(i=>i.status==='SUCCESS').reduce((sum,i)=>sum+i.amountCents,0),statuses:observed.items.map(i=>i.status)}});
     await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:bounty.id},dedupeKey:`payout-observed:${batchId}:${String(batch.observationVersion)}`,maxAttempts:5});
    });
   }catch{
    await db.withTransaction(async tx=>{await lockBounty(tx,bounty.id);const [current]=await tx.select().from(payoutBatches).where(eq(payoutBatches.id,batchId)).for('update');if(current?.observationVersion!==batch.observationVersion)return;
     const reason='Payout outcome unavailable or held; saved identity retained, investigate before retry window expires';await tx.update(payoutBatches).set({attention:reason}).where(eq(payoutBatches.id,batchId));await tx.update(bounties).set({needsAttention:true,attentionReason:reason}).where(eq(bounties.id,bounty.id));});
   }
  }catch(error){clean=false;throw error;}finally{if(locked){try{const r=await client.query<{unlocked:boolean}>('select pg_advisory_unlock(hashtext($1)) as unlocked',[key]);clean=clean&&r.rows[0]?.unlocked===true;}catch{clean=false;}}client.release(!clean);}
 }
 async function retryClaims(ghId:string,connectionVersion:number){
  const [person]=await db.orm.select().from(contributors).where(eq(contributors.ghId,ghId));if(!person||person.connectionVersion<connectionVersion)return;
  const rows=await db.orm.select().from(awards).where(sql`${awards.allocation} @> ${JSON.stringify([{ghId}])}::jsonb`);
  for(const award of rows)await reserve(award.id);
 }
 async function tick(){
  // Rotating by durable due-time includes previously successful payouts.
  const [due]=await db.orm.select().from(payoutBatches).where(lte(payoutBatches.nextReconcileAt,clock.now())).orderBy(payoutBatches.nextReconcileAt,payoutBatches.id).limit(1);if(due)await reconcile(due.id);
 }
 return {reserve,reconcile,retryClaims,tick};
}
export type PayoutService=ReturnType<typeof createPayoutService>;
