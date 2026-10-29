import { eq,sql } from 'drizzle-orm';
import type { Transaction } from '../db/transaction.js';
import { bounties,bountyActivity,type Bounty } from '../db/schema.js';
import type { ActorContext } from '../domain/types.js';
import { AuthError } from '../github/oauth.js';
import { assertCancellable,assertContext,assertInstallation } from './guards.js';
// The caller owns the transaction that also consumes the confirmation token.
export async function cancelDraft(tx:Transaction,ctx:ActorContext,bountyId:string,expectedVersion:number):Promise<Bounty> {
 const [bounty]=await tx.select().from(bounties).where(eq(bounties.id,bountyId)).for('update');
 if(!bounty)throw new AuthError(404,'Bounty not found.');
 assertContext(ctx,bounty,'cancel_draft');await assertInstallation(tx,bounty);
 if(bounty.version!==expectedVersion)throw new AuthError(409,'This bounty changed. Request a fresh confirmation.');
 assertCancellable(bounty);
 const [updated]=await tx.update(bounties).set({status:'CANCELLED',version:sql`${bounties.version}+1`,updatedAt:sql`now()`}).where(eq(bounties.id,bountyId)).returning();
 if(!updated)throw new Error('Bounty disappeared');
 await tx.insert(bountyActivity).values({bountyId,actorGhId:ctx.actorGhId,source:'confirm',action:'draft_cancelled',metadata:{fromStatus:'OPEN',toStatus:'CANCELLED',amountCents:bounty.amountCents}});
 return updated;
}
