import { z } from 'zod';
import { requestJson } from '../preflight/http.js';
import type { VerifyInput } from '../verifier/collect.js';
import { verify } from '../verifier/verify.js';
import { parseCopilotEnv } from '../env.js';
import { CopilotCleanupError,CopilotDiagnosticError,type CopilotStage } from '../models/copilot.js';
import { executorSignature } from './auth.js';
import { artifactVersion,type ExecutorSettings } from './config.js';
import { reviewOutput } from './contracts.js';

const brokerFailureResponseSchema=z.object({code:z.enum(['EXECUTOR_AUTH_FAILED','DEDICATED_BACKEND_REQUIRED','BROKER_INPUT_INVALID','SPONSOR_AUTH_REJECTED','SPONSOR_BINDING_UNAVAILABLE','SPONSOR_ACCESS_UNAVAILABLE','SPONSOR_AUTHORIZATION_CHANGED','REVIEW_OWNERSHIP_LOST','FUNDING_OR_INSTALLATION_CHANGED','REVIEW_EVIDENCE_CHANGED','REVIEW_SUPERSEDED','INFERENCE_NOT_AUTHORIZED','REVIEW_RESULT_INVALID','BROKER_OPERATION_FAILED','UNKNOWN_BROKER_OPERATION'])});
export function brokerClient(env:ExecutorSettings){
 return async(id:string,operation:string,payload:unknown):Promise<unknown>=>{
  const path=`/internal/reviews/${id}/${operation}`,body=JSON.stringify(payload),timestamp=String(Date.now());
  const timeout=['prepare','begin'].includes(operation)?45000:operation==='complete'?15000:10000;
  let result;try{result=await requestJson({PROVIDER_TIMEOUT_MS:timeout,PROVIDER_RESPONSE_MAX_BYTES:1048576},new URL(path,env.PUBLIC_URL).href,{method:'POST',headers:{'content-type':'application/json','x-review-time':timestamp,'x-review-signature':executorSignature(env.REVIEW_EXECUTOR_KEY,path,timestamp,body)},body});}
  catch{throw new ReviewBrokerFailure('BROKER_REQUEST_FAILED');}
  if(result.status!==200){const diagnostic=brokerFailureResponseSchema.safeParse(result.body);throw new ReviewBrokerFailure(diagnostic.success?diagnostic.data.code:'BROKER_HTTP_ERROR',result.status);}
  return result.body;
 };
}
class ReviewBrokerFailure extends Error{
 constructor(readonly code:string,readonly httpStatus?:number){super(code);}
}
type ExecutorStage='claim'|'claim_response'|'prepare'|'prepare_response'|'begin'|'begin_response'|'sponsor_credentials'|'model'|'model_output_validation'|'result_submission'|'heartbeat'|'stop'|'verifier_author_validation'|CopilotStage;
function logExecutorFailure(stage:ExecutorStage,code:string,httpStatus?:number){
 console.error(JSON.stringify({event:'review_executor_stopped',stage,code,...(httpStatus?{httpStatus}:{})}));
}
function failureCode(error:unknown,stage:ExecutorStage,abortCode:string|null){
 if(error instanceof CopilotCleanupError)return 'COPILOT_CLEANUP_FAILED';
 if(error instanceof ReviewBrokerFailure)return error.code;
 if(error instanceof CopilotDiagnosticError)return abortCode??error.diagnosticCode;
 if(abortCode)return abortCode;
 if(error instanceof Error&&error.name==='AbortError')return 'ABORTED';
 if(stage.includes('cleanup')||stage==='copilot_runtime_shutdown')return 'COPILOT_CLEANUP_FAILED';
 if(stage.startsWith('copilot_'))return 'COPILOT_FAILURE';
 if(stage==='result_submission')return 'RESULT_SUBMISSION_FAILED';
 if(stage==='sponsor_credentials')return 'SPONSOR_CREDENTIALS_INVALID';
 if(stage==='model_output_validation')return 'MODEL_OUTPUT_INVALID';
 if(stage==='model')return 'MODEL_FAILURE';
 if(['claim','prepare','begin','heartbeat','stop'].includes(stage))return 'BROKER_OPERATION_FAILED';
 if(stage.endsWith('_response'))return 'EXECUTOR_RESPONSE_INVALID';
 return 'EXECUTION_FAILED';
}
export type Broker=ReturnType<typeof brokerClient>;
export const taskInput=z.object({dispatchId:z.uuid()}).strict();
export function identity(env:ExecutorSettings,runId:string){return {backend:env.REVIEW_BACKEND,generation:env.REVIEW_GENERATION,artifactVersion,runId};}

// No token, source or verdict enters the task return value or an exception.
export async function executeReview(dispatchId:string,runId:string,env:ExecutorSettings,options:{broker?:Broker;model?:typeof verify;signal?:AbortSignal;heartbeatMs?:number}={}){
 const call=options.broker??brokerClient(env),model=options.model??verify;
 const controller=new AbortController();let abortCode:string|null=null,stage:ExecutorStage='claim';
 const abort=(code='EXECUTOR_ABORTED')=> { abortCode??=code;controller.abort(); };
 const onSignalAbort=()=>{abort();};options.signal?.addEventListener('abort',onSignalAbort,{once:true});
 const deadline=setTimeout(()=>{abort('EXECUTION_DEADLINE');},240000);
 if(options.signal?.aborted)abort();
 let ownerToken:string|null=null,timer:ReturnType<typeof setInterval>|undefined,pulse:Promise<void>|undefined;
 const cleanup:{confirmed:boolean}={confirmed:true};
 try{
  controller.signal.throwIfAborted();
  stage='claim';({ownerToken}=z.object({ownerToken:z.uuid().nullable()}).parse(await call(dispatchId,'claim',identity(env,runId))));
  if(!ownerToken)return {dispatchId,status:'ignored'};
  const owner={ownerToken};
  timer=setInterval(()=>{if(!pulse)pulse=call(dispatchId,'heartbeat',owner).then(()=>{}).catch(()=>{abort('HEARTBEAT_FAILED');}).finally(()=>{pulse=undefined;});},options.heartbeatMs??15000);
  stage='prepare';const prepared=await call(dispatchId,'prepare',owner);
  // Input comes only from the authenticated broker; result validation remains server-side.
  stage='prepare_response';const parsed=z.object({ready:z.boolean(),input:z.custom<VerifyInput>(v=>!!v&&typeof v==='object').optional()}).parse(prepared);
  if(!parsed.ready)return {dispatchId,status:'finished_without_inference'};
  if(!parsed.input)throw new Error('Missing review input');
  controller.signal.throwIfAborted();
  stage='begin';const grantRaw=await call(dispatchId,'begin',owner);
  stage='begin_response';const grant=z.object({credentials:z.record(z.string(),z.unknown()).nullable()}).parse(grantRaw);
  if(!grant.credentials)return {dispatchId,status:'finished_without_inference'};
  controller.signal.throwIfAborted();
  stage='sponsor_credentials';
  const credentials=parseCopilotEnv(Object.fromEntries(Object.entries(grant.credentials).map(([key,value])=>[key,String(value)])));
  stage='model';const rawOutput=await model(parsed.input,credentials,undefined,controller.signal,next=>{stage=next;});
  stage='model_output_validation';const output=reviewOutput.parse(rawOutput);
  // A lost save response can retry the identical output; never call the model again.
  stage='result_submission';
  for(let attempt=0;attempt<3;attempt++){
   try{await call(dispatchId,'complete',{...owner,output});return {dispatchId,status:'result_saved'};}
   catch{if(attempt===2)throw new ReviewBrokerFailure('RESULT_SUBMISSION_FAILED');}
  }
  return {dispatchId,status:'outcome_unknown'};
 }catch(error){cleanup.confirmed=!(error instanceof CopilotCleanupError);const failedStage=error instanceof CopilotDiagnosticError?error.diagnosticStage:error instanceof CopilotCleanupError?'copilot_runtime_shutdown':stage;const code=failureCode(error,failedStage,abortCode);logExecutorFailure(failedStage,code,error instanceof ReviewBrokerFailure?error.httpStatus:undefined);return {dispatchId,status:cleanup.confirmed?'stopped':'cleanup_unknown'};}
 finally{
  clearTimeout(deadline);if(timer)clearInterval(timer);await pulse;options.signal?.removeEventListener('abort',onSignalAbort);
  // A failed subprocess shutdown must retain admission until provider termination
  // or an operator confirms the dedicated process has actually exited.
  if(ownerToken&&cleanup.confirmed)await call(dispatchId,'stop',{ownerToken}).catch(()=>{logExecutorFailure('stop','BROKER_STOP_FAILED');});
 }
}
