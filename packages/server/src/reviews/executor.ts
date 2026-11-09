import { z } from 'zod';
import { requestJson } from '../preflight/http.js';
import type { VerifyInput } from '../verifier/collect.js';
import { verify } from '../verifier/verify.js';
import { parseCopilotEnv } from '../env.js';
import { CopilotCleanupError } from '../models/copilot.js';
import { executorSignature } from './auth.js';
import { artifactVersion,type ExecutorSettings } from './config.js';
import { reviewOutput } from './contracts.js';

export function brokerClient(env:ExecutorSettings){
 return async(id:string,operation:string,payload:unknown):Promise<unknown>=>{
  const path=`/internal/reviews/${id}/${operation}`,body=JSON.stringify(payload),timestamp=String(Date.now());
  const timeout=['prepare','begin'].includes(operation)?45000:operation==='complete'?15000:10000;
  const result=await requestJson({PROVIDER_TIMEOUT_MS:timeout,PROVIDER_RESPONSE_MAX_BYTES:1048576},new URL(path,env.PUBLIC_URL).href,{method:'POST',headers:{'content-type':'application/json','x-review-time':timestamp,'x-review-signature':executorSignature(env.REVIEW_EXECUTOR_KEY,path,timestamp,body)},body});
  if(result.status!==200)throw new Error('Review broker request unavailable');
  return result.body;
 };
}
export type Broker=ReturnType<typeof brokerClient>;
export const taskInput=z.object({dispatchId:z.uuid()}).strict();
export function identity(env:ExecutorSettings,runId:string){return {backend:env.REVIEW_BACKEND,generation:env.REVIEW_GENERATION,artifactVersion,runId};}

// No token, source or verdict enters the task return value or an exception.
export async function executeReview(dispatchId:string,runId:string,env:ExecutorSettings,options:{broker?:Broker;model?:typeof verify;signal?:AbortSignal;heartbeatMs?:number}={}){
 const call=options.broker??brokerClient(env),model=options.model??verify;
 const controller=new AbortController();
 const abort=()=> { controller.abort(); };options.signal?.addEventListener('abort',abort,{once:true});
 const deadline=setTimeout(abort,240000);
 if(options.signal?.aborted)abort();
 let ownerToken:string|null=null,timer:ReturnType<typeof setInterval>|undefined,pulse:Promise<void>|undefined;
 const cleanup:{confirmed:boolean}={confirmed:true};
 try{
  controller.signal.throwIfAborted();
  ({ownerToken}=z.object({ownerToken:z.uuid().nullable()}).parse(await call(dispatchId,'claim',identity(env,runId))));
  if(!ownerToken)return {dispatchId,status:'ignored'};
  const owner={ownerToken};
  timer=setInterval(()=>{if(!pulse)pulse=call(dispatchId,'heartbeat',owner).then(()=>{}).catch(abort).finally(()=>{pulse=undefined;});},options.heartbeatMs??15000);
  const prepared=await call(dispatchId,'prepare',owner);
  // Input comes only from the authenticated broker; result validation remains server-side.
  const parsed=z.object({ready:z.boolean(),input:z.custom<VerifyInput>(v=>!!v&&typeof v==='object').optional()}).parse(prepared);
  if(!parsed.ready)return {dispatchId,status:'finished_without_inference'};
  if(!parsed.input)throw new Error('Missing review input');
  controller.signal.throwIfAborted();
  const grant=z.object({credentials:z.record(z.string(),z.unknown()).nullable()}).parse(await call(dispatchId,'begin',owner));
  if(!grant.credentials)return {dispatchId,status:'finished_without_inference'};
  controller.signal.throwIfAborted();
  const credentials=parseCopilotEnv(Object.fromEntries(Object.entries(grant.credentials).map(([key,value])=>[key,String(value)])));
  const output=reviewOutput.parse(await model(parsed.input,credentials,undefined,controller.signal));
  // A lost save response can retry the identical output; never call the model again.
  for(let attempt=0;attempt<3;attempt++){
   try{await call(dispatchId,'complete',{...owner,output});return {dispatchId,status:'result_saved'};}
   catch{if(attempt===2)throw new Error('Review persistence unavailable');}
  }
  return {dispatchId,status:'outcome_unknown'};
 }catch(error){cleanup.confirmed=!(error instanceof CopilotCleanupError);return {dispatchId,status:cleanup.confirmed?'stopped':'cleanup_unknown'};}
 finally{
  clearTimeout(deadline);if(timer)clearInterval(timer);await pulse;options.signal?.removeEventListener('abort',abort);
  // A failed subprocess shutdown must retain admission until provider termination
  // or an operator confirms the dedicated process has actually exited.
  if(ownerToken&&cleanup.confirmed)await call(dispatchId,'stop',{ownerToken}).catch(()=>{});
 }
}
