import { createHash } from 'node:crypto';
import { and,count,desc,eq,gte,isNull,max,ne,or } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import type { Transaction } from '../db/transaction.js';
import { bounties,submissions,submissionEvidence,verifications,verificationPublications,reviewDispatches,copilotSponsors,installations } from '../db/schema.js';
import { isSponsoredTerms } from '../domain/funded-terms.js';
import { REVIEW_UNAVAILABLE_REASON } from '../domain/types.js';
import { parseCopilotEnv,type FundingEnv } from '../env.js';
import type { GitHub } from '../github/app.js';
import type { AuthService } from '../github/oauth.js';
import { currentAccess } from '../github/permissions.js';
import { enqueue } from '../jobs/queue.js';
import { collectVerification } from '../verifier/collect.js';
import { buildVerifierPrompt,PROMPT_VERSION } from '../verifier/prompt.js';
import { validateVerdictForAuthors } from '../verifier/schema.js';
import { COPILOT_SDK_VERSION } from '../models/copilot.js';
import { checkSummary,insufficientReasons } from '../verifier/presentation.js';
import { assertReviewOwner,controlLock,type Dispatch } from './store.js';
import { reviewOutput,type ReviewOutput } from './contracts.js';

export function createReviewService(db:Database,github:GitHub,env:FundingEnv,auth:AuthService){
 async function scope(id:string){
  const [dispatch]=await db.orm.select().from(reviewDispatches).where(eq(reviewDispatches.id,id));if(!dispatch)throw new Error('Review unavailable');
  const [sub]=await db.orm.select().from(submissions).where(eq(submissions.id,dispatch.submissionId));
  const [bounty]=sub?await db.orm.select().from(bounties).where(eq(bounties.id,sub.bountyId)):[];
  if(!sub||!bounty||!bounty.fundedTerms||!isSponsoredTerms(bounty.fundedTerms))throw new Error('Review scope unavailable');
  return {dispatch,sub,bounty,terms:bounty.fundedTerms};
 }
 async function validateCurrent(id:string){
  const data=await scope(id);const {dispatch,sub,bounty,terms}=data;
  if(bounty.fundingHold||!['FUNDED','NEEDS_REVIEW'].includes(bounty.status)||sub.headSha!==dispatch.headSha||sub.baseSha!==dispatch.baseSha||terms.sponsor.id!==dispatch.sponsorGhId)throw new Error('Review superseded');
  const access=await currentAccess(github,bounty.installationId,bounty.repoId);
  const input=await collectVerification({database:db,github,env,installationId:access.installation.id,repo:access.repo,bounty,submission:sub,terms,expectedHeadSha:dispatch.headSha});
  if(dispatch.input&&(input.snapshotHash!==dispatch.input.snapshotHash||input.ci.status!==dispatch.input.ci.status||!input.sufficient))throw new Error('Review evidence changed');
  return {...data,input};
 }
 async function publish(tx:Transaction,row:Dispatch,values:Partial<typeof verifications.$inferInsert>,summary:string){
  if(!row.verificationId)throw new Error('Review record unavailable');
  await tx.update(verifications).set({...values,completedAt:new Date()}).where(eq(verifications.id,row.verificationId));
  const [scope]=await tx.select({bountyId:bounties.id,issueNumber:bounties.issueNumber}).from(submissions).innerJoin(bounties,eq(bounties.id,submissions.bountyId)).where(eq(submissions.id,row.submissionId));if(!scope)throw new Error('Review scope missing');
  await tx.insert(verificationPublications).values({verificationId:row.verificationId,title:values.status==='DONE'?'Repopay solution review':'Repopay review unavailable',summary:checkSummary({advisory:values.status==='DONE'?'Model assessment saved.':'No current verifier verdict is available.',reasoning:summary,ci:row.input?.ci.status??'unknown',headSha:row.headSha,baseSha:row.baseSha,issueNumber:scope.issueNumber})}).onConflictDoNothing();
  await enqueue(tx,{kind:'publish_verification',payload:{verificationId:row.verificationId},dedupeKey:`review-check:${row.verificationId}`,maxAttempts:env.RECONCILIATION_MAX_ATTEMPTS});
  await enqueue(tx,{kind:'sync_submission',payload:{submissionId:row.submissionId},dedupeKey:`review-projection:${row.verificationId}`,maxAttempts:env.RECONCILIATION_MAX_ATTEMPTS});
  if(values.status==='DONE'||values.errorCode==='INSUFFICIENT_EVIDENCE')await tx.update(bounties).set({needsAttention:false,attentionReason:null,updatedAt:new Date()}).where(and(eq(bounties.id,scope.bountyId),eq(bounties.attentionReason,REVIEW_UNAVAILABLE_REASON)));
 }
 async function prepare(id:string,ownerToken:string){
  const before=await db.withTransaction(tx=>assertReviewOwner(tx,id,ownerToken));
  if(before.input)return {ready:before.status==='RUNNING_PRE_INFERENCE',input:before.input};
  const {dispatch,sub,bounty,input,terms}=await validateCurrent(id);
  return db.withTransaction(async tx=>{
   const owned=await assertReviewOwner(tx,id,ownerToken);if(owned.input)return {ready:owned.status==='RUNNING_PRE_INFERENCE',input:owned.input};
   await tx.select({id:bounties.id}).from(bounties).where(eq(bounties.id,bounty.id)).for('update');
   const [current]=await tx.select().from(submissions).where(eq(submissions.id,sub.id)).for('update');
   if(!current||current.headSha!==dispatch.headSha||current.baseSha!==dispatch.baseSha||current.evidenceVersion!==sub.evidenceVersion)throw new Error('Review evidence changed');
   const [last]=await tx.select().from(submissionEvidence).where(eq(submissionEvidence.submissionId,sub.id)).orderBy(desc(submissionEvidence.version)).limit(1);
   const version=Math.max(last?.version??0,current.evidenceVersion)+1;
   const evidence=last?.snapshotHash===input.snapshotHash&&last.version===current.evidenceVersion?last:(await tx.insert(submissionEvidence).values({submissionId:sub.id,version,headSha:input.headSha,baseSha:input.baseSha,testedSha:input.ci.testedSha,title:input.prTitle,body:input.prBody,diffText:input.diff,inputTruncated:input.truncated,evidenceSufficient:input.sufficient,eligibleAuthors:input.eligibleAuthors,unverifiedAuthors:input.unverifiedAuthors,ci:JSON.parse(JSON.stringify(input.ci)) as Record<string,unknown>,snapshotHash:input.snapshotHash}).returning())[0];
   if(!evidence)throw new Error('Review evidence missing');
   await tx.update(submissions).set({evidenceVersion:evidence.version,updatedAt:new Date()}).where(eq(submissions.id,sub.id));
   const [prior]=await tx.select().from(verifications).where(and(eq(verifications.submissionId,sub.id),eq(verifications.evidenceId,evidence.id),eq(verifications.status,'DONE'))).limit(1);
   if(prior&&!dispatch.forceReview){await tx.update(reviewDispatches).set({status:'SUPERSEDED',errorCode:'ALREADY_REVIEWED'}).where(eq(reviewDispatches.id,id));return {ready:false};}
   const [maximum]=await tx.select({value:max(verifications.attempt)}).from(verifications).where(and(eq(verifications.submissionId,sub.id),eq(verifications.headSha,sub.headSha)));
   const [record]=await tx.insert(verifications).values({submissionId:sub.id,evidenceId:evidence.id,headSha:input.headSha,attempt:(maximum?.value??0)+1,provider:'copilot',model:terms.policy.model,sdkVersion:COPILOT_SDK_VERSION,sponsorGhId:dispatch.sponsorGhId,promptHash:createHash('sha256').update(PROMPT_VERSION+'\n'+buildVerifierPrompt(input)).digest('hex')}).returning();
   if(!record)throw new Error('Review record missing');
   const [saved]=await tx.update(reviewDispatches).set({input,evidenceVersion:evidence.version,verificationId:record.id}).where(eq(reviewDispatches.id,id)).returning();if(!saved)throw new Error('Review missing');
   // JSONB normalizes object key order. Bind the prompt to the persisted input
   // that the remote executor actually receives, not the pre-insert object.
   if(!saved.input)throw new Error('Persisted input missing');
   await tx.update(verifications).set({promptHash:createHash('sha256').update(PROMPT_VERSION+'\n'+buildVerifierPrompt(saved.input)).digest('hex')}).where(eq(verifications.id,record.id));
   if(!input.sufficient){await publish(tx,saved,{status:'ERROR',errorCode:'INSUFFICIENT_EVIDENCE'},insufficientReasons(input,sub.authorGhId,bounty.createdByGhId,terms.policy.ciRequired).join('\n\n')+' No model request was made.');await tx.update(reviewDispatches).set({status:'RESULT_SAVED',completedAt:new Date()}).where(eq(reviewDispatches.id,id));return {ready:false};}
   return {ready:true,input:saved.input};
  });
 }
 async function begin(id:string,ownerToken:string){
  const initial=await db.withTransaction(tx=>assertReviewOwner(tx,id,ownerToken));
  if(initial.inferenceStartedAt||!initial.input||!initial.verificationId)throw new Error('Inference already started or not prepared');
  const {dispatch,sub,bounty,terms}=await validateCurrent(id);
  const sponsor=await auth.getCopilotSponsor(bounty.repoId);
  if(sponsor.sponsorGhId!==dispatch.sponsorGhId||sponsor.modelId!==terms.policy.model||sponsor.installationId!==bounty.installationId)throw new Error('Sponsor binding unavailable');
  const [identity,access]=await Promise.all([auth.provider.identity(sponsor.accessToken),auth.provider.repository(sponsor.accessToken,bounty.repoId)]);
  if(identity.id!==dispatch.sponsorGhId||access.ownerId!==identity.id||access.ownerType!=='User'||!access.admin)throw new Error('Sponsor access unavailable');
  const granted=await db.withTransaction(async tx=>{
   const owned=await assertReviewOwner(tx,id,ownerToken);
   if(owned.inferenceStartedAt||!owned.verificationId||!owned.input)throw new Error('Inference already started or not prepared');
   const [currentSponsor]=await tx.select().from(copilotSponsors).where(eq(copilotSponsors.repoId,owned.repoId)).for('update');
   const [currentInstallation]=await tx.select().from(installations).where(eq(installations.id,bounty.installationId)).for('update');
   const [currentBounty]=await tx.select().from(bounties).where(eq(bounties.id,bounty.id)).for('update');
   const [currentSub]=await tx.select().from(submissions).where(eq(submissions.id,sub.id)).for('update');
   if(!currentInstallation||currentInstallation.deletedAt||currentInstallation.suspendedAt||!currentBounty||currentBounty.fundingHold||!['FUNDED','NEEDS_REVIEW'].includes(currentBounty.status)||JSON.stringify(currentBounty.fundedTerms)!==JSON.stringify(terms))throw new Error('Review funding or installation changed');
   if(!currentSponsor||currentSponsor.revokedAt||currentSponsor.sponsorGhId!==owned.sponsorGhId||currentSponsor.installationId!==bounty.installationId||currentSponsor.modelId!==terms.policy.model||currentSponsor.tokenGeneration!==sponsor.tokenGeneration||currentSub?.evidenceVersion!==owned.evidenceVersion||currentSub.headSha!==owned.headSha||currentSub.baseSha!==owned.baseSha)throw new Error('Review authorization changed');
   const now=new Date(),utcStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
   const counts=or(isNull(verifications.errorCode),and(ne(verifications.errorCode,'INSUFFICIENT_EVIDENCE'),ne(verifications.errorCode,'VERIFIER_BUDGET_EXHAUSTED')));
   const [daily]=await tx.select({value:count()}).from(verifications).innerJoin(submissions,eq(submissions.id,verifications.submissionId)).leftJoin(reviewDispatches,eq(reviewDispatches.verificationId,verifications.id)).where(and(eq(submissions.repoId,owned.repoId),counts,or(gte(reviewDispatches.inferenceStartedAt,utcStart),and(isNull(reviewDispatches.verificationId),gte(verifications.createdAt,utcStart)))));
   const [revision]=await tx.select({value:count()}).from(verifications).where(and(eq(verifications.submissionId,sub.id),eq(verifications.headSha,owned.headSha),counts));
   if((daily?.value??0)>=env.VERIFIER_DAILY_ATTEMPT_LIMIT||(revision?.value??0)>env.VERIFIER_MAX_ATTEMPTS_PER_SHA){
    await publish(tx,owned,{status:'ERROR',errorCode:'VERIFIER_BUDGET_EXHAUSTED'},'Review allowance exhausted. No model request was made.');await tx.update(reviewDispatches).set({status:'RESULT_SAVED',completedAt:now}).where(eq(reviewDispatches.id,id));return false;
   }
   await tx.update(reviewDispatches).set({status:'INFERENCE_STARTED',inferenceStartedAt:now,allowanceDate:utcStart.toISOString().slice(0,10),sponsorGeneration:sponsor.tokenGeneration}).where(eq(reviewDispatches.id,id));return true;
  });
  if(!granted)return null;
  return parseCopilotEnv({COPILOT_GITHUB_TOKEN:sponsor.accessToken,COPILOT_BILLING_OWNER_ID:sponsor.sponsorGhId,COPILOT_AUTH_KIND:'user',COPILOT_MODEL:terms.policy.model,COPILOT_TIMEOUT_MS:'120000',COPILOT_SHUTDOWN_TIMEOUT_MS:'5000',COPILOT_MAX_INPUT_BYTES:'200000',PROVIDER_RESPONSE_MAX_BYTES:String(env.PROVIDER_RESPONSE_MAX_BYTES)});
 }
 async function complete(id:string,ownerToken:string,untrusted:unknown){
  const output:ReviewOutput=reviewOutput.parse(untrusted);
  const {dispatch,bounty,terms}=await scope(id);
  if(output.requestedModel!==terms.policy.model||(terms.policy.model!=='auto'&&output.model!==terms.policy.model))throw new Error('Review model binding invalid');
  if(!dispatch.input||output.billingOwnerId!==dispatch.sponsorGhId||output.promptHash!==createHash('sha256').update(PROMPT_VERSION+'\n'+buildVerifierPrompt(dispatch.input)).digest('hex'))throw new Error('Review result binding invalid');
  validateVerdictForAuthors(output.value,dispatch.input.eligibleAuthors);
  let current=true;try{
   await validateCurrent(id);const sponsor=await auth.getCopilotSponsor(dispatch.repoId);
   const [identity,access]=await Promise.all([auth.provider.identity(sponsor.accessToken),auth.provider.repository(sponsor.accessToken,dispatch.repoId)]);
   if(sponsor.tokenGeneration!==dispatch.sponsorGeneration||identity.id!==dispatch.sponsorGhId||access.ownerId!==identity.id||access.ownerType!=='User'||!access.admin)current=false;
  }catch{current=false;}
  return db.withTransaction(async tx=>{
   const control=await controlLock(tx);
   const [owned]=await tx.select().from(reviewDispatches).where(eq(reviewDispatches.id,id)).for('update');
   if(!owned||owned.ownerToken!==ownerToken)throw new Error('Review ownership lost');
   if(owned.status==='RESULT_SAVED')return;
   current=current&&!!control&&!control.paused&&control.generation===owned.generation&&control.backend===owned.backend&&control.artifactVersion===owned.artifactVersion&&owned.capacityHeld&&!!owned.heartbeatUntil&&owned.heartbeatUntil.getTime()>Date.now()&&owned.status==='INFERENCE_STARTED';
   if(!owned.inferenceStartedAt)throw new Error('Inference was not authorized');
   const [sponsor]=await tx.select().from(copilotSponsors).where(eq(copilotSponsors.repoId,owned.repoId)).for('update');
   const [installation]=await tx.select().from(installations).where(eq(installations.id,bounty.installationId)).for('update');
   const [freshBounty]=await tx.select().from(bounties).where(eq(bounties.id,bounty.id)).for('update');
   const [freshSub]=await tx.select().from(submissions).where(eq(submissions.id,owned.submissionId)).for('update');
   current=current&&!!sponsor&&!sponsor.revokedAt&&sponsor.tokenGeneration===owned.sponsorGeneration&&sponsor.sponsorGhId===owned.sponsorGhId&&sponsor.modelId===terms.policy.model&&sponsor.installationId===bounty.installationId&&!!installation&&!installation.deletedAt&&!installation.suspendedAt&&!!freshBounty&&!freshBounty.fundingHold&&['FUNDED','NEEDS_REVIEW'].includes(freshBounty.status)&&freshSub?.headSha===owned.headSha&&freshSub.baseSha===owned.baseSha&&freshSub.evidenceVersion===owned.evidenceVersion;
   const values={status:current?'DONE':'ERROR',errorCode:current?null:'SUPERSEDED',model:output.model,result:output.value,usageMetrics:{...output.usage},elapsedMs:Math.round(output.elapsedMs)};
   await publish(tx,owned,values,current?`${output.value.verdict}\n\n${output.value.reasoning}\n\n${output.value.unmet_requirements.join('\n')}`:'Review became stale or unauthorized while running. Its output is retained as history and cannot authorize payment.');
   await tx.update(reviewDispatches).set({status:'RESULT_SAVED',completedAt:new Date(),errorCode:values.errorCode}).where(eq(reviewDispatches.id,id));
  });
 }
 return {prepare,begin,complete};
}
