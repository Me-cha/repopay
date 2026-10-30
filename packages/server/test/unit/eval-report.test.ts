import { describe,expect,it } from 'vitest';
import { summarizeEvaluation } from '../../src/verifier/evaluation.js';

const cases=[{id:'full',expected:'RESOLVES' as const,sufficient:true},{id:'thin',expected:'PARTIAL' as const,sufficient:false}];
const attempts=(verdict:'RESOLVES'|'PARTIAL'|'DOES_NOT_RESOLVE',payable=false)=>Array.from({length:3},()=>({verdict,payable,elapsedMs:120,totalNanoAiu:125000000,totalPremiumRequestCost:0.25}));

describe('verifier evaluation report',()=>{
 it('retains any misclassification and rejects payable insufficient evidence',()=>{
  const report=summarizeEvaluation({model:'fixed-model',promptVersion:'p1',sdkVersion:'1.0.28',cases,observations:[{caseId:'full',attempts:attempts('RESOLVES')},{caseId:'thin',attempts:attempts('RESOLVES',true)}]});
  expect(report.passed).toBe(false);
  expect(report.cases[1]?.failures).toContain('run 1 misclassified: RESOLVES');
  expect(report.cases[1]?.failures).toContain('run 1 marked insufficient evidence payable');
 });
 it('does not pass acceptance when actual Copilot usage metrics are missing',()=>{
  const report=summarizeEvaluation({model:'fixed-model',promptVersion:'p1',sdkVersion:'1.0.28',cases,observations:[{caseId:'full',attempts:attempts('RESOLVES')},{caseId:'thin',attempts:Array.from({length:3},()=>({verdict:'PARTIAL' as const,payable:false,elapsedMs:100,totalNanoAiu:null,totalPremiumRequestCost:null}))}]});
  expect(report.liveEvidenceComplete).toBe(false);
  expect(report.passed).toBe(false);
 });
 it('reports omitted required cases and unexpected observations as failures',()=>{
  const report=summarizeEvaluation({model:'fixed-model',promptVersion:'p1',sdkVersion:'1.0.28',cases,observations:[{caseId:'full',attempts:attempts('RESOLVES')},{caseId:'extra',attempts:attempts('RESOLVES')}]});
  expect(report.passed).toBe(false);
  expect(report.cases.find(row=>row.caseId==='thin')?.failures).toContain('expected 3 runs, received 0');
  expect(report.cases.find(row=>row.caseId==='extra')?.failures).toContain('observation does not match a fixture');
 });
 it('does not let duplicate report rows overwrite a failed run or use Auto as fixed-model evidence',()=>{
  const report=summarizeEvaluation({model:'Auto',promptVersion:'p1',sdkVersion:'1.0.28',cases,observations:[{caseId:'full',attempts:attempts('RESOLVES')},{caseId:'full',attempts:attempts('DOES_NOT_RESOLVE')},{caseId:'thin',attempts:attempts('PARTIAL')}]});
  expect(report.passed).toBe(false);
  expect(report.cases[0]?.attempts).toBe(6);
  expect(report.cases[0]?.failures).toContain('duplicate observation rows for fixture');
  expect(report.cases[0]?.failures).toContain('run 4 misclassified: DOES_NOT_RESOLVE');
  expect(report.liveEvidenceComplete).toBe(false);
 });
});
it('accepts Auto evaluation only with concrete serving-model provenance for every run',()=>{
 const observations=cases.map(test=>({caseId:test.id,attempts:attempts(test.expected).map(row=>({...row,model:'serving-model'}))}));
 expect(summarizeEvaluation({model:'auto',promptVersion:'p1',sdkVersion:'1.0.28',cases,observations}).passed).toBe(true);
 expect(summarizeEvaluation({model:'auto',promptVersion:'p1',sdkVersion:'1.0.28',cases,observations:cases.map(test=>({caseId:test.id,attempts:attempts(test.expected)}))}).passed).toBe(false);
 expect(summarizeEvaluation({model:'auto',promptVersion:'p1',sdkVersion:'1.0.28',cases,observations:observations.map(row=>({...row,attempts:row.attempts.map(a=>({...a,model:'auto'}))}))}).passed).toBe(false);
});
it('cannot pass an empty evaluation suite',()=>{
 expect(summarizeEvaluation({model:'fixed',promptVersion:'p1',sdkVersion:'1',cases:[],observations:[]}).passed).toBe(false);
});
