import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import type { Transaction } from '../db/transaction.js';
import { bounties,installations,sessions,type Bounty } from '../db/schema.js';
import { githubId,type ActorContext } from '../domain/types.js';
import { AuthError,type AuthService,type Session } from '../github/oauth.js';
import type { GitHub } from '../github/app.js';
import { currentAccess } from '../github/permissions.js';
export type ActionKind='read'|'cancel_draft'|'fund'|'review';
export async function authorizeAction(auth:AuthService,github:GitHub,session:Session,bounty:Bounty,action:ActionKind):Promise<ActorContext> {
 try {
  await currentAccess(github,bounty.installationId,bounty.repoId);
  const access=await auth.provider.repository(session.accessToken,bounty.repoId);
  if(access.id!==bounty.repoId||!access.read||(action!=='read'&&!access.write))throw new AuthError(403,'Current repository write permission is required for this action.');
  return {actorGhId:githubId(session.ghId),source:'confirmation',authorization:{repoId:githubId(bounty.repoId),action,role:action==='read'?'participant':'maintainer',checkedAt:auth.clock.now()}};
 }catch(error){if(error instanceof AuthError)throw error;throw new AuthError(503,'Repository access could not be verified. Try again.');}
}
export async function findBounty(db:Database,id:string):Promise<Bounty> {
 if(!/^[1-9]\d{0,18}$/.test(id))throw new AuthError(404,'Bounty not found.');
 const [bounty]=await db.orm.select().from(bounties).where(eq(bounties.id,id));if(!bounty)throw new AuthError(404,'Bounty not found.');return bounty;
}
export async function assertSession(tx:Transaction,session:Session,now:Date) {
 const [stored]=await tx.select().from(sessions).where(eq(sessions.id,session.id)).for('update');
 if(!stored||stored.ghId!==session.ghId||stored.expiresAt<=now)throw new AuthError();
 return stored;
}
// Installation reconciliation locks the installation row, then its bounties.
// Actions take the same order so the two cannot deadlock.
export async function lockBounty(tx:Transaction,id:string):Promise<Bounty|undefined> {
 const [ref]=await tx.select({installationId:bounties.installationId}).from(bounties).where(eq(bounties.id,id));if(!ref)return undefined;
 await tx.select({id:installations.id}).from(installations).where(eq(installations.id,ref.installationId)).for('share');
 const [bounty]=await tx.select().from(bounties).where(eq(bounties.id,id)).for('update');return bounty;
}
export async function assertInstallation(tx:Transaction,bounty:Bounty) {
 const [installation]=await tx.select().from(installations).where(eq(installations.id,bounty.installationId)).for('share');
 if(!installation||installation.suspendedAt||installation.deletedAt)throw new AuthError(403,'Restore GitHub App access before continuing.');
}
export function assertContext(ctx:ActorContext,bounty:Bounty,action:ActionKind) {
 if((ctx.source!=='confirmation'&&!(action==='cancel_draft'&&ctx.source==='github_comment'))||ctx.authorization.repoId!==bounty.repoId||ctx.authorization.action!==action||ctx.authorization.role!=='maintainer')throw new AuthError(403,'This action is not authorized.');
}
export function assertCancellable(bounty:Bounty) {
 if(bounty.status!=='OPEN'||bounty.captureRequestKey||bounty.captureId||bounty.fundedAt)throw new AuthError(409,'This bounty cannot be cancelled as an unfunded draft. Funding or cancellation review must be resolved first.');
}
