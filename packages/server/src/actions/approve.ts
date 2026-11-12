import { hasConfirmedFunding } from '../actions/guards.js';
import type { LeasedJob } from '../jobs/kinds.js';
import { desc,eq,sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client.js';
import type { Transaction } from '../db/transaction.js';
import type { FundingEnv } from '../env.js';
import type { Session } from '../github/oauth.js';
import { AuthError } from '../github/oauth.js';
import { actionTokens,awards,bounties,bountyActivity,reviewDecisions,submissions,submissionEvidence,verifications,type Bounty } from '../db/schema.js';
import type { ActorContext } from '../domain/types.js';
import { assertContext,assertInstallation,assertSession,findBounty,lockBounty } from './guards.js';
import { readActionToken } from './tokens.js';
import { randomToken,sha256 } from '../util/crypto.js';
import { candidateFingerprint,type CandidateScan } from '../settlement/candidates.js';
import { commitAward,orderedCandidates } from '../settlement/award.js';
import { decide } from '../policy/decide.js';
import { verdictSchema } from '../verifier/schema.js';
import type { Allocation } from '../policy/allocate.js';
import { assertLease,enqueue } from '../jobs/queue.js';
const params=z.object({submissionId:z.string(),evidenceId:z.string(),verificationId:z.string(),scanHash:z.string(),snapshotHash:z.string(),reason:z.string().trim().min(1).max(2000),allocation:z.array(z.object({ghId:z.string(),login:z.string(),cents:z.number().int().positive()}).strict()).min(1).max(10)}).strict();
export interface ReviewDependencies {scan:(id:string,reviewPrNumber?:number)=>Promise<CandidateScan>;authorize:(session:Session,bounty:Bounty)=>Promise<ActorContext>;profileAccepted:(bounty:Bounty)=>Promise<boolean>;authorizeComment?:(actorId:string,bounty:Bounty)=>Promise<ActorContext>}
export function createReviewService(db:Database,env:FundingEnv,deps:ReviewDependencies) {
 async function prepare(session:Session,id:string){
  const before=await findBounty(db,id);await deps.authorize(session,before);
  const scan=await deps.scan(id),current=await findBounty(db,id),ctx=await deps.authorize(session,current);
  return {scan,ctx,accepted:await deps.profileAccepted(current)};
 }
 async function current(tx:Transaction,session:Session|undefined,id:string,prepared:Awaited<ReturnType<typeof prepare>>,requirePayable=true,rejectPrNumber?:number){
  if(session)await assertSession(tx,session,new Date());const bounty=await lockBounty(tx,id);if(!bounty)throw new AuthError(404,'Bounty not found.');
  assertContext({...prepared.ctx,source:'confirmation'},bounty,'review');await assertInstallation(tx,bounty);
  const [award]=await tx.select().from(awards).where(eq(awards.bountyId,id));
  if(award||!(rejectPrNumber?['FUNDED','NEEDS_REVIEW'].includes(bounty.status):bounty.status==='NEEDS_REVIEW')||bounty.fundingHold||!hasConfirmedFunding(bounty))throw new AuthError(409,'A funded bounty awaiting review with no award is required.');
  const rows=await tx.select().from(submissions).where(eq(submissions.bountyId,id));
  const scan=prepared.scan;
  if(!scan.complete||scan.bountyVersion!==bounty.version||candidateFingerprint(rows)!==scan.hash)throw new AuthError(409,'Candidate evidence changed or is incomplete. Refresh review.');
  const candidate=rejectPrNumber?rows.find(r=>r.prNumber===rejectPrNumber):(await orderedCandidates(tx,rows,scan))[0];if(!candidate||(!rejectPrNumber&&(!candidate.mergeSha||!candidate.mergedAt)))throw new AuthError(409,'A current targeted submission is required; approval requires a merge.');
  const fresh=scan.evidence.get(candidate.id);
  const [evidence]=await tx.select().from(submissionEvidence).where(eq(submissionEvidence.submissionId,candidate.id)).orderBy(desc(submissionEvidence.version)).limit(1);
  const [review]=await tx.select().from(verifications).where(eq(verifications.submissionId,candidate.id)).orderBy(desc(verifications.id)).limit(1);
  if(!fresh||!evidence||!review||review.status==='PENDING'||evidence.version!==candidate.evidenceVersion||review.evidenceId!==evidence.id||review.headSha!==candidate.headSha||evidence.snapshotHash!==fresh.snapshotHash||fresh.headSha!==candidate.headSha||fresh.baseSha!==candidate.baseSha)throw new AuthError(409,'Current assessment required. Refresh evidence before deciding.');
  const eligible=fresh.eligibleAuthors.filter(a=>a.ghId!==bounty.createdByGhId);
  if(requirePayable&&(!prepared.accepted||!bounty.fundedTerms||!fresh.sufficient||fresh.truncated||fresh.unverifiedAuthors.length||!eligible.length||fresh.ci.testedSha!==candidate.headSha||fresh.ci.status==='fail'||(bounty.fundedTerms.policy.ciRequired&&fresh.ci.status!=='pass')))throw new AuthError(409,'Current complete evidence, verified recipients, required CI and enabled settlement profile are required.');
  return {bounty,candidate,mergeSha:candidate.mergeSha,fresh,evidence,review,eligible};
 }
 async function preview(session:Session,id:string){const prepared=await prepare(session,id);return db.withTransaction(async tx=>{
  const c=await current(tx,session,id,prepared,false);return {bounty:c.bounty,candidate:c.candidate,eligible:c.eligible,ci:c.fresh.ci.status,reviewStatus:c.review.status,result:verdictSchema.safeParse(c.review.result).success?c.review.result:null,errorCode:c.review.errorCode};
 });}
 async function issueApproveToken(session:Session,id:string,reason:string,recipient?:string){
  const why=z.string().trim().min(1).max(2000).parse(reason),prepared=await prepare(session,id),raw=randomToken();
  await db.withTransaction(async tx=>{const c=await current(tx,session,id,prepared);let allocation:Allocation|undefined;
   if(recipient){const author=c.eligible.find(a=>a.ghId===recipient);if(!author)throw new AuthError(400,'Choose a verified eligible recipient.');allocation=[{...author,cents:c.bounty.amountCents}];}
   else {const verdict=verdictSchema.safeParse(c.review.result);if(verdict.success&&c.bounty.fundedTerms){const d=decide({bountyCents:c.bounty.amountCents,verdict:verdict.data,ci:c.fresh.ci.status,eligible:new Map(c.eligible.map(a=>[a.ghId,a.login])),evidence:{truncated:false,sufficient:true,stale:false},cfg:c.bounty.fundedTerms.policy});allocation=d.kind==='pay'?d.allocation:d.suggested;}}
   if(!allocation)throw new AuthError(400,'Choose one verified eligible recipient when the proposed split is unavailable.');
   await tx.insert(actionTokens).values({tokenHash:sha256(raw),bountyId:id,action:'approve',params:{submissionId:c.candidate.id,evidenceId:c.evidence.id,verificationId:c.review.id,scanHash:prepared.scan.hash,snapshotHash:c.fresh.snapshotHash,reason:why,allocation},bountyVersion:c.bounty.version,requestedByGhId:session.ghId,expiresAt:new Date(Date.now()+env.ACTION_TOKEN_TTL_SEC*1000)});
  });return raw;
 }
 async function confirmation(session:Session,raw:string){const stored=await readActionToken(db,raw),bounty=await findBounty(db,stored.bountyId);await deps.authorize(session,bounty);if(stored.action!=='approve'||stored.usedAt||stored.expiresAt<=new Date()||stored.bountyVersion!==bounty.version)throw new AuthError(409,'Confirmation expired, used or changed. Prepare a fresh review.');const p=params.parse(stored.params);const [evidence]=await db.orm.select().from(submissionEvidence).where(eq(submissionEvidence.id,p.evidenceId));if(!evidence)throw new AuthError(409,'Evidence unavailable.');return {bounty,params:p,headSha:evidence.headSha};}
 async function approve(session:Session,raw:string){
  const initial=await readActionToken(db,raw),prepared=await prepare(session,initial.bountyId);
  return db.withTransaction(async tx=>{const c=await current(tx,session,initial.bountyId,prepared);
   const [token]=await tx.select().from(actionTokens).where(eq(actionTokens.tokenHash,sha256(raw))).for('update');
   if(!token||token.action!=='approve'||token.usedAt||token.expiresAt<=new Date()||token.bountyVersion!==c.bounty.version)throw new AuthError(409,'Confirmation expired, used or changed.');
   const p=params.parse(token.params);if(p.submissionId!==c.candidate.id||p.evidenceId!==c.evidence.id||p.verificationId!==c.review.id||p.scanHash!==prepared.scan.hash||p.snapshotHash!==c.fresh.snapshotHash)throw new AuthError(409,'Review evidence changed. Prepare a new confirmation.');
   const award=await commitAward(tx,c.bounty,prepared.scan,c.candidate,c.evidence.id,c.review.id,p.allocation);
   await tx.insert(reviewDecisions).values({bountyId:c.bounty.id,submissionId:c.candidate.id,kind:'approve',actorGhId:session.ghId,reason:p.reason,headSha:c.candidate.headSha,baseSha:c.candidate.baseSha,mergeSha:c.mergeSha,snapshotHash:c.fresh.snapshotHash,evidenceId:c.evidence.id,verificationId:c.review.id,awardId:award.id});
   await tx.update(actionTokens).set({usedAt:new Date(),usedByGhId:session.ghId}).where(eq(actionTokens.tokenHash,token.tokenHash));
   await tx.insert(bountyActivity).values({bountyId:c.bounty.id,actorGhId:session.ghId,source:'confirmation',action:'review_approved',metadata:{awardId:award.id,reason:p.reason,requestedByGhId:token.requestedByGhId}});return award;
  });
 }
 async function rejectPrepared(session:Session|undefined,id:string,submissionId:string|undefined,reason:string,prepared:Awaited<ReturnType<typeof prepare>>,lease?:LeasedJob,expectedPrNumber?:number){
  const why=z.string().trim().min(1).max(2000).parse(reason);
  return db.withTransaction(async tx=>{
   if(lease){await assertLease(tx,lease);const prior=await tx.select().from(bountyActivity).where(eq(bountyActivity.action,`review-command:${lease.id}`));if(prior.length)return;}
   const c=await current(tx,session,id,prepared,false,expectedPrNumber);if((submissionId&&c.candidate.id!==submissionId)||(expectedPrNumber&&c.candidate.prNumber!==expectedPrNumber))throw new AuthError(409,'Candidate changed. Refresh the review.');
   await tx.insert(reviewDecisions).values({bountyId:id,submissionId:c.candidate.id,kind:'reject',actorGhId:prepared.ctx.actorGhId,reason:why,headSha:c.candidate.headSha,baseSha:c.candidate.baseSha,mergeSha:c.mergeSha,snapshotHash:c.fresh.snapshotHash,evidenceId:c.evidence.id,verificationId:c.review.id});
   await tx.update(bounties).set({...(c.candidate.status==='MERGED'?{status:'FUNDED',needsAttention:false,attentionReason:null}:{}),version:sql`${bounties.version}+1`,updatedAt:new Date()}).where(eq(bounties.id,id));
   await tx.insert(bountyActivity).values({bountyId:id,actorGhId:prepared.ctx.actorGhId,source:prepared.ctx.source,action:'submission_rejected',metadata:{submissionId:c.candidate.id,reason:why,preservesCancellationClaim:true}});
   if(lease)await tx.insert(bountyActivity).values({bountyId:id,actorGhId:prepared.ctx.actorGhId,source:'github_comment',action:`review-command:${lease.id}`});
   await enqueue(tx,{kind:'sync_bounty',payload:{bountyId:id},dedupeKey:`review-rejected:${c.candidate.id}:${c.fresh.snapshotHash}`,maxAttempts:env.RECONCILIATION_MAX_ATTEMPTS});
  });
 }
 async function reject(session:Session,id:string,submissionId:string,reason:string){return rejectPrepared(session,id,submissionId,reason,await prepare(session,id));}
 async function rejectComment(actorId:string,id:string,reason:string,lease:LeasedJob,expectedPrNumber?:number){
  if(!deps.authorizeComment)throw new AuthError(403,'Comment review unavailable.');
  const before=await findBounty(db,id);await deps.authorizeComment(actorId,before);const scan=await deps.scan(id,expectedPrNumber),bounty=await findBounty(db,id),ctx=await deps.authorizeComment(actorId,bounty);
  return rejectPrepared(undefined,id,undefined,reason,{scan,ctx,accepted:false},lease,expectedPrNumber);
 }

 return {preview,issueApproveToken,confirmation,approve,reject,rejectComment};
}
