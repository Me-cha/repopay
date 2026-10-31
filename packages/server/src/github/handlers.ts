import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Database } from '../db/client.js';
import { eq,sql } from 'drizzle-orm';
import { deliveries,copilotSponsors,sessions } from '../db/schema.js';
import { enqueue } from '../jobs/queue.js';
import { parseCommand, parseLabel } from './commands.js';
import type { Work } from '../jobs/kinds.js';
export class WebhookError extends Error { constructor(readonly status: number) { super('Webhook rejected'); } }
export interface GitHubHeaders { event: string; deliveryId: string; signature: string }
// Reject unsafe numeric values rather than stringifying IDs that JSON.parse rounded.
export const apiId = z.union([z.number().int().positive().max(Number.MAX_SAFE_INTEGER).transform(String),z.string().regex(/^[1-9]\d*$/).max(30)]);
const base = z.object({ action:z.string().optional(),installation:z.object({id:apiId}),repository:z.object({id:apiId}).optional() });
function normalize(event: string, input: unknown, occurrence: string, ownAppId=''): Work | null {
 if (!['issue_comment','issues','installation','installation_repositories','pull_request','check_run','check_suite','status'].includes(event)) return null;
 const b=base.parse(input);
 if (event==='installation' || event==='installation_repositories') {
  const v=z.object({repositories_removed:z.array(z.object({id:apiId})).max(1000).optional()}).parse(input);
  return {kind:'refresh_installation',installationId:b.installation.id,removedRepoIds:v.repositories_removed?.map(r=>r.id)??[]};
 }
 if(event==='pull_request') {
  if(!['opened','reopened','synchronize','closed','edited','ready_for_review'].includes(b.action??''))return null;
  const v=z.object({pull_request:z.object({number:z.number().int().positive(),base:z.object({repo:z.object({id:apiId}).nullable()})})}).parse(input);
  if(!b.repository||v.pull_request.base.repo?.id!==b.repository.id)return null;
  return {kind:'sync_pull_request',installationId:b.installation.id,repoId:b.repository.id,prNumber:v.pull_request.number};
 }
 if(event==='check_run') {
  if(b.action!=='completed')return null;const v=z.object({check_run:z.object({head_sha:z.string().regex(/^[a-f0-9]{40,64}$/i),app:z.object({id:apiId}).nullable()})}).parse(input);
  if(!b.repository||v.check_run.app?.id===ownAppId)return null;
  return {kind:'refresh_verification_sha',installationId:b.installation.id,repoId:b.repository.id,sha:v.check_run.head_sha};
 }
 if(event==='check_suite') {
  if(b.action!=='completed')return null;const v=z.object({check_suite:z.object({head_sha:z.string().regex(/^[a-f0-9]{40,64}$/i),app:z.object({id:apiId}).nullable().optional()})}).parse(input);
  if(!b.repository||v.check_suite.app?.id===ownAppId)return null;return {kind:'refresh_verification_sha',installationId:b.installation.id,repoId:b.repository.id,sha:v.check_suite.head_sha};
 }
 if(event==='status') {
  const v=z.object({sha:z.string().regex(/^[a-f0-9]{40,64}$/i)}).parse(input);if(!b.repository)return null;
  return {kind:'refresh_verification_sha',installationId:b.installation.id,repoId:b.repository.id,sha:v.sha};
 }
 if (event==='issue_comment' && b.action==='created') {
  const v=z.object({issue:z.object({number:z.number().int().positive(),pull_request:z.unknown().optional()}),comment:z.object({id:apiId,body:z.string().max(65536),user:z.object({id:apiId,type:z.string()})})}).parse(input);
  if (v.comment.user.type!=='User' || !b.repository) return null;
  const command=parseCommand(v.comment.body); if (!command) return null;
  if(v.issue.pull_request&&!['approve','reject','contribute','confirm-contributor','invalid'].includes(command.kind))return null;
  return {kind:'run_command',installationId:b.installation.id,repoId:b.repository.id,issueNumber:v.issue.number,...(v.issue.pull_request?{isPullRequest:true}:{}),commentId:v.comment.id,actorId:v.comment.user.id,command};
 }
 if (event==='issues' && b.action==='labeled') {
  const v=z.object({issue:z.object({number:z.number().int().positive(),pull_request:z.unknown().optional()}),label:z.object({name:z.string()}),sender:z.object({id:apiId,type:z.string()})}).parse(input);
  const amount=parseLabel(v.label.name); if (!amount || !b.repository || v.issue.pull_request || v.sender.type!=='User') return null;
  return {kind:'create_bounty_from_label',installationId:b.installation.id,repoId:b.repository.id,issueNumber:v.issue.number,actorId:v.sender.id,amount,occurrence};
 }
 return null;
}
export async function ingestGitHub(db: Database, secret: string, maxAttempts: number, raw: Buffer, headers: GitHubHeaders, ownAppId='') {
 if (!/^sha256=[a-f0-9]{64}$/.test(headers.signature) || !/^[\w-]{1,128}$/.test(headers.deliveryId)) throw new WebhookError(401);
 const expected=createHmac('sha256',secret).update(raw).digest();
 if (!timingSafeEqual(expected,Buffer.from(headers.signature.slice(7),'hex'))) throw new WebhookError(401);
 let work: Work | null;let revokedUser:string|undefined;
 try {
  const input:unknown=JSON.parse(raw.toString('utf8'));
  if(headers.event==='github_app_authorization'){
   const value=z.object({action:z.literal('revoked'),sender:z.object({id:apiId})}).parse(input);
   revokedUser=value.sender.id;work=null;
  }else work=normalize(headers.event,input,headers.deliveryId,ownAppId);
 } catch { throw new WebhookError(400); }
 return db.withTransaction(async tx => {
  const inserted=await tx.insert(deliveries).values({source:'github',deliveryId:headers.deliveryId}).onConflictDoNothing().returning();
  if (!inserted.length) return {duplicate:true};
  if(revokedUser){
   // Invalidate immediately with the signed delivery receipt, before another
   // worker can start using the revoked user grant. Keep financial history.
   await tx.delete(sessions).where(eq(sessions.ghId,revokedUser));
   await tx.update(copilotSponsors).set({revokedAt:sql`now()`,tokenGeneration:sql`${copilotSponsors.tokenGeneration}+1`,updatedAt:sql`now()`}).where(eq(copilotSponsors.sponsorGhId,revokedUser));
  }
  if (work) {
   const key=work.kind==='run_command'?`cmd:${work.commentId}`:`github:${headers.deliveryId}`;
   await enqueue(tx,{kind:work.kind,payload:work,dedupeKey:key,maxAttempts});
  }
  return {duplicate:false};
 });
}
