import { readFile,open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { verdictSchema } from '../src/verifier/schema.js';
import { summarizeEvaluation } from '../src/verifier/evaluation.js';
import { PROMPT_VERSION } from '../src/verifier/prompt.js';
import { COPILOT_SDK_VERSION } from '../src/models/copilot.js';
import { evaluationFixture,evaluateFixtures } from '../src/verifier/evaluate.js';

const verdict=z.enum(['RESOLVES','PARTIAL','DOES_NOT_RESOLVE']);
const fixture=evaluationFixture;
const input=z.object({model:z.string().min(1),promptVersion:z.string().min(1),sdkVersion:z.string().min(1),observations:z.array(z.object({caseId:z.string().min(1),attempts:z.array(z.object({validatedResult:verdictSchema.optional(),policyReason:z.string().optional(),model:z.string().trim().min(1).optional(),verdict,payable:z.boolean(),elapsedMs:z.number(),totalNanoAiu:z.number().nullable(),totalPremiumRequestCost:z.number().nullable()}).strict())}).strict())}).strict();
const fixtures=fixture.array().parse(JSON.parse(await readFile(new URL('../test/fixtures/verifier/cases.json',import.meta.url),'utf8')));
const requiredCalls=fixtures.length*3;
const reportArg=process.argv.indexOf('--report');
if(process.argv.includes('--live')){
 const argument=(name:string)=>{const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:undefined;};
 const repoId=argument('--repo-id'),output=argument('--output');
 if(!repoId||!/^\d+$/.test(repoId)||!output||!process.argv.includes(`--allow-${String(requiredCalls)}-requests`))throw new Error(`Live evaluation requires --repo-id, --output and --allow-${String(requiredCalls)}-requests after sponsor approval.`);
 const {parseFundingEnv,parseCopilotEnv}=await import('../src/env.js');
 const {createDatabase}=await import('../src/db/client.js');
 const {createAuth}=await import('../src/github/oauth.js');
 const {createGitHub}=await import('../src/github/app.js');
 const {currentAccess}=await import('../src/github/permissions.js');
 const {verify}=await import('../src/verifier/verify.js');
 const env=parseFundingEnv(process.env),db=createDatabase(env.DATABASE_URL),auth=createAuth(db,env),github=createGitHub(env);
 const file=await open(resolve(output),'wx',0o600);
 let count=0,started=0;
 try{
  const scopedEnv=async()=>{
   const sponsor=await auth.getCopilotSponsor(repoId);
   if(sponsor.modelId!=='auto')throw new Error('Evaluation requires an Auto sponsor');
   await currentAccess(github,sponsor.installationId,repoId);
   const identity=await auth.provider.identity(sponsor.accessToken),access=await auth.provider.repository(sponsor.accessToken,repoId);
   if(identity.id!==sponsor.sponsorGhId||access.id!==repoId||access.ownerId!==identity.id||access.ownerType!=='User'||!access.admin)throw new Error('Current repository-owner sponsorship required');
   return parseCopilotEnv({COPILOT_GITHUB_TOKEN:sponsor.accessToken,COPILOT_BILLING_OWNER_ID:sponsor.sponsorGhId,COPILOT_AUTH_KIND:'user',COPILOT_MODEL:'auto',COPILOT_TIMEOUT_MS:'120000',PROVIDER_RESPONSE_MAX_BYTES:String(env.PROVIDER_RESPONSE_MAX_BYTES)});
  };
  const profile=await scopedEnv();
  const report=await evaluateFixtures(fixtures,profile,async observations=>{
   count=observations.reduce((sum,row)=>sum+row.attempts.length,0);
   const content=JSON.stringify({model:'auto',promptVersion:PROMPT_VERSION,sdkVersion:COPILOT_SDK_VERSION,observations},null,2)+'\n';
   await file.truncate(0);await file.write(content,0,'utf8');await file.sync();
   process.stdout.write(`Evaluation progress: ${String(count)}/${String(requiredCalls)}\n`);
  },async evidence=>{if(started>=requiredCalls)throw new Error('Approved request cap reached');const scoped=await scopedEnv();started++;return verify(evidence,scoped);});
  process.stdout.write(JSON.stringify(report,null,2)+'\n');if(!report.passed)process.exitCode=1;
 }catch{
  process.stderr.write(`Live evaluation stopped after ${String(started)} started requests (${String(count)} completed). Partial observations retained; no automatic retry. Check sponsor access/provider availability.\n`);process.exitCode=1;
 }finally{await file.close();await db.close();}
}else if(reportArg<0||!process.argv[reportArg+1]){
 process.stdout.write(`${JSON.stringify({status:'fixtures_ready_live_evaluation_not_run',model:process.env.COPILOT_MODEL||null,promptVersion:PROMPT_VERSION,sdkVersion:COPILOT_SDK_VERSION,requiredRunsPerCase:3,requiredCalls:fixtures.length*3,cases:fixtures.map(({id,expected,sufficient})=>({id,expected,sufficient})),costTelemetry:'Live reports require SDK-reported nano-AIU and premium-request metrics; these are Copilot billing units, not USD.'},null,2)}\n`);
} else {
 const reportPath=process.argv[reportArg+1];
 if(!reportPath)throw new Error('A report path is required after --report.');
 const raw=input.parse(JSON.parse(await readFile(resolve(reportPath),'utf8')));
 if(raw.promptVersion!==PROMPT_VERSION||raw.sdkVersion!==COPILOT_SDK_VERSION)throw new Error('Evaluation report does not match the current prompt and SDK versions.');
 const report=summarizeEvaluation({model:raw.model,promptVersion:raw.promptVersion,sdkVersion:raw.sdkVersion,cases:fixtures.map(row=>({id:row.id,expected:row.expected,sufficient:row.sufficient})),observations:raw.observations});
 process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
 if(!report.passed)process.exitCode=1;
}
