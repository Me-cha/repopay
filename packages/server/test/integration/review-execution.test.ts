import { createHash,randomUUID } from 'node:crypto';
import { describe,expect,it,vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { intentFixture } from '../helpers/funding.js';
import { required } from '../helpers/auth.js';
import { bounties,submissions,reviewDispatches,verifications,verificationPublications,copilotSponsors,installations } from '../../src/db/schema.js';
import { linkPr } from '../../src/actions/link.js';
import type { PullRequest } from '../../src/github/app.js';
import { configureReviews,createDispatch,admitReview,claimReview,terminateReview,pauseReviews } from '../../src/reviews/store.js';
import { enqueue,claimJob,finishJob } from '../../src/jobs/queue.js';
import { createReviewService } from '../../src/reviews/service.js';
import { artifactVersion } from '../../src/reviews/config.js';
import { buildVerifierPrompt,PROMPT_VERSION } from '../../src/verifier/prompt.js';
import type { VerifyInput } from '../../src/verifier/collect.js';
import { publishVerification } from '../../src/verifier/publication.js';
import { buildApp } from '../../src/http/routes.js';
import { executeReview,brokerClient } from '../../src/reviews/executor.js';
import { parseExecutorSettings } from '../../src/reviews/config.js';
import { reviewOutput } from '../../src/reviews/contracts.js';

async function fixture(){
 const f=await intentFixture();
 const {makeTerms}=await import('../../src/domain/funded-terms.js');
 const terms=makeTerms({...f.env,COPILOT_MODEL:'auto'},f.bounty,{title:'Fix parser',body:'Must reject invalid input',updatedAt:'2026-10-28T00:00:00Z'},{sponsorGhId:'4',sponsorLogin:'maintainer',modelId:'auto',revokedAt:null});
 await f.database.orm.update(copilotSponsors).set({modelId:'auto'}).where(eq(copilotSponsors.repoId,'2'));
 const bounty=required((await f.database.orm.update(bounties).set({status:'FUNDED',fundedTerms:terms}).where(eq(bounties.id,f.bounty.id)).returning())[0]);
 const pr:PullRequest={id:'501',number:42,state:'open',draft:false,title:'Fix parser',body:'Fixes #12',merged_at:null,closed_at:null,user:{id:'8',login:'contributor',type:'User'},head:{sha:'a'.repeat(40)},base:{sha:'b'.repeat(40),repo:{id:'2'}}};
 const {submission}=await linkPr(f.database,bounty,pr);
 vi.mocked(f.api.pullRequest).mockResolvedValue(pr);
 vi.mocked(f.api.fileAtRevision).mockResolvedValue('throw new Error("invalid");');
 vi.mocked(f.api.pullRequestFiles).mockResolvedValue({files:[{filename:'src/parser.ts',sha:'c'.repeat(40),status:'modified',additions:1,deletions:0,patch:'@@ -1 +1 @@\n+throw new Error("invalid")'}],complete:true});
 vi.mocked(f.api.pullRequestCommits).mockResolvedValue({authors:[{ghId:'8',login:'contributor',type:'User'}],complete:true});
 vi.mocked(f.api.checkRuns).mockResolvedValue({runs:[{id:'11',name:'test',head_sha:pr.head.sha,status:'completed',conclusion:'success',app:{id:'15368'}}],complete:true});
 await configureReviews(f.database,'dedicated',1);
 await f.database.withTransaction(tx=>enqueue(tx,{kind:'verify_submission',payload:{submissionId:submission.id,headSha:submission.headSha},dedupeKey:'review-test',maxAttempts:3}));
 const job=required(await claimJob(f.database,'dispatcher',60,{only:'verify_submission'}));const dispatch=required(await createDispatch(f.database,job,'dedicated',1));await finishJob(f.database,job);await admitReview(f.database);
 const claimed=required(await claimReview(f.database,dispatch.id,randomUUID(),'dedicated',1,artifactVersion));
 const owner=required(claimed.ownerToken),service=createReviewService(f.database,f.api,f.env,f.auth);
 return {...f,submission,dispatch,owner,claimed,service,pr};
}
function output(input:VerifyInput){return {value:{verdict:'RESOLVES',coverage:1,confidence:0.95,reasoning:'Adds the input guard.',unmet_requirements:[],splits:[{gh_id:'8',share:1,why:'Author'}]},usage:{totalNanoAiu:500,totalPremiumRequestCost:0.1,totalApiDurationMs:42,totalUserRequests:1,inputTokens:10,outputTokens:12,cacheReadTokens:0,cacheWriteTokens:0},provider:'copilot',requestedModel:'auto',model:'test-model',sdkVersion:'1.0.28',billingOwnerId:'4',elapsedMs:42,promptHash:createHash('sha256').update(PROMPT_VERSION+'\n'+buildVerifierPrompt(input)).digest('hex'),promptVersion:PROMPT_VERSION};}

describe('isolated review lifecycle',()=>{
 it('runs through the authenticated HTTP broker while denying arbitrary jobs and unauthenticated access',async()=>{
  const f=await fixture();const key=Buffer.alloc(32,5).toString('base64');
  // Return to admitted state before exercising the actual remote claim protocol.
  await f.database.orm.update(reviewDispatches).set({ownerToken:null,runId:null,status:'ADMITTED'}).where(eq(reviewDispatches.id,f.dispatch.id));
  const app=buildApp({database:f.database,version:'test',reviewExecutor:{database:f.database,key,service:f.service}}),server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('Test server unavailable');
  const env=parseExecutorSettings({REVIEW_BACKEND:'dedicated',REVIEW_GENERATION:'1',REVIEW_EXECUTOR_KEY:key,PUBLIC_URL:`http://127.0.0.1:${String(address.port)}`});
  try{
   const path=`/internal/reviews/${f.dispatch.id}/claim`;
   expect((await fetch(new URL(path,env.PUBLIC_URL),{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status).toBe(401);
   const call=brokerClient(env);await expect(call(f.dispatch.id,'enqueue',{kind:'payout'})).rejects.toThrow();
   const model=vi.fn((input:VerifyInput)=>Promise.resolve(reviewOutput.parse(output(input))));
   const result=await executeReview(f.dispatch.id,randomUUID(),env,{model});
   expect(result.status).toBe('result_saved');expect(model).toHaveBeenCalledTimes(1);
   expect(JSON.stringify(result)).not.toContain('Adds the input guard');
   expect((await f.database.orm.select().from(reviewDispatches))[0]).toMatchObject({capacityHeld:false,status:'RESULT_SAVED'});
   expect((await executeReview(f.dispatch.id,randomUUID(),env,{model})).status).toBe('ignored');expect(model).toHaveBeenCalledTimes(1);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=> { resolve(); }));await f.close();}
 });
 it('grants inference once, persists before publication and reconciles a lost Check create',async()=>{
  const f=await fixture();try{
   const prepared=await f.service.prepare(f.dispatch.id,f.owner);expect(prepared.ready).toBe(true);
   const grants=await Promise.allSettled([f.service.begin(f.dispatch.id,f.owner),f.service.begin(f.dispatch.id,f.owner)]);
   expect(grants.filter(r=>r.status==='fulfilled')).toHaveLength(1);
   const result=output(required(prepared.input));await f.service.complete(f.dispatch.id,f.owner,result);await f.service.complete(f.dispatch.id,f.owner,result);
   const saved=required((await f.database.orm.select().from(verifications))[0]);expect(saved.status).toBe('DONE');
   expect(await f.database.orm.select().from(verificationPublications)).toHaveLength(1);expect(f.api.createCheckRun).not.toHaveBeenCalled();
   const job=required(await claimJob(f.database,'publisher',60,{only:'publish_verification'}));
   vi.mocked(f.api.createCheckRun).mockRejectedValueOnce(new Error('response lost'));
   await expect(publishVerification(f.database,f.api,job,saved.id,f.env.GH_APP_ID)).rejects.toThrow();
   await expect(publishVerification(f.database,f.api,job,saved.id,f.env.GH_APP_ID)).rejects.toThrow('unknown');
   expect(f.api.createCheckRun).toHaveBeenCalledTimes(1);
   vi.mocked(f.api.checkRuns).mockResolvedValue({complete:true,runs:[{id:'900',name:'Repopay solution review',head_sha:f.pr.head.sha,status:'completed',conclusion:'neutral',external_id:`repopay:${f.submission.id}:${f.pr.head.sha}:1`,app:{id:f.env.GH_APP_ID}}]});
   await publishVerification(f.database,f.api,job,saved.id,f.env.GH_APP_ID);
   expect((await f.database.orm.select().from(verificationPublications))[0]?.publishedAt).not.toBeNull();
   await terminateReview(f.database,f.dispatch.id,required(f.claimed.runId));
   expect(await claimReview(f.database,f.dispatch.id,'another','dedicated',1,artifactVersion)).toBeNull();
  }finally{await f.close();}
 });
 it.each(['revision','sponsor','pause','heartbeat','installation','ci','access'] as const)('retains late %s output as history without a passing review',async change=>{
  const f=await fixture();try{
   const prepared=await f.service.prepare(f.dispatch.id,f.owner);await f.service.begin(f.dispatch.id,f.owner);
   if(change==='revision')await f.database.orm.update(submissions).set({headSha:'d'.repeat(40)}).where(eq(submissions.id,f.submission.id));
   if(change==='sponsor')await f.database.orm.update(copilotSponsors).set({revokedAt:new Date()}).where(eq(copilotSponsors.repoId,'2'));
   if(change==='pause')await pauseReviews(f.database);
   if(change==='heartbeat')await f.database.orm.update(reviewDispatches).set({heartbeatUntil:new Date(0)}).where(eq(reviewDispatches.id,f.dispatch.id));
   if(change==='installation')await f.database.orm.update(installations).set({suspendedAt:new Date()}).where(eq(installations.id,'1'));
   if(change==='ci')vi.mocked(f.api.checkRuns).mockResolvedValue({runs:[],complete:true});
   if(change==='access')f.permissions.fail=true;
   await f.service.complete(f.dispatch.id,f.owner,output(required(prepared.input)));
   expect((await f.database.orm.select().from(verifications))[0]).toMatchObject({status:'ERROR',errorCode:'SUPERSEDED',result:{verdict:'RESOLVES'}});
  }finally{await f.close();}
 });
 it('counts an unknown prior inference against the revision allowance',async()=>{
  const f=await fixture();try{
   await f.service.prepare(f.dispatch.id,f.owner);
   const {id,...prior}=required((await f.database.orm.select().from(verifications))[0]);expect(id).toBeTruthy();
   await f.database.orm.insert(verifications).values({...prior,attempt:2,status:'ERROR',errorCode:'INFERENCE_OUTCOME_UNKNOWN'});
   const limited=createReviewService(f.database,f.api,{...f.env,VERIFIER_MAX_ATTEMPTS_PER_SHA:1},f.auth);
   expect(await limited.begin(f.dispatch.id,f.owner)).toBeNull();
   expect((await f.database.orm.select().from(reviewDispatches))[0]).toMatchObject({status:'RESULT_SAVED',inferenceStartedAt:null});
   expect((await f.database.orm.select().from(verifications).where(eq(verifications.id,id)))[0]?.errorCode).toBe('VERIFIER_BUDGET_EXHAUSTED');
  }finally{await f.close();}
 });
 it('charges the UTC day inference starts even when its record was prepared yesterday',async()=>{
  const f=await fixture();try{
   await f.service.prepare(f.dispatch.id,f.owner);await f.service.begin(f.dispatch.id,f.owner);
   await f.database.orm.update(verifications).set({createdAt:new Date(Date.now()-86400000)});
   await terminateReview(f.database,f.dispatch.id,required(f.claimed.runId));
   await f.database.withTransaction(tx=>enqueue(tx,{kind:'verify_submission',payload:{submissionId:f.submission.id,headSha:f.pr.head.sha,force:true},dedupeKey:'next-review',maxAttempts:1}));
   const job=required(await claimJob(f.database,'dispatcher',60,{only:'verify_submission'}));
   const next=required(await createDispatch(f.database,job,'dedicated',1));await finishJob(f.database,job);await admitReview(f.database);
   const claimed=required(await claimReview(f.database,next.id,randomUUID(),'dedicated',1,artifactVersion)),owner=required(claimed.ownerToken);
   await f.service.prepare(next.id,owner);
   const limited=createReviewService(f.database,f.api,{...f.env,VERIFIER_DAILY_ATTEMPT_LIMIT:1},f.auth);
   expect(await limited.begin(next.id,owner)).toBeNull();
   expect((await f.database.orm.select().from(reviewDispatches).where(eq(reviewDispatches.id,next.id)))[0]?.inferenceStartedAt).toBeNull();
  }finally{await f.close();}
 });
 it('unknown inference consumes its allowance, cannot replay and publishes a safe failure',async()=>{
  const f=await fixture();try{
   await f.service.prepare(f.dispatch.id,f.owner);await f.service.begin(f.dispatch.id,f.owner);
   await terminateReview(f.database,f.dispatch.id,required(f.claimed.runId));
   await expect(f.service.begin(f.dispatch.id,f.owner)).rejects.toThrow();
   expect((await f.database.orm.select().from(reviewDispatches))[0]).toMatchObject({status:'OUTCOME_UNKNOWN',capacityHeld:false});
   expect((await f.database.orm.select().from(verifications))[0]).toMatchObject({status:'ERROR',errorCode:'INFERENCE_OUTCOME_UNKNOWN'});
  }finally{await f.close();}
 });
 it('atomically rolls back saved output when publication persistence fails',async()=>{
  const f=await fixture();try{
   const prepared=await f.service.prepare(f.dispatch.id,f.owner);await f.service.begin(f.dispatch.id,f.owner);
   await f.database.pool.query('ALTER TABLE verification_publications ADD CONSTRAINT test_failure CHECK (false)');
   await expect(f.service.complete(f.dispatch.id,f.owner,output(required(prepared.input)))).rejects.toThrow();
   expect((await f.database.orm.select().from(verifications))[0]).toMatchObject({status:'PENDING',result:null});
   expect((await f.database.orm.select().from(reviewDispatches))[0]?.status).toBe('INFERENCE_STARTED');
  }finally{await f.close();}
 });
});
