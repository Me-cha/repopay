import type { CheckRun } from './app.js';

export interface CiSnapshot {
 status:'pass'|'fail'|'pending'|'none';testedSha:string;complete:boolean;
 required:{name:string;appId:string;status:'pass'|'fail'|'pending'|'missing'}[];
 externalSuccessCount:number;reason:string;
}
export function normalizeCi(input:{sha:string;runs:CheckRun[];complete:boolean;required:{name:string;appId:string}[];requiredEnabled:boolean;ownAppId:string}):CiSnapshot {
 const relevant=input.runs.filter(run=>run.head_sha===input.sha&&run.app?.id!==input.ownAppId);
 const externalSuccessCount=relevant.filter(run=>run.app?.id&&run.status==='completed'&&run.conclusion==='success').length;
 const required=input.required.map(context=>{
  const matched=relevant.filter(run=>run.name===context.name&&run.app?.id===context.appId);
  if(!matched.length)return {...context,status:'missing' as const};
  const latest=matched.sort((a,b)=>BigInt(b.id)>BigInt(a.id)?1:BigInt(b.id)<BigInt(a.id)?-1:0)[0];
  if(!latest)return {...context,status:'missing' as const};
  if(latest.status!=='completed')return {...context,status:'pending' as const};
  return {...context,status:latest.conclusion==='success'?'pass' as const:'fail' as const};
 });
 const failed=relevant.some(run=>run.app?.id&&run.status==='completed'&&['failure','timed_out','action_required','cancelled'].includes(run.conclusion??''))||required.some(item=>item.status==='fail');
 const pending=!input.complete||relevant.some(run=>run.status!=='completed')||required.some(item=>item.status==='pending'||item.status==='missing');
 if(failed)return {status:'fail',testedSha:input.sha,complete:input.complete,required,externalSuccessCount,reason:'A trusted external check failed.'};
 if(pending)return {status:'pending',testedSha:input.sha,complete:input.complete,required,externalSuccessCount,reason:input.complete?'Checks are pending or a required trusted context is missing.':'Check pagination was incomplete.'};
 if(input.requiredEnabled&&(!required.length||required.some(item=>item.status!=='pass')||!externalSuccessCount))return {status:'pending',testedSha:input.sha,complete:input.complete,required,externalSuccessCount,reason:'Required trusted CI has no successful external check.'};
 if(externalSuccessCount)return {status:'pass',testedSha:input.sha,complete:input.complete,required,externalSuccessCount,reason:'External checks passed for this exact commit.'};
 return {status:input.requiredEnabled?'pending':'none',testedSha:input.sha,complete:input.complete,required,externalSuccessCount,reason:input.requiredEnabled?'Required external CI is missing.':'No external check result is available.'};
}
