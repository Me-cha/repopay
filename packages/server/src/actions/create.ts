import { and, eq, ne, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { bounties, installations, bountyActivity } from '../db/schema.js';
import type { Installation, Repository } from '../github/app.js';
import type { LeasedJob } from '../jobs/kinds.js';
import { assertLease, enqueue } from '../jobs/queue.js';
export interface CreateDraftInput { installation:Installation;repo:Repository;issueNumber:number;actorId:string;amountCents:number;source:'label'|'command';authorized:boolean }
export async function createDraft(db:Database,job:LeasedJob,input:CreateDraftInput,maxAttempts:number) {
 if(!input.authorized||input.installation.suspended_at||!Number.isSafeInteger(input.amountCents)||input.amountCents<=0)throw new Error('Draft not authorized');
 return db.withTransaction(async tx=>{
  await assertLease(tx,job);
  // Shared per-installation guard also fences concurrent removal/suspension.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`installation:${input.installation.id}`}))`);
  const [old]=await tx.select().from(installations).where(eq(installations.id,input.installation.id));
  if(old&&(old.suspendedAt||old.deletedAt))throw new Error('App access unavailable; reconcile installation');
  await tx.insert(installations).values({id:input.installation.id,accountId:input.installation.account.id,accountLogin:input.installation.account.login}).onConflictDoUpdate({target:installations.id,set:{accountLogin:input.installation.account.login,updatedAt:sql`now()`}});
  const [created]=await tx.insert(bounties).values({installationId:input.installation.id,repoId:input.repo.id,repoFullName:input.repo.full_name,issueNumber:input.issueNumber,amountCents:input.amountCents,createdByGhId:input.actorId,createdVia:input.source}).onConflictDoNothing().returning();
  const bounty=created??(await tx.select().from(bounties).where(and(eq(bounties.repoId,input.repo.id),eq(bounties.issueNumber,input.issueNumber),ne(bounties.status,'CANCELLED'))))[0];
  if(!bounty)throw new Error('Bounty unavailable');
  if(created)await tx.insert(bountyActivity).values({bountyId:bounty.id,actorGhId:input.actorId,source:input.source,action:'draft_created',metadata:{amountCents:input.amountCents}});
  await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:bounty.id},dedupeKey:`sync:${bounty.id}:${job.id}`,maxAttempts});
  return bounty;
 });
}
