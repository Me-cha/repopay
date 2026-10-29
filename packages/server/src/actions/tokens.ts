import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client.js';
import { actionTokens,bounties,type Bounty } from '../db/schema.js';
import type { ActorContext } from '../domain/types.js';
import type { AuthEnv } from '../env.js';
import { AuthError,type Session } from '../github/oauth.js';
import { randomToken,sha256 } from '../util/crypto.js';
import { assertCancellable,assertContext,assertInstallation,assertSession } from './guards.js';
import { cancelDraft } from './cancel.js';
import { enqueue } from '../jobs/queue.js';
const paramsSchema=z.object({}).strict();
export async function issueActionToken(db:Database,env:AuthEnv,session:Session,ctx:ActorContext,bounty:Bounty,clock=()=>new Date()):Promise<string> {
 const token=randomToken();
 await db.withTransaction(async tx=>{
  const storedSession=await assertSession(tx,session,clock());
  const [current]=await tx.select().from(bounties).where(eq(bounties.id,bounty.id)).for('update');
  if(!current)throw new AuthError(404,'Bounty not found.');assertContext(ctx,current,'cancel_draft');await assertInstallation(tx,current);assertCancellable(current);
  if(current.version!==bounty.version)throw new AuthError(409,'This bounty changed. Reload the preview.');
  const now=clock();if(storedSession.expiresAt<=now)throw new AuthError();
  await tx.insert(actionTokens).values({tokenHash:sha256(token),bountyId:current.id,action:'cancel_draft',params:{},bountyVersion:current.version,requestedByGhId:session.ghId,expiresAt:new Date(now.getTime()+env.ACTION_TOKEN_TTL_SEC*1000)});
 });return token;
}
export async function readActionToken(db:Database,token:string) {
 if(!/^[-\w]{43}$/.test(token))throw new AuthError(404,'Confirmation not found.');
 const [stored]=await db.orm.select().from(actionTokens).where(eq(actionTokens.tokenHash,sha256(token)));
 if(!stored)throw new AuthError(404,'Confirmation not found.');return stored;
}
export function assertToken(stored:typeof actionTokens.$inferSelect,bounty:Bounty,now:Date) {
 if(stored.usedAt||stored.expiresAt<=now||stored.bountyVersion!==bounty.version)throw new AuthError(409,'This confirmation was used, expired, or the bounty changed. Check its status or request a fresh link.');
 if(stored.action!=='cancel_draft'||!paramsSchema.safeParse(stored.params).success)throw new AuthError(400,'Invalid confirmation action.');
 assertCancellable(bounty);
}
export async function confirmAction(db:Database,env:AuthEnv,session:Session,ctx:ActorContext,token:string,clock=()=>new Date()):Promise<Bounty> {
 return db.withTransaction(async tx=>{
  const storedSession=await assertSession(tx,session,clock());
  const [stored]=await tx.select().from(actionTokens).where(eq(actionTokens.tokenHash,sha256(token))).for('update');
  if(!stored)throw new AuthError(404,'Confirmation not found.');
  const [bounty]=await tx.select().from(bounties).where(eq(bounties.id,stored.bountyId)).for('update');if(!bounty)throw new AuthError(404,'Bounty not found.');
  assertToken(stored,bounty,clock());
  const updated=await cancelDraft(tx,ctx,bounty.id,stored.bountyVersion);
  const now=clock();assertToken(stored,bounty,now);if(storedSession.expiresAt<=now)throw new AuthError();
  await tx.update(actionTokens).set({usedAt:now,usedByGhId:session.ghId}).where(eq(actionTokens.tokenHash,stored.tokenHash));
  await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:bounty.id},dedupeKey:`cancel:${stored.tokenHash}`,maxAttempts:env.RECONCILIATION_MAX_ATTEMPTS});
  return updated;
 });
}
