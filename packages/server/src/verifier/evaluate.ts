import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { CopilotEnv } from '../env.js';
import { decide } from '../policy/decide.js';
import type { VerifyInput } from './collect.js';
import { verify } from './verify.js';
import { PROMPT_VERSION } from './prompt.js';
import { COPILOT_SDK_VERSION } from '../models/copilot.js';
import { summarizeEvaluation,type EvaluationObservation } from './evaluation.js';

export const evaluationFixture=z.object({id:z.string().min(1),title:z.string(),body:z.string(),criteria:z.string(),diff:z.string(),sufficient:z.boolean(),expected:z.enum(['RESOLVES','PARTIAL','DOES_NOT_RESOLVE'])}).strict();
export type EvaluationFixture=z.infer<typeof evaluationFixture>;
export function fixtureInput(fixture:EvaluationFixture):VerifyInput {
 const sha='a'.repeat(40);
 return {submissionId:'1',bountyId:'1',issueNumber:1,prNumber:2,headSha:sha,baseSha:'b'.repeat(40),title:fixture.title,criteria:fixture.criteria,prTitle:fixture.title,prBody:fixture.body,diff:fixture.diff,truncated:!fixture.sufficient,sufficient:fixture.sufficient,eligibleAuthors:[{ghId:'8',login:'fixture-author'}],unverifiedAuthors:[],ci:{status:'pass',testedSha:sha,complete:true,required:[{name:'test',appId:'1',status:'pass'}],externalSuccessCount:1,reason:'Synthetic evaluation CI'},snapshotHash:createHash('sha256').update(JSON.stringify(fixture)).digest('hex')};
}
// This function has no GitHub publishing or payment dependencies. Tests inject a
// verifier; the live command uses the exact application adapter and sponsor grant.
export async function evaluateFixtures(fixtures:EvaluationFixture[],env:CopilotEnv,checkpoint:(observations:EvaluationObservation[])=>Promise<void>,verifyFn:typeof verify=verify) {
 if(fixtures.length!==6||new Set(fixtures.map(f=>f.id)).size!==6)throw new Error('Evaluation requires six distinct fixtures');
 const observations:EvaluationObservation[]=[];
 for(const fixture of fixtures){
  const observation:EvaluationObservation={caseId:fixture.id,attempts:[]};observations.push(observation);
  for(let run=0;run<3;run++){
   const input=fixtureInput(fixture),result=await verifyFn(input,env);
   const decision=decide({bountyCents:100,verdict:result.value,ci:input.ci.status,eligible:new Map(input.eligibleAuthors.map(a=>[a.ghId,a.login])),evidence:{truncated:input.truncated,sufficient:input.sufficient,stale:false},cfg:{minConfidence:0.9,minShare:0.05,ciRequired:true}});
   observation.attempts.push({validatedResult:result.value,policyReason:decision.reason,model:result.model,verdict:result.value.verdict,payable:decision.kind==='pay',elapsedMs:result.elapsedMs,totalNanoAiu:result.usage.totalNanoAiu,totalPremiumRequestCost:result.usage.totalPremiumRequestCost});
   await checkpoint(structuredClone(observations));
  }
 }
 return summarizeEvaluation({model:env.COPILOT_MODEL,promptVersion:PROMPT_VERSION,sdkVersion:COPILOT_SDK_VERSION,cases:fixtures,observations});
}
