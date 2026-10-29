import type { Database } from '../db/client.js';
import type { FundingEnv } from '../env.js';
import type { Session } from '../github/oauth.js';
import type { ActorContext } from '../domain/types.js';
import type { Bounty,FundingIntent } from '../db/schema.js';
import type { FundedTerms } from '../domain/funded-terms.js';
import { randomUUID } from 'node:crypto';
import { and,eq,sql } from 'drizzle-orm';
import { actionTokens,bounties,bountyActivity,fundingAttempts } from '../db/schema.js';
import { AuthError } from '../github/oauth.js';
import { termsSchema,termsHash } from '../domain/funded-terms.js';
import { randomToken,sha256 } from '../util/crypto.js';
import { assertContext,assertInstallation,assertSession } from './guards.js';
import type { Transaction } from '../db/transaction.js';
async function available(tx:Transaction,ctx:ActorContext,id:string,version:number) {
 const [b]=await tx.select().from(bounties).where(eq(bounties.id,id)).for('update');
 if(!b)throw new AuthError(404,'Bounty not found.');assertContext(ctx,b,'fund');await assertInstallation(tx,b);
 if(b.version!==version||b.status!=='OPEN'||b.captureRequestKey||b.captureId||b.fundingHold)throw new AuthError(409,'This bounty changed or funding is held.');
 const [active]=await tx.select().from(fundingAttempts).where(and(eq(fundingAttempts.bountyId,id),eq(fundingAttempts.active,true)));
 if(active)throw new AuthError(409,'Resolve the existing funding attempt before starting another.');return b;
}
function boundTerms(b:Bounty,terms:FundedTerms) {
 if(terms.version!==3)throw new AuthError(409,'New funding requires a validated repository-owner Copilot sponsor and fixed model.');
 if(terms.repoId!==b.repoId||terms.issueNumber!==b.issueNumber||terms.creatorGhId!==b.createdByGhId||terms.amountCents!==b.amountCents||terms.currency!==b.currency)throw new AuthError(409,'Funding terms changed.');
}
export async function prepareFunding(db:Database,env:FundingEnv,session:Session,ctx:ActorContext,bounty:Bounty,input:FundedTerms,clock=()=>new Date()):Promise<string> {
 const terms=termsSchema.parse(input),token=randomToken();
 await db.withTransaction(async tx=>{
  const stored=await assertSession(tx,session,clock());
  const b=await available(tx,ctx,bounty.id,bounty.version);boundTerms(b,terms);
  const now=clock();if(stored.expiresAt<=now)throw new AuthError();
  await tx.insert(actionTokens).values({tokenHash:sha256(token),bountyId:b.id,action:'fund',params:{terms,hash:termsHash(terms)},bountyVersion:b.version,requestedByGhId:session.ghId,expiresAt:new Date(now.getTime()+env.ACTION_TOKEN_TTL_SEC*1000)});
 });return token;
}
export async function confirmFunding(db:Database,env:FundingEnv,session:Session,ctx:ActorContext,token:string,clock=()=>new Date()):Promise<FundingIntent> {
 return db.withTransaction(async tx=>{
  const storedSession=await assertSession(tx,session,clock());
  const [stored]=await tx.select().from(actionTokens).where(eq(actionTokens.tokenHash,sha256(token))).for('update');
  if(!stored||stored.action!=='fund')throw new AuthError(404,'Funding confirmation not found.');
  if(stored.usedAt||stored.expiresAt<=clock())throw new AuthError(409,'Confirmation used or expired.');
  const b=await available(tx,ctx,stored.bountyId,stored.bountyVersion);
  const terms=termsSchema.parse(stored.params.terms);boundTerms(b,terms);
  if(termsHash(terms)!==stored.params.hash)throw new AuthError(409,'Funding terms changed.');
  const [count]=await tx.select({next:sql<number>`coalesce(max(${fundingAttempts.attemptNumber}),0)+1`}).from(fundingAttempts).where(eq(fundingAttempts.bountyId,b.id));
  const [attempt]=await tx.insert(fundingAttempts).values({checkoutOrigin:env.PUBLIC_URL,bountyId:b.id,attemptNumber:count?.next??1,actorGhId:ctx.actorGhId,terms,termsHash:termsHash(terms),amountCents:b.amountCents,currency:b.currency,orderRequestKey:randomUUID(),captureRequestKey:randomUUID()}).returning();
  if(!attempt)throw new Error('Funding insert failed');
  const now=clock();if(storedSession.expiresAt<=now)throw new AuthError();if(stored.expiresAt<=now)throw new AuthError(409,'Confirmation expired.');
  await tx.update(actionTokens).set({usedAt:now,usedByGhId:session.ghId}).where(eq(actionTokens.tokenHash,stored.tokenHash));
  await tx.update(bounties).set({currentFundingAttemptId:attempt.id,version:sql`${bounties.version}+1`,updatedAt:now}).where(eq(bounties.id,b.id));
  await tx.insert(bountyActivity).values({bountyId:b.id,actorGhId:ctx.actorGhId,source:'confirmation',action:'funding_requested',metadata:{attemptId:attempt.id,termsHash:attempt.termsHash}});
  return attempt;
 });
}
