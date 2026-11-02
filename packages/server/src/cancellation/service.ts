import { enqueue } from '../jobs/queue.js';
import { randomUUID } from 'node:crypto';
import { and,desc,eq,inArray,sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client.js';
import type { FundingEnv } from '../env.js';
import { actionTokens,awards,bountyActivity,cancellationRequests as requests,cancellationEvidence as evidence,cancellationDecisions as decisions,submissions,type Bounty,type CancellationRequest,type CancellationBundle } from '../db/schema.js';
import { assertInstallation,assertSession,findBounty,lockBounty } from '../actions/guards.js';
import { AuthError,type Session } from '../github/oauth.js';
import type { Clock } from '../domain/types.js';
import { sha256 } from '../util/crypto.js';
import type { GitHub } from '../github/app.js';
import { currentAccess } from '../github/permissions.js';
import { assertIndependent,evidenceLinks } from './authorization.js';
import type { CollectEvidence } from './evidence.js';
const active=['NOTICE','REVIEW','APPROVED','EXECUTING'];
export const decisionSchema=z.object({decision:z.enum(['approve','deny','hold']),reason:z.string().trim().min(20).max(2000),nextUpdateAt:z.iso.datetime().optional(),checklist:z.object({independentFix:z.literal(true),noCopiedWork:z.literal(true),claimsAssessed:z.literal(true),captureIdentified:z.literal(true)}).strict().optional(),assessments:z.record(z.string(),z.object({basis:z.enum(['empty','unrelated','duplicate','abusive','incapable']),reason:z.string().trim().min(20).max(1000)}).strict()).default({})}).strict();
export type DecisionInput=z.infer<typeof decisionSchema>;
export interface CancellationDeps {github:GitHub;collect:CollectEvidence;access:(actorId:string,bounty:Bounty,write:boolean)=>Promise<void>;clock?:Clock}
export function createCancellation(db:Database,env:FundingEnv,deps:CancellationDeps){
 const clock=deps.clock??{now:()=>new Date()};
 function enabled(b:Bounty){if(!env.FUNDED_CANCELLATION_ENABLED||env.CANCELLATION_SANDBOX_REPO_ID!==b.repoId||!env.CANCELLATION_OPERATOR_GH_IDS.length||!b.fundedTerms?.policy.fundedCancellationEnabled)throw new AuthError(409,'Funded cancellation is unavailable for these terms or this deployment.');}
 async function load(id:string){if(!/^[1-9]\d*$/.test(id))throw new AuthError(404);const [r]=await db.orm.select().from(requests).where(eq(requests.id,id));if(!r)throw new AuthError(404,'Cancellation request not found.');return r;}
 async function eligible(tx:Parameters<Parameters<Database['withTransaction']>[0]>[0],b:Bounty){await assertInstallation(tx,b);const [a]=await tx.select().from(awards).where(eq(awards.bountyId,b.id));if(a||!['FUNDED','NEEDS_REVIEW'].includes(b.status)||!b.captureId||!b.fundedAt||b.fundingHold)throw new AuthError(409,'Funds are unavailable for cancellation.');}
 async function operator(actor:string,b:Bounty,r:CancellationRequest){enabled(b);assertIndependent(actor,env.CANCELLATION_OPERATOR_GH_IDS,[b.createdByGhId,r.requesterId,r.funderId,...r.claimants]);await deps.access(actor,b,false);}
 async function previewRequest(session:Session,id:string){const b=await findBounty(db,id);enabled(b);await deps.access(session.ghId,b,true);await db.withTransaction(async tx=>{await assertSession(tx,session,clock.now());const fresh=await lockBounty(tx,id);if(!fresh)throw new AuthError(404);await eligible(tx,fresh);});return b;}
 async function request(session:Session,bountyId:string,input:{reasonCategory:string;reason:string;links:string[]}){
  const p=z.object({reasonCategory:z.enum(['independent_fix','duplicate','invalid_issue','project_change']),reason:z.string().trim().min(20).max(2000),links:z.array(z.string())}).strict().parse(input),before=await findBounty(db,bountyId);enabled(before);const links=evidenceLinks(p.links,before.repoFullName);await deps.access(session.ghId,before,true);
  return db.withTransaction(async tx=>{await assertSession(tx,session,clock.now());const b=await lockBounty(tx,bountyId);if(!b)throw new AuthError(404);enabled(b);await eligible(tx,b);if(b.version!==before.version)throw new AuthError(409,'Bounty changed.');const [existing]=await tx.select().from(requests).where(and(eq(requests.bountyId,b.id),inArray(requests.status,active)));if(existing)return existing;
   const claimants=(await tx.select({id:submissions.authorGhId}).from(submissions).where(eq(submissions.bountyId,b.id))).map(a=>a.id);
   const [r]=await tx.insert(requests).values({bountyId:b.id,requesterId:session.ghId,funderId:b.fundingActorGhId??b.createdByGhId,claimants,reasonCategory:p.reasonCategory,reason:p.reason,links,noticeHours:b.fundedTerms?.policy.noticeHours??72}).returning();if(!r)throw new Error('Request not saved');await tx.insert(bountyActivity).values({bountyId:b.id,actorGhId:session.ghId,source:'confirmation',action:'cancellation_requested',metadata:{requestId:r.id}});await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:b.id},dedupeKey:'cancellation-request:'+r.id,maxAttempts:5});return r;});
 }
 async function publish(id:string){
  // Session advisory lock prevents duplicate POSTs across workers without holding
  // a SQL transaction across GitHub. A crash releases the lock; marker recovery
  // precedes another POST. Only our authenticated App bot marker counts.
  const connection=await db.pool.connect();const key='repopay-cancellation-notice:'+id;
  let broken=false;const onError=()=>{broken=true;};connection.on('error',onError);
  try{const lock=await connection.query<{locked:boolean}>('SELECT pg_try_advisory_lock(hashtextextended(current_schema()||$1,0)) AS locked',[key]);if(!lock.rows[0]?.locked)return;
   const r=await load(id),b=await findBounty(db,r.bountyId);enabled(b);if(r.noticePublishedAt||r.status!=='NOTICE')return;
   const {repo}=await currentAccess(deps.github,b.installationId,b.repoId),marker=`<!-- repopay:cancellation:${id} -->`;
   const authentic=(c:Awaited<ReturnType<GitHub['comments']>>[number])=>c.user.type==='Bot'&&c.performed_via_github_app?.id===env.GH_APP_ID&&c.body?.includes(marker);
   const prior=(await deps.github.comments(b.installationId,repo,b.issueNumber)).find(authentic);
   const comment=prior??await deps.github.createComment(b.installationId,repo,b.issueNumber,`${marker}\nCancellation requested: ${r.reason}\n\nEvidence: ${r.links.join('\n')}\n\nThe full ${String(r.noticeHours)}-hour notice begins when Repopay confirms publication. Funds remain committed; submissions stay open. Contributors: reply here with your PR and evidence. Closing a PR does not erase its claim.\n\n[Notice deadline and independent review](${env.PUBLIC_URL}/cancellations/${id})`);
   if(!authentic(comment))throw new Error('Notice authorship could not be verified');
   await db.withTransaction(async tx=>{const current=await lockBounty(tx,b.id);if(!current)throw new AuthError(404);await assertInstallation(tx,current);const at=clock.now();await tx.update(requests).set({noticeCommentId:comment.id,noticePublishedAt:at,noticeEndsAt:new Date(at.getTime()+r.noticeHours*3600000)}).where(and(eq(requests.id,id),eq(requests.status,'NOTICE'),sql`${requests.noticePublishedAt} is null`));await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:b.id},dedupeKey:'cancellation-published:'+id,maxAttempts:5});});
  }finally{await connection.query('SELECT pg_advisory_unlock(hashtextextended(current_schema()||$1,0))',[key]).catch(()=>{broken=true;});connection.off('error',onError);connection.release(broken);}
 }
 async function refresh(id:string){
  const r=await load(id),b=await findBounty(db,r.bountyId);let fresh:CancellationBundle;try{fresh=await deps.collect(b,r);}catch{fresh={complete:false,criteria:b.fundedTerms?.criteria??'',claims:[]};}
  // Evidence collection must also prove the public notice still exists.
  try{const {repo}=await currentAccess(deps.github,b.installationId,b.repoId);const comments=await deps.github.comments(b.installationId,repo,b.issueNumber);if(!r.noticeCommentId||!comments.some(c=>c.id===r.noticeCommentId&&c.user.type==='Bot'&&c.performed_via_github_app?.id===env.GH_APP_ID&&c.body?.includes(`<!-- repopay:cancellation:${id} -->`)))fresh.complete=false;}catch{fresh.complete=false;}
  return db.withTransaction(async tx=>{const current=await lockBounty(tx,b.id);if(!current)throw new AuthError(404);const [latest]=await tx.select().from(requests).where(eq(requests.id,id)).for('update');if(!latest)throw new AuthError(404);
   const [saved]=await tx.select().from(evidence).where(eq(evidence.requestId,id)).orderBy(desc(evidence.version)).limit(1);
   const claims=new Map((saved?.bundle.claims??[]).map(c=>[c.key,c]));for(const c of fresh.claims)claims.set(c.key,c);
   const bundle={...fresh,claims:[...claims.values()].sort((a,c)=>a.key.localeCompare(c.key))};const hash=sha256(JSON.stringify(bundle));
   if(hash===latest.evidenceHash)return {request:latest,bounty:current,bundle};
   const version=latest.evidenceVersion+1;await tx.insert(evidence).values({requestId:id,version,hash,bundle});
   const [next]=await tx.update(requests).set({evidenceVersion:version,evidenceHash:hash,claimants:[...new Set([...latest.claimants,...bundle.claims.flatMap(c=>c.actorIds)])],...(latest.status==='APPROVED'?{status:'REVIEW',reviewerId:null}:{} )}).where(eq(requests.id,id)).returning();if(!next)throw new Error('Missing request');return {request:next,bounty:current,bundle};});
 }
 async function approval(actor:string,b:Bounty,r:CancellationRequest,bundle:CancellationBundle,p:DecisionInput){
  await operator(actor,b,r);if(!['NOTICE','REVIEW','APPROVED'].includes(r.status))throw new AuthError(409,'Request is not reviewable.');
  if(p.decision==='hold'&&(!p.nextUpdateAt||new Date(p.nextUpdateAt)<=clock.now()))throw new AuthError(400,'A future next update is required.');
  if(p.decision==='approve'&&(!r.noticeEndsAt||r.noticeEndsAt>clock.now()||!bundle.complete||!p.checklist||bundle.claims.some(c=>!p.assessments[c.key])))throw new AuthError(409,'Elapsed notice, complete evidence, checklist and reasoned assessment of every claim are required.');
 }
 async function prepare(session:Session,id:string,raw:DecisionInput){const p=decisionSchema.parse(raw),v=await refresh(id);await approval(session.ghId,v.bounty,v.request,v.bundle,p);const token=randomUUID();await db.withTransaction(async tx=>{await assertSession(tx,session,clock.now());const b=await lockBounty(tx,v.bounty.id);if(!b||b.version!==v.bounty.version)throw new AuthError(409,'Bounty changed.');await eligible(tx,b);await tx.insert(actionTokens).values({tokenHash:sha256(token),bountyId:b.id,action:'cancellation_review',params:{requestId:id,evidenceVersion:v.request.evidenceVersion,decision:p},bountyVersion:b.version,requestedByGhId:session.ghId,expiresAt:new Date(clock.now().getTime()+env.ACTION_TOKEN_TTL_SEC*1000)});});return token;}
 async function confirm(session:Session,token:string){const [t]=await db.orm.select().from(actionTokens).where(eq(actionTokens.tokenHash,sha256(token)));if(!t||t.action!=='cancellation_review'||t.requestedByGhId!==session.ghId||t.usedAt||t.expiresAt<=clock.now())throw new AuthError(409,'Fresh reviewer confirmation required.');const params=z.object({requestId:z.string(),evidenceVersion:z.number(),decision:decisionSchema}).parse(t.params);const v=await refresh(params.requestId);if(v.request.evidenceVersion!==params.evidenceVersion||v.bounty.version!==t.bountyVersion)throw new AuthError(409,'Evidence changed. Prepare a fresh decision.');await approval(session.ghId,v.bounty,v.request,v.bundle,params.decision);return {t,params,...v};}
 async function decide(session:Session,token:string){const v=await confirm(session,token);await db.withTransaction(async tx=>{await assertSession(tx,session,clock.now());const b=await lockBounty(tx,v.bounty.id);if(!b)throw new AuthError(404);await eligible(tx,b);const [r]=await tx.select().from(requests).where(eq(requests.id,v.request.id)).for('update'),[t]=await tx.select().from(actionTokens).where(eq(actionTokens.tokenHash,sha256(token))).for('update');
   if(!r||r.evidenceVersion!==v.params.evidenceVersion||!t||t.usedAt||t.expiresAt<=clock.now()||b.version!==t.bountyVersion||!['NOTICE','REVIEW','APPROVED'].includes(r.status))throw new AuthError(409,'Stale review confirmation.');assertIndependent(session.ghId,env.CANCELLATION_OPERATOR_GH_IDS,[b.createdByGhId,r.requesterId,r.funderId,...r.claimants]);
   const p=v.params.decision;await tx.insert(decisions).values({requestId:r.id,evidenceVersion:r.evidenceVersion,actorId:session.ghId,decision:p.decision,reason:p.reason,assessments:p.assessments});await tx.update(requests).set({status:p.decision==='approve'?'APPROVED':p.decision==='deny'?'DENIED':'REVIEW',reviewerId:session.ghId,reviewReason:p.reason,nextUpdateAt:p.nextUpdateAt?new Date(p.nextUpdateAt):null}).where(eq(requests.id,r.id));await tx.update(actionTokens).set({usedAt:clock.now(),usedByGhId:session.ghId}).where(eq(actionTokens.tokenHash,t.tokenHash));await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:b.id},dedupeKey:'cancellation-decision:'+t.tokenHash,maxAttempts:5});});}
 async function view(session:Session,id:string){const r=await load(id),b=await findBounty(db,r.bountyId);await deps.access(session.ghId,b,false);return refresh(id);}
 return {previewRequest,request,publish,refresh,prepare,confirm,decide,view,load,operator,enabled,eligible,clock};
}
export type CancellationService=ReturnType<typeof createCancellation>;
