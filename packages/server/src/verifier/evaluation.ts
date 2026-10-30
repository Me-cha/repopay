export interface EvaluationCase {id:string;expected:'RESOLVES'|'PARTIAL'|'DOES_NOT_RESOLVE';sufficient:boolean}
export interface EvaluationAttempt {model?:string|undefined;verdict:'RESOLVES'|'PARTIAL'|'DOES_NOT_RESOLVE';payable:boolean;elapsedMs:number;totalNanoAiu:number|null;totalPremiumRequestCost:number|null}
export interface EvaluationObservation {caseId:string;attempts:EvaluationAttempt[]}
export interface EvaluationReport {model:string;promptVersion:string;sdkVersion:string;cases:{caseId:string;expected:string;attempts:number;models:(string|null)[];failures:string[];elapsedMs:number[];totalNanoAiu:(number|null)[];totalPremiumRequestCost:(number|null)[]}[];passed:boolean;liveEvidenceComplete:boolean}

export function summarizeEvaluation(input:{model:string;promptVersion:string;sdkVersion:string;cases:EvaluationCase[];observations:EvaluationObservation[];requiredRuns?:number}):EvaluationReport {
 const requiredRuns=input.requiredRuns??3;
 const cases:EvaluationReport['cases']=input.cases.map(test=>{
  const matching=input.observations.filter(row=>row.caseId===test.id),attempts=matching.flatMap(row=>row.attempts),failures:string[]=[];
  if(matching.length>1)failures.push('duplicate observation rows for fixture');
  if(attempts.length!==requiredRuns)failures.push(`expected ${String(requiredRuns)} runs, received ${String(attempts.length)}`);
  for(const [index,result] of attempts.entries()){
   if(result.verdict!==test.expected)failures.push(`run ${String(index+1)} misclassified: ${result.verdict}`);
   if((input.model.trim().toLowerCase()==='auto'&&(!result.model?.trim()||result.model.trim().toLowerCase()==='auto'))||(result.model!==undefined&&input.model.trim().toLowerCase()!=='auto'&&result.model!==input.model))failures.push(`run ${String(index+1)} has invalid serving-model provenance`);
   if(!test.sufficient&&result.payable)failures.push(`run ${String(index+1)} marked insufficient evidence payable`);
   if(!Number.isFinite(result.elapsedMs)||result.elapsedMs<0)failures.push(`run ${String(index+1)} has invalid latency`);
   if(result.totalNanoAiu!==null&&(!Number.isFinite(result.totalNanoAiu)||result.totalNanoAiu<0))failures.push(`run ${String(index+1)} has invalid Copilot AI-credit usage`);
   if(result.totalPremiumRequestCost!==null&&(!Number.isFinite(result.totalPremiumRequestCost)||result.totalPremiumRequestCost<0))failures.push(`run ${String(index+1)} has invalid premium-request cost`);
  }
  return {caseId:test.id,expected:test.expected,attempts:attempts.length,models:attempts.map(row=>row.model??null),failures,elapsedMs:attempts.map(row=>row.elapsedMs),totalNanoAiu:attempts.map(row=>row.totalNanoAiu),totalPremiumRequestCost:attempts.map(row=>row.totalPremiumRequestCost)};
 });
 const extra=input.observations.filter(row=>!input.cases.some(test=>test.id===row.caseId));
 if(extra.length)cases.push(...extra.map(row=>({caseId:row.caseId,expected:'UNEXPECTED',attempts:row.attempts.length,models:row.attempts.map(item=>item.model??null),failures:['observation does not match a fixture'],elapsedMs:row.attempts.map(item=>item.elapsedMs),totalNanoAiu:row.attempts.map(item=>item.totalNanoAiu),totalPremiumRequestCost:row.attempts.map(item=>item.totalPremiumRequestCost)})));
 const modelEvidence=!!input.model.trim()&&(input.model.trim().toLowerCase()!=='auto'||cases.every(row=>row.models.every(model=>!!model?.trim()&&model.trim().toLowerCase()!=='auto')));
 const liveEvidenceComplete=modelEvidence&&input.cases.length>0&&new Set(input.cases.map(row=>row.id)).size===input.cases.length&&Number.isSafeInteger(requiredRuns)&&requiredRuns>=3&&cases.length===input.cases.length&&cases.every(row=>row.attempts===requiredRuns&&row.totalNanoAiu.length===requiredRuns&&row.totalNanoAiu.every(cost=>cost!==null)&&row.totalPremiumRequestCost.length===requiredRuns&&row.totalPremiumRequestCost.every(cost=>cost!==null))&&!!input.promptVersion.trim()&&!!input.sdkVersion.trim();
 return {model:input.model,promptVersion:input.promptVersion,sdkVersion:input.sdkVersion,cases,passed:liveEvidenceComplete&&cases.every(row=>row.failures.length===0),liveEvidenceComplete};
}
