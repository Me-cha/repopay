import { expect,it,vi } from 'vitest';
import { evaluateFixtures,type EvaluationFixture } from '../../src/verifier/evaluate.js';
import { parseCopilotEnv } from '../../src/env.js';
import type { EvaluationObservation } from '../../src/verifier/evaluation.js';
import type { verify } from '../../src/verifier/verify.js';
const env=parseCopilotEnv({COPILOT_GITHUB_TOKEN:'ghu_synthetic',PROVIDER_RESPONSE_MAX_BYTES:'100000',COPILOT_BILLING_OWNER_ID:'4',COPILOT_AUTH_KIND:'user',COPILOT_MODEL:'auto'});
const fixtures:EvaluationFixture[]=Array.from({length:6},(_,i)=>({id:String(i),title:'fixture',body:'untrusted',criteria:'rule',diff:'change',sufficient:i!==5,expected:'RESOLVES'}));
const result={value:{verdict:'RESOLVES' as const,coverage:1,confidence:1,reasoning:'Synthetic',unmet_requirements:[],splits:[{gh_id:'8',share:1,why:'author'}]},usage:{totalNanoAiu:10,totalPremiumRequestCost:1,totalApiDurationMs:1,totalUserRequests:1,inputTokens:1,outputTokens:1,cacheReadTokens:0,cacheWriteTokens:0},provider:'copilot' as const,requestedModel:'auto',model:'served',sdkVersion:'1.0.28',billingOwnerId:'4',elapsedMs:10,promptHash:'f'.repeat(64),promptVersion:'gitpay-verifier-v1'};
it('makes exactly 18 calls, checkpoints every result and applies policy to insufficient evidence',async()=>{
 const verifier=vi.fn<typeof verify>().mockResolvedValue(result),checkpoint=vi.fn<(rows:EvaluationObservation[])=>Promise<void>>().mockResolvedValue(undefined);
 const report=await evaluateFixtures(fixtures,env,checkpoint,verifier);
 expect(checkpoint.mock.calls[0]?.[0]?.[0]?.attempts[0]?.validatedResult).toEqual(result.value);
 expect(checkpoint.mock.calls.at(-1)?.[0]?.at(-1)?.attempts[0]?.policyReason).toBe('Evidence is truncated');
 expect(verifier).toHaveBeenCalledTimes(18);expect(checkpoint).toHaveBeenCalledTimes(18);
 expect(checkpoint.mock.calls.at(-1)?.[0]?.at(-1)?.attempts.every(a=>!a.payable)).toBe(true);
 expect(report.passed).toBe(true);expect(report.cases.every(c=>c.models.every(m=>m==='served'))).toBe(true);
});
it('stops on provider error without retrying or discarding completed observations',async()=>{
 const verifier=vi.fn<typeof verify>().mockResolvedValueOnce(result).mockRejectedValue(new Error('provider unavailable')),checkpoint=vi.fn<(rows:EvaluationObservation[])=>Promise<void>>().mockResolvedValue(undefined);
 await expect(evaluateFixtures(fixtures,env,checkpoint,verifier)).rejects.toThrow();
 expect(verifier).toHaveBeenCalledTimes(2);expect(checkpoint).toHaveBeenCalledTimes(1);
});
