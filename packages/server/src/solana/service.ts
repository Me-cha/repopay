import type { CancellationService } from '../cancellation/service.js';
import { randomUUID } from 'node:crypto';
import { and,eq,inArray,isNull,lte,ne,sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import type { FundingEnv } from '../env.js';
import type { Session } from '../github/oauth.js';
import type { ActorContext } from '../domain/types.js';
import { AuthError } from '../github/oauth.js';
import { bounties,awards,cancellationRequests,chainTransfers,chainWallets,fundingAttempts,bountyActivity,type Bounty,type ChainTransfer } from '../db/schema.js';
import { assertSession,assertContext,assertInstallation,lockBounty,hasConfirmedFunding } from '../actions/guards.js';
import { termsHash,termsSchema,type FundedTerms } from '../domain/funded-terms.js';
import { enqueue } from '../jobs/queue.js';
import { createChainProvider,type ChainProvider,type Transfer } from './provider.js';
const transfer=(row:ChainTransfer):Transfer=>({from:row.source,to:row.destination,amount:row.amount,reference:'repopay:'+row.id});
export function chainService(db:Database,env:FundingEnv,provider:ChainProvider=createChainProvider(env),now=()=>new Date(),cancellation?:CancellationService) {
 function enabled(){if(!env.PYUSD_DEVNET_ENABLED)throw new AuthError(409,'PYUSD devnet is disabled.');}
 async function projection(tx:Parameters<Parameters<Database['withTransaction']>[0]>[0],b:Bounty,reason:string){await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:b.id},dedupeKey:`chain:${b.id}:${reason}`,maxAttempts:5});}
 async function row(id:string){const [r]=await db.orm.select().from(chainTransfers).where(eq(chainTransfers.id,id));if(!r)throw new AuthError(404,'Transfer not found.');return r;}
 async function reserveFunding(session:Session,ctx:ActorContext,before:Bounty,input:FundedTerms){
  enabled();const terms=termsSchema.parse(input),treasury=await provider.treasury();
  if(terms.version!==6||terms.chain.treasury!==treasury||terms.merchantId!==treasury||terms.chain.refundWallet===treasury)throw new AuthError(409,'PYUSD treasury or funding wallet changed.');
  return db.withTransaction(async tx=>{await assertSession(tx,session,now());const b=await lockBounty(tx,before.id);if(!b)throw new AuthError(404);assertContext(ctx,b,'fund');await assertInstallation(tx,b);
   if(ctx.actorGhId!==session.ghId||b.version!==before.version||b.status!=='OPEN'||b.captureRequestKey||b.captureId||b.chainFundingId||b.fundingHold)throw new AuthError(409,'This bounty already has a funding reservation or changed.');
   const [paypal]=await tx.select().from(fundingAttempts).where(and(eq(fundingAttempts.bountyId,b.id),eq(fundingAttempts.active,true)));
   const [wallet]=await tx.select().from(chainWallets).where(eq(chainWallets.ghId,session.ghId)).for('share');
   if(paypal||!wallet||wallet.address!==terms.chain.refundWallet||terms.repoId!==b.repoId||terms.issueNumber!==b.issueNumber||terms.creatorGhId!==b.createdByGhId||terms.amountCents!==b.amountCents)throw new AuthError(409,'Wallet, terms or payment state changed.');
   const id=randomUUID();const [r]=await tx.insert(chainTransfers).values({id,bountyId:b.id,kind:'funding',ghId:session.ghId,walletVersion:wallet.version,source:wallet.address,destination:treasury,amount:b.amountCents,terms}).returning();
   await tx.update(bounties).set({currency:'PYUSD',chainFundingId:id,status:'CAPTURING',fundedTerms:terms,fundingActorGhId:session.ghId,version:sql`${bounties.version}+1`,updatedAt:now()}).where(eq(bounties.id,b.id));
   await tx.insert(bountyActivity).values({bountyId:b.id,actorGhId:session.ghId,source:'confirmation',action:'pyusd_funding_reserved',metadata:{transferId:id,termsHash:termsHash(terms),network:'solana-devnet'}});await projection(tx,b,id);if(!r)throw new Error('Reservation missing');return r;
  });
 }
 async function prepareFunding(id:string,session:Session){
  enabled();let r=await row(id);if(r.kind!=='funding'||r.ghId!==session.ghId)throw new AuthError(403);if(r.wire)return r;
  const prepared=await provider.prepare(transfer(r),false);
  await db.withTransaction(async tx=>{await assertSession(tx,session,now());const b=await lockBounty(tx,r.bountyId);if(!b||b.chainFundingId!==id||b.status!=='CAPTURING'||b.fundingHold)throw new AuthError(409);await assertInstallation(tx,b);
   await tx.update(chainTransfers).set({...prepared}).where(and(eq(chainTransfers.id,id),isNull(chainTransfers.message)));
  });r=await row(id);return r;
 }
 async function signFunding(id:string,session:Session,wire:string){
  enabled();const r=await row(id);if(r.kind!=='funding'||r.ghId!==session.ghId||!r.message)throw new AuthError(403);
  let signed:ReturnType<ChainProvider['accept']>;
  try{signed=provider.accept(r.message,wire);}catch{throw new AuthError(400,'The wallet returned an invalid or changed transaction. Nothing was saved or sent by this request. Keep this checkout for investigation; do not send a separate transfer.');}
  await db.withTransaction(async tx=>{await assertSession(tx,session,now());const b=await lockBounty(tx,r.bountyId);if(!b||b.chainFundingId!==id||b.status!=='CAPTURING'||b.fundingHold)throw new AuthError(409);await assertInstallation(tx,b);
   const [current]=await tx.select().from(chainTransfers).where(eq(chainTransfers.id,id)).for('update');if(!current||!['RESERVED','SIGNED'].includes(current.status)||current.signature&&current.signature!==signed.signature)throw new AuthError(409,'Existing signed transfer retained.');
   if(!current.signature){
    await tx.update(chainTransfers).set({...signed,status:'SIGNED',nextCheckAt:now()}).where(eq(chainTransfers.id,id));
    await tx.insert(bountyActivity).values({bountyId:r.bountyId,actorGhId:session.ghId,source:'confirmation',action:'pyusd_funding_signed',metadata:{transferId:id,signature:signed.signature}});
   }
  });return row(id);
 }
 async function signingReady(id:string,session:Session){
  const r=await prepareFunding(id,session),b=await db.orm.select().from(bounties).where(eq(bounties.id,r.bountyId));
  if(r.signature||r.status!=='RESERVED'||b[0]?.fundingHold||b[0]?.status!=='CAPTURING')throw new AuthError(409,'This transfer is not available for signing. Refresh its status.');
  if(!r.wire)throw new Error('Preparation validation unavailable');
  if(!await provider.validPreparation(r.wire)){
   const proof=r.lastValidBlockHeight!==null?await provider.expiredUnfunded?.(r.wire,transfer(r),r.lastValidBlockHeight):null;
   if(!proof)throw new AuthError(409,'This devnet transaction has expired or its outcome is uncertain. The existing checkout is preserved for reconciliation.');
   const nextId=randomUUID();
   // No external calls under SQL locks. Old bytes remain permanently auditable.
   await db.withTransaction(async tx=>{
    await assertSession(tx,session,now());const current=await lockBounty(tx,r.bountyId);
    if(!current||current.chainFundingId!==r.id||current.status!=='CAPTURING'||current.fundingHold||current.needsAttention||current.chainFundingSignature||current.captureId||!current.fundedTerms||termsHash(current.fundedTerms)!==termsHash(r.terms))throw new AuthError(409,'Checkout changed. Refresh status before continuing.');
    await assertInstallation(tx,current);
    const [old]=await tx.select().from(chainTransfers).where(eq(chainTransfers.id,r.id)).for('update');
    if(!old||old.status!=='RESERVED'||old.signature||old.message!==r.message||old.wire!==r.wire||old.ghId!==session.ghId)throw new AuthError(409,'The existing transaction changed. Refresh status.');
    await tx.update(chainTransfers).set({status:'EXPIRED',attention:'Expired unsigned preparation; finalized chain check found no reference activity.'}).where(eq(chainTransfers.id,r.id));
    await tx.insert(chainTransfers).values({id:nextId,supersedesId:r.id,bountyId:r.bountyId,kind:'funding',ghId:r.ghId,walletVersion:r.walletVersion,source:r.source,destination:r.destination,amount:r.amount,terms:r.terms});
    await tx.update(bounties).set({chainFundingId:nextId,version:sql`${bounties.version}+1`,updatedAt:now()}).where(eq(bounties.id,r.bountyId));
    await tx.insert(bountyActivity).values({bountyId:r.bountyId,actorGhId:session.ghId,source:'confirmation',action:'pyusd_expired_preparation_replaced',metadata:{previousTransferId:r.id,transferId:nextId,finalizedSlot:proof.slot,finalizedHeight:proof.height,referenceTransactions:0}});
   });
   return prepareFunding(nextId,session);
  }
  return r;
 }
 async function reserveAward(awardId:string){
  enabled();const treasury=await provider.treasury();
  return db.withTransaction(async tx=>{const [a]=await tx.select().from(awards).where(eq(awards.id,awardId));if(!a)return;const b=await lockBounty(tx,a.bountyId);
   if(!b||b.currency!=='PYUSD'||b.fundingHold||!hasConfirmedFunding(b)||b.fundedTerms?.version!==6||b.fundedTerms.chain.treasury!==treasury)return;await assertInstallation(tx,b);
   const existing=await tx.select().from(chainTransfers).where(eq(chainTransfers.awardId,awardId));if(existing.length)return;
   if(!a.allocation.length||a.allocation.some(x=>!Number.isInteger(x.cents)||x.cents<=0)||new Set(a.allocation.map(x=>x.ghId)).size!==a.allocation.length||a.allocation.reduce((n,x)=>n+x.cents,0)!==b.amountCents||a.amountCents!==b.amountCents)throw new Error('Invalid committed allocation');
   const wallets=await tx.select().from(chainWallets).where(inArray(chainWallets.ghId,a.allocation.map(x=>x.ghId))).for('share');
   if(a.allocation.some(x=>!wallets.some(w=>w.ghId===x.ghId&&w.address!==treasury))){await tx.update(bounties).set({status:'AWAITING_CLAIM'}).where(eq(bounties.id,b.id));return;}
   for(const share of a.allocation){const wallet=wallets.find(w=>w.ghId===share.ghId);if(!wallet)throw new Error('Wallet missing');await tx.insert(chainTransfers).values({id:randomUUID(),kind:'payout',bountyId:b.id,awardId:a.id,ghId:share.ghId,walletVersion:wallet.version,source:treasury,destination:wallet.address,amount:share.cents,terms:b.fundedTerms});}
   await tx.update(bounties).set({status:'PAYING',version:sql`${bounties.version}+1`,updatedAt:now()}).where(eq(bounties.id,b.id));await projection(tx,b,'payout:'+awardId);
  });
 }
 async function refundFresh(r:ChainTransfer){
  if(!cancellation||!env.PYUSD_REFUNDS_ENABLED)return false;
  const v=await cancellation.refresh(r.requestId??'0');
  if(!v.request.reviewerId||v.request.status!=='EXECUTING'||v.request.evidenceVersion!==r.evidenceVersion||!v.bundle.complete||v.bounty.status!=='REFUNDING'||v.bounty.fundingHold||v.bounty.version!==(r.bountyVersion??0)+1){await db.orm.update(chainTransfers).set({attention:'Refund evidence changed; retain reservation for independent reconciliation'}).where(eq(chainTransfers.id,r.id));return false;}
  await cancellation.operator(v.request.reviewerId,v.bounty,v.request);return true;
 }
 async function reserveRefund(requestId:string){
  enabled();if(!cancellation||!env.PYUSD_REFUNDS_ENABLED)throw new AuthError(409,'PYUSD refunds are disabled.');
  const v=await cancellation.refresh(requestId),b=v.bounty,r=v.request;cancellation.enabled(b);
  if(b.currency!=='PYUSD'||b.fundedTerms?.version!==6||!r.reviewerId||r.status!=='APPROVED'||!v.bundle.complete||!r.noticeEndsAt||r.noticeEndsAt>now())throw new AuthError(409,'Current independent approval and elapsed notice required.');
  await cancellation.operator(r.reviewerId,b,r);
  const funding=await row(b.chainFundingId??'');
  if(funding.kind!=='funding'||funding.status!=='SUCCESS'||funding.ghId!==r.funderId||funding.source!==b.fundedTerms.chain.refundWallet||funding.destination!==await provider.treasury()||funding.amount!==b.amountCents||!funding.wire||await provider.observe(funding.wire,transfer(funding))!=='success')throw new AuthError(409,'Original finalized PYUSD funding could not be verified.');
  return db.withTransaction(async tx=>{const current=await lockBounty(tx,b.id);if(!current)throw new AuthError(404);await cancellation.eligible(tx,current);const [fresh]=await tx.select().from(cancellationRequests).where(eq(cancellationRequests.id,r.id)).for('update');
   if(current.version!==b.version||fresh?.status!=='APPROVED'||fresh.evidenceVersion!==r.evidenceVersion||fresh.reviewerId!==r.reviewerId)throw new AuthError(409,'Cancellation approval changed.');
   const [intent]=await tx.insert(chainTransfers).values({id:randomUUID(),kind:'refund',bountyId:b.id,requestId:r.id,evidenceVersion:r.evidenceVersion,bountyVersion:b.version,ghId:funding.ghId,walletVersion:funding.walletVersion,source:funding.destination,destination:funding.source,amount:funding.amount,terms:funding.terms}).returning();
   await tx.update(cancellationRequests).set({status:'EXECUTING'}).where(eq(cancellationRequests.id,r.id));await tx.update(bounties).set({status:'REFUNDING',version:sql`${bounties.version}+1`,updatedAt:now()}).where(eq(bounties.id,b.id));await projection(tx,b,'refund:'+r.id);return intent;
  });
 }
 async function reconcile(id:string){
  enabled();let r=await row(id);if(r.status==='SUCCESS'||r.status==='EXPIRED')return;
  try {
   if(r.terms.version!==6||r.terms.chain.treasury!==await provider.treasury())throw new Error('Treasury configuration changed');
   if(r.kind==='funding'&&!r.signature){
    if(!r.message)return;const recovered=await provider.recover?.(transfer(r),r.message);if(!recovered)return;
    const signed=provider.accept(r.message,recovered.wire);
    await db.orm.update(chainTransfers).set({...signed,status:'SIGNED'}).where(and(eq(chainTransfers.id,id),isNull(chainTransfers.signature),inArray(chainTransfers.status,['RESERVED','HOLD'])));r=await row(id);if(r.status==='EXPIRED')return;
   }
   if(r.kind==='refund'&&!cancellation)return;
   if(r.kind!=='funding'&&!r.signature){
    if(r.kind==='refund'&&!await refundFresh(r))return;
    const prepared=await provider.prepare(transfer(r),true);if(!prepared.signature)throw new Error('Signature missing');
    await db.withTransaction(async tx=>{const b=await lockBounty(tx,r.bountyId);if(!b||b.fundingHold||!hasConfirmedFunding(b)||b.status!==(r.kind==='refund'?'REFUNDING':'PAYING'))throw new Error('Delivery held');await assertInstallation(tx,b);
     if(r.kind==='refund'){const [request]=await tx.select().from(cancellationRequests).where(eq(cancellationRequests.id,r.requestId??'0')),[a]=await tx.select().from(awards).where(eq(awards.bountyId,b.id));if(a||request?.status!=='EXECUTING'||request.evidenceVersion!==r.evidenceVersion||b.version!==(r.bountyVersion??0)+1)throw new Error('Refund evidence changed');}
     await tx.update(chainTransfers).set({...prepared,status:'SIGNED'}).where(and(eq(chainTransfers.id,id),isNull(chainTransfers.signature)));
    });r=await row(id);
   }
   if(!r.signature||!r.wire)return;
   // Read before sending; a lost broadcast response never changes the transaction identity.
   let result=await provider.observe(r.wire,transfer(r));
   if(result==='pending'&&r.status!=='HOLD'){
    if(r.kind==='refund'&&!await refundFresh(r))return;
    const [freshBounty]=await db.orm.select().from(bounties).where(eq(bounties.id,r.bountyId));if(!freshBounty||freshBounty.fundingHold)throw new Error('Funding held');
    await db.withTransaction(async tx=>{const b=await lockBounty(tx,r.bountyId);if(!b||b.fundingHold)throw new Error('Funding held');await assertInstallation(tx,b);});
    await provider.publish(r.wire);result=await provider.observe(r.wire,transfer(r));}
   if(result==='failed'||result==='unknown'){
    if(r.status==='HOLD')return;
    await db.withTransaction(async tx=>{const b=await lockBounty(tx,r.bountyId);if(!b)return;const changed=await tx.update(chainTransfers).set({status:'HOLD',attention:result==='failed'?'Transaction failed; award remains reserved; operator review required':'Receipt mismatch; retain original transaction and investigate'}).where(and(eq(chainTransfers.id,id),ne(chainTransfers.status,'SUCCESS'))).returning({id:chainTransfers.id});if(!changed.length)return;await tx.update(bounties).set({needsAttention:true,attentionReason:'PYUSD transfer needs investigation; do not send a replacement'}).where(eq(bounties.id,b.id));await projection(tx,b,'hold:'+id);});return;
   }
   if(result!=='success')return;
   await db.withTransaction(async tx=>{const b=await lockBounty(tx,r.bountyId);if(!b)return;const [fresh]=await tx.select().from(chainTransfers).where(eq(chainTransfers.id,id)).for('update');if(!fresh||fresh.signature!==r.signature||fresh.status==='SUCCESS')return;
    await tx.update(chainTransfers).set({status:'SUCCESS',attention:null}).where(eq(chainTransfers.id,id));
    if(r.kind==='funding'){
     if(b.chainFundingId!==id||b.currency!=='PYUSD'||b.status!=='CAPTURING'||!b.fundedTerms||termsHash(b.fundedTerms)!==termsHash(r.terms)){await tx.update(bounties).set({fundingHold:true,needsAttention:true,attentionReason:'Late or mismatched PYUSD funding; operator reconciliation required'}).where(eq(bounties.id,b.id));return;}
     await tx.update(bounties).set({status:'FUNDED',chainFundingSignature:r.signature,fundedAt:now(),version:sql`${bounties.version}+1`,updatedAt:now()}).where(eq(bounties.id,b.id));
    }else if(r.kind==='refund'){
     const [a]=await tx.select().from(awards).where(eq(awards.bountyId,b.id));if(a)throw new Error('Award/refund invariant violated');
     const [request]=await tx.select().from(cancellationRequests).where(eq(cancellationRequests.id,r.requestId??'0'));const changed=request?.evidenceVersion!==r.evidenceVersion;
     await tx.update(cancellationRequests).set({status:'COMPLETED'}).where(eq(cancellationRequests.id,r.requestId??'0'));
     await tx.update(bounties).set({status:'CANCELLED',version:sql`${bounties.version}+1`,needsAttention:changed,attentionReason:changed?'Evidence changed after PYUSD refund submission; investigate':null,updatedAt:now()}).where(eq(bounties.id,b.id));
    }else{
     const others=await tx.select().from(chainTransfers).where(eq(chainTransfers.awardId,r.awardId??'0'));
     if(others.length&&others.every(x=>x.status==='SUCCESS'))await tx.update(bounties).set({status:'PAID',version:sql`${bounties.version}+1`,updatedAt:now()}).where(eq(bounties.id,b.id));
    }
    await tx.insert(bountyActivity).values({bountyId:b.id,source:'solana',action:r.kind==='funding'?'pyusd_funded':r.kind==='refund'?'pyusd_refunded':'pyusd_payout_delivered',metadata:{transferId:id,signature:r.signature,network:'solana-devnet'}});await projection(tx,b,'success:'+id);
   });
  }catch {await db.orm.update(chainTransfers).set({attention:'Transfer pending or unavailable. Original identity retained; do not send another payment.'}).where(and(eq(chainTransfers.id,id),ne(chainTransfers.status,'SUCCESS'),ne(chainTransfers.status,'EXPIRED')));}
  finally {await db.orm.update(chainTransfers).set({nextCheckAt:new Date(now().getTime()+30000)}).where(and(eq(chainTransfers.id,id),ne(chainTransfers.status,'EXPIRED')));}
 }
 let last=0;
 async function submitFunding(id:string,session:Session,wire:string){
  await signFunding(id,session,wire);
  // Start exact-byte reconciliation immediately after durable persistence;
  // a short-lived wallet transaction must not wait for the polling cadence.
  await reconcile(id);return row(id);
 }
 async function tick(){if(!env.PYUSD_DEVNET_ENABLED||now().getTime()-last<10000)return;last=now().getTime();
  const [pending]=await db.orm.select().from(chainTransfers).where(and(inArray(chainTransfers.kind,cancellation?['refund']:['funding','payout']),inArray(chainTransfers.status,['RESERVED','SIGNED','HOLD']),lte(chainTransfers.nextCheckAt,now()))).orderBy(chainTransfers.nextCheckAt).limit(1);if(pending)await reconcile(pending.id);
  const [claim]=await db.orm.select({id:awards.id,bountyId:bounties.id}).from(awards).innerJoin(bounties,eq(bounties.id,awards.bountyId)).where(and(eq(bounties.currency,'PYUSD'),eq(bounties.status,'AWAITING_CLAIM'))).orderBy(bounties.updatedAt).limit(1);if(claim){try{await reserveAward(claim.id);}catch{await db.orm.update(bounties).set({needsAttention:true,attentionReason:'PYUSD recipient reservation unavailable; award remains committed'}).where(eq(bounties.id,claim.bountyId));}await db.orm.update(bounties).set({updatedAt:now()}).where(eq(bounties.id,claim.bountyId));}
 }
 return {reserveRefund,refundFresh,reserveFunding,prepareFunding,signingReady,signFunding,submitFunding,reserveAward,reconcile,tick,get:row};
}
