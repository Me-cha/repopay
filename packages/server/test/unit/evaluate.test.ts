import { expect,it,vi } from 'vitest';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { evaluationFixture } from '../../src/verifier/evaluate.js';
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
it('evaluation source establishes the full fix and an actual partial-fix counterexample',()=>{
 const cases=evaluationFixture.array().parse(JSON.parse(readFileSync(new URL('../fixtures/verifier/cases.json',import.meta.url),'utf8')));
 const parser=(id:string)=>{
  const row=cases.find(c=>c.id===id);
  if(!row)throw new Error(`Missing fixture ${id}`);
  const line=row.diff.split('\n').find(line=>line.startsWith('{')&&line.includes('"path": "parser.js"'));
  if(!line)throw new Error(`Missing parser context ${id}`);
  const context=JSON.parse(line) as {content:string};
  // Execute only this repository's controlled synthetic fixture, never PR evidence.
  return runInNewContext(context.content.replace('export function','function')+'; parseCode',{}, {timeout:1000}) as (value:unknown)=>number;
 };
 const full=parser('full-fix'),partial=parser('partial-fix');
 for(const [value,expected] of [['0',0],['007',7],['9999',9999]] as const)expect(full(value)).toBe(expected);
 for(const value of ['', 'abc', '-1', '1.5', ' 1', '1 ', '12345', '1\n', '1\r', '1\r\n', '1\u2028', '1\u2029', null, 12, undefined, {}, []])expect(()=>full(value)).toThrow('Invalid code');
 expect(partial('007')).toBe(7);
 expect(()=>partial('abc')).toThrow('Invalid code');
 expect(partial('12345')).toBe(12345);
 for(const id of ['fake-test-fix','injected-instructions','unrelated-change'])expect(parser(id)('abc')).toBeNaN();
 expect(cases.find(c=>c.id==='insufficient-truncated')?.sufficient).toBe(false);
});
it('v5 catalog exercises attribution and real multiline defects with a bounded 30-call run',async()=>{
 const cases=evaluationFixture.array().parse(JSON.parse(readFileSync(new URL('../fixtures/verifier/cases.json',import.meta.url),'utf8')));
 expect(cases).toHaveLength(10);
 const verifier=vi.fn<typeof verify>().mockImplementation(input=>{const test=cases.find(c=>c.diff===input.diff);if(!test)throw new Error('Missing fixture');return Promise.resolve({...result,value:{...result.value,verdict:test.expected}});});
 const checkpoint=vi.fn<(rows:EvaluationObservation[])=>Promise<void>>().mockResolvedValue(undefined);
 expect((await evaluateFixtures(cases,env,checkpoint,verifier)).passed).toBe(true);
 expect(verifier).toHaveBeenCalledTimes(30);
 const complete=verifier.mock.calls[18]?.[0],missing=verifier.mock.calls[21]?.[0],stale=verifier.mock.calls[24]?.[0];
 if(!complete||!missing||!stale)throw new Error('Missing attribution evaluations');
 expect(complete.eligibleAuthors.map(a=>a.ghId)).toEqual(['8','9']);
 expect(complete.diff).toContain('"kind":"confirm"');
 for(const input of [missing,stale]){
  expect(input.sufficient).toBe(false);expect(input.truncated).toBe(false);
  expect(input.eligibleAuthors.map(a=>a.ghId)).toEqual(['8']);
  expect(input.unverifiedAuthors).toEqual(['9']);
 }
 expect(missing.diff).not.toContain('"kind":"confirm"');
 expect(stale.diff).toContain('"attestations":[]');
 expect(stale.prBody).toContain('d'.repeat(40));
 expect(checkpoint.mock.calls.at(-1)?.[0]?.filter(c=>['contribution-missing','contribution-stale'].includes(c.caseId)).every(c=>c.attempts.every(a=>!a.payable))).toBe(true);
});

it('executes supplied line-ending regressions and detects the genuinely broken multiline variant',()=>{
 const cases=evaluationFixture.array().parse(JSON.parse(readFileSync(new URL('../fixtures/verifier/cases.json',import.meta.url),'utf8')));
 const context=(id:string,path:string)=>{
  const fixture=cases.find(c=>c.id===id);
  if(!fixture)throw new Error('Missing fixture');
  const contexts=fixture.diff.split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line) as {path?:string;content?:string});
  const content=contexts.find(c=>c.path===path)?.content;
  if(!content)throw new Error('Missing context');
  return content;
 };
 const tests=context('full-fix','parser.test.js').split('\n').filter(line=>!line.startsWith('import ')).join('\n');
 const run=(source:string)=>runInNewContext(source.replace('export function','function')+'\n'+tests,{assert},{timeout:1000}) as unknown;
 for(const id of ['full-fix','contribution-confirmed','contribution-missing','contribution-stale'])expect(()=>run(context(id,'parser.js'))).not.toThrow();
 // This mutation passes the original ordinary examples, but violates the frozen whitespace rule.
 expect(()=>run(context('multiline-anchor-bug','parser.js'))).toThrow(/Missing expected exception/);
 const broken=runInNewContext(context('multiline-anchor-bug','parser.js').replace('export function','function')+'; parseCode',{}, {timeout:1000}) as (value:string)=>number;
 expect(broken('1\n')).toBe(1);
});
