import { randomUUID,createHash } from 'node:crypto';
import { and,count,desc,eq,gte,isNull,max,ne,or } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import type { FundingEnv } from '../env.js';
import { submissions,submissionEvidence,verifications,bounties } from '../db/schema.js';
import type { AuthService } from '../github/oauth.js';
import type { GitHub } from '../github/app.js';
import { currentAccess } from '../github/permissions.js';
import { refreshPrLinks } from '../github/linking.js';
import { collectVerification,StaleEvidenceError,type VerifyInput } from './collect.js';
import { verify } from './verify.js';
import { buildVerifierPrompt } from './prompt.js';
import { parseCopilotEnv } from '../env.js';
import { PROMPT_VERSION } from './prompt.js';

function md(value:string):string{return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('`','\\`').replaceAll('[','\\[').replaceAll(']','\\]');}
function checkSummary(input:{advisory:string;ci:string;reasoning?:string;unmet?:string[];retryUrl:string}) {
 return `**${input.advisory}**\n\nCI for this exact revision: **${md(input.ci)}**. This check is advisory; it does not select an award or authorize payment.\n\n${input.reasoning?md(input.reasoning):'No verifier verdict is available.'}${input.unmet?.length?`\n\nUnmet requirements:\n${input.unmet.map(value=>`- ${md(value)}`).join('\n')}`:''}\n\n[View bounty and request a fresh review](${input.retryUrl})`;
}
const safeErrorCode=(error:unknown)=>error instanceof Error&&/model/i.test(error.message)?'MODEL_UNAVAILABLE':error instanceof StaleEvidenceError?'STALE_EVIDENCE':'VERIFIER_UNAVAILABLE';

export function createPhase5(db:Database,github:GitHub,env:FundingEnv,auth:AuthService,verifyFn:typeof verify=verify) {
 async function scheduleVerification(submissionId:string,headSha:string,key:string) {
  const { enqueue }=await import('../jobs/queue.js');
  await db.withTransaction(async tx=>{
   const [sub]=await tx.select().from(submissions).where(eq(submissions.id,submissionId));if(!sub)return;
   const [bounty]=await tx.select().from(bounties).where(eq(bounties.id,sub.bountyId));if(!bounty||bounty.status!=='FUNDED'||bounty.fundingHold)return;
   await enqueue(tx,{kind:'verify_submission',payload:{submissionId,headSha},dedupeKey:key,maxAttempts:5});
  });
 }
 async function syncPullRequest(installationId:string,repoId:string,prNumber:number) {
  const {repo}=await currentAccess(github,installationId,repoId);
  const linked=await refreshPrLinks(db,github,installationId,repo,prNumber);
  for(const result of linked.results)if(result.changed)await scheduleVerification(result.submission.id,result.submission.headSha,`verify:${result.submission.id}:${result.submission.headSha}:${String(result.submission.evidenceVersion)}`);
 }
 async function manualLink(installationId:string,repoId:string,issueNumber:number,prNumber:number) {
  const {repo}=await currentAccess(github,installationId,repoId);
  const linked=await refreshPrLinks(db,github,installationId,repo,prNumber,issueNumber);
  for(const result of linked.results)if(result.changed)await scheduleVerification(result.submission.id,result.submission.headSha,`verify:${result.submission.id}:${result.submission.headSha}:${String(result.submission.evidenceVersion)}`);
 }
 async function refreshVerificationSha(installationId:string,repoId:string,sha:string) {
  const rows=await db.orm.select({id:submissions.id,headSha:submissions.headSha}).from(submissions).where(and(eq(submissions.repoId,repoId),eq(submissions.headSha,sha)));
  for(const row of rows)await scheduleVerification(row.id,row.headSha,`ci:${row.id}:${sha}:${randomUUID()}`);
 }
 async function saveEvidence(input:VerifyInput) {
  const [latest]=await db.orm.select().from(submissionEvidence).where(eq(submissionEvidence.submissionId,input.submissionId)).orderBy(desc(submissionEvidence.version)).limit(1);
  if(latest?.snapshotHash===input.snapshotHash)return latest;
  return db.withTransaction(async tx=>{
   const version=(latest?.version??0)+1;
   const [row]=await tx.insert(submissionEvidence).values({submissionId:input.submissionId,version,headSha:input.headSha,baseSha:input.baseSha,testedSha:input.ci.testedSha,title:input.prTitle,body:input.prBody,diffText:input.diff,inputTruncated:input.truncated,evidenceSufficient:input.sufficient,eligibleAuthors:input.eligibleAuthors,unverifiedAuthors:input.unverifiedAuthors,ci:JSON.parse(JSON.stringify(input.ci)) as Record<string,unknown>,snapshotHash:input.snapshotHash}).returning();
   await tx.update(submissions).set({evidenceVersion:version,updatedAt:new Date()}).where(eq(submissions.id,input.submissionId));
   if(!row)throw new Error('Evidence snapshot was not saved');return row;
  });
 }
 async function nextAttempt(submissionId:string,headSha:string) {
  return db.withTransaction(async tx=>{
   const [row]=await tx.select({value:max(verifications.attempt)}).from(verifications).where(and(eq(verifications.submissionId,submissionId),eq(verifications.headSha,headSha)));
   return (row?.value??0)+1;
  });
 }
 async function withinAttemptBudget(client:import('pg').PoolClient,repoId:string,submissionId:string,headSha:string) {
  const now=new Date(),utcStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  const lock=`${db.schemaName}:verify-budget:${repoId}:${utcStart.toISOString().slice(0,10)}`;
  await client.query('select pg_advisory_lock(hashtext($1))',[lock]);
  try {
   const countsAsAttempt=or(isNull(verifications.errorCode),and(ne(verifications.errorCode,'INSUFFICIENT_EVIDENCE'),ne(verifications.errorCode,'VERIFIER_BUDGET_EXHAUSTED')));
   if(!countsAsAttempt)throw new Error('Could not build verifier budget predicate');
   const [daily]=await db.orm.select({value:count()}).from(verifications).innerJoin(submissions,eq(verifications.submissionId,submissions.id))
    .where(and(eq(submissions.repoId,repoId),gte(verifications.createdAt,utcStart),countsAsAttempt));
   const [revision]=await db.orm.select({value:count()}).from(verifications).where(and(eq(verifications.submissionId,submissionId),eq(verifications.headSha,headSha),countsAsAttempt));
   return (daily?.value??0)<=env.VERIFIER_DAILY_ATTEMPT_LIMIT&&(revision?.value??0)<=env.VERIFIER_MAX_ATTEMPTS_PER_SHA;
  } finally {await client.query('select pg_advisory_unlock(hashtext($1))',[lock]);}
 }
 async function setAttempt(attemptId:string,values:Partial<typeof verifications.$inferInsert>) {
  await db.orm.update(verifications).set(values).where(eq(verifications.id,attemptId));
 }
 async function verifySubmission(submissionId:string,expectedHeadSha:string,force=false) {
  const client=await db.pool.connect(),lock=`${db.schemaName}:verify:${submissionId}`;let acquired=false;
  try {
   acquired=(await client.query<{locked:boolean}>('select pg_try_advisory_lock(hashtext($1)) as locked',[lock])).rows[0]?.locked===true;
   if(!acquired)throw new Error('Verification already running');
   const [sub]=await db.orm.select().from(submissions).where(eq(submissions.id,submissionId));if(!sub)return;
   const [bounty]=await db.orm.select().from(bounties).where(eq(bounties.id,sub.bountyId));if(!bounty||bounty.status!=='FUNDED'||bounty.fundingHold)return;
   const {installation,repo}=await currentAccess(github,bounty.installationId,bounty.repoId);
   const terms=bounty.fundedTerms;if(!terms||terms.version!==3)throw new Error('Funded verifier profile is unsupported; maintainer review is required');
   let evidence:VerifyInput;
   try{evidence=await collectVerification({github,env,installationId:installation.id,repo,bounty,submission:sub,terms,expectedHeadSha});}
   catch(error){if(error instanceof StaleEvidenceError)return;throw error;}
   const evidenceRow=await saveEvidence(evidence);
   if(!force){
    const [previous]=await db.orm.select().from(verifications).where(and(eq(verifications.submissionId,sub.id),eq(verifications.headSha,evidence.headSha),eq(verifications.evidenceId,evidenceRow.id))).orderBy(desc(verifications.attempt)).limit(1);
    if(previous?.status==='DONE')return;
   }
   const attempt=await nextAttempt(sub.id,evidence.headSha),prompt=buildVerifierPrompt(evidence),promptHash=createHash('sha256').update(PROMPT_VERSION+'\n'+prompt).digest('hex');
   const [record]=await db.orm.insert(verifications).values({submissionId:sub.id,evidenceId:evidenceRow.id,headSha:evidence.headSha,attempt,status:'PENDING',provider:'copilot',model:terms.policy.model,sdkVersion:'1.0.28',sponsorGhId:terms.sponsor.id,promptHash}).returning();
   if(!record)throw new Error('Verification attempt was not recorded');
   const detailsUrl=`https://github.com/${repo.full_name}/issues/${String(bounty.issueNumber)}`;
   const retryUrl=new URL(`/submissions/${sub.id}/retry`,env.PUBLIC_URL).href;
   const checkRunId=await github.createCheckRun(installation.id,repo,{name:'GitPay solution review',headSha:evidence.headSha,externalId:`gitpay:${sub.id}:${evidence.headSha}:${String(attempt)}`,detailsUrl,status:'in_progress',title:'GitPay is reviewing this revision',summary:'Collecting bounded issue, pull request, CI, and author evidence. This check is advisory and cannot authorize payment.'});
   await setAttempt(record.id,{checkRunId});
   const finish=async(values:Partial<typeof verifications.$inferInsert>,title:string,summary:string)=>{
    await github.updateCheckRun(installation.id,repo,checkRunId,{detailsUrl,status:'completed',conclusion:'neutral',title,summary});
    await setAttempt(record.id,{...values,completedAt:new Date()});
   };
   if(!evidence.sufficient){await finish({status:'ERROR',errorCode:'INSUFFICIENT_EVIDENCE'},'GitPay needs maintainer review',checkSummary({advisory:'Evidence is incomplete or authorship is ambiguous.',ci:evidence.ci.status,retryUrl}));return;}
   if(!await withinAttemptBudget(client,bounty.repoId,sub.id,evidence.headSha)){await finish({status:'ERROR',errorCode:'VERIFIER_BUDGET_EXHAUSTED'},'GitPay review paused',checkSummary({advisory:'The repository review-attempt limit has been reached for today or this PR revision. No model request was made for this attempt.',ci:evidence.ci.status,retryUrl}));return;}
   try {
    const sponsor=await auth.getCopilotSponsor(bounty.repoId);
    if(sponsor.sponsorGhId!==terms.sponsor.id||sponsor.modelId!==terms.policy.model||sponsor.installationId!==bounty.installationId)throw new Error('Sponsor binding is unavailable');
    const identity=await auth.provider.identity(sponsor.accessToken),access=await auth.provider.repository(sponsor.accessToken,bounty.repoId);
    if(identity.id!==terms.sponsor.id||access.ownerId!==identity.id||access.ownerType!=='User'||access.admin!==true)throw new Error('Sponsor ownership is unavailable');
    const copilotEnv=parseCopilotEnv({COPILOT_GITHUB_TOKEN:sponsor.accessToken,COPILOT_BILLING_OWNER_ID:sponsor.sponsorGhId,COPILOT_AUTH_KIND:'user',COPILOT_MODEL:terms.policy.model,COPILOT_TIMEOUT_MS:'120000',COPILOT_SHUTDOWN_TIMEOUT_MS:'5000',COPILOT_MAX_INPUT_BYTES:'200000',PROVIDER_RESPONSE_MAX_BYTES:String(env.PROVIDER_RESPONSE_MAX_BYTES)});
    const output=await verifyFn(evidence,copilotEnv);
    await finish({status:'DONE',result:output.value,usageMetrics:{...output.usage},elapsedMs:output.elapsedMs,promptHash:output.promptHash},`${output.value.verdict} · confidence ${(output.value.confidence*100).toFixed(0)}%`,checkSummary({advisory:`Model assessment: ${output.value.verdict} · coverage ${(output.value.coverage*100).toFixed(0)}% · confidence ${(output.value.confidence*100).toFixed(0)}%.`,ci:evidence.ci.status,reasoning:output.value.reasoning,unmet:output.value.unmet_requirements,retryUrl}));
   }catch(error){const code=safeErrorCode(error);await finish({status:'ERROR',errorCode:code},'GitPay review unavailable',checkSummary({advisory:`No model verdict was recorded (${code}).`,ci:evidence.ci.status,retryUrl}));}
  } finally {
   let destroy=false;if(acquired){try{await client.query('select pg_advisory_unlock(hashtext($1))',[lock]);}catch{destroy=true;}}
   client.release(destroy);
  }
 }
 return {syncPullRequest,refreshVerificationSha,manualLink,verifySubmission,scheduleVerification};
}
