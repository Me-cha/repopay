import { z } from 'zod';
import { requestJson } from '../preflight/http.js';

export interface RenderTasks {start(task:string,dispatchId:string):Promise<string>;status(runId:string):Promise<string>}
export async function readRenderRun(apiKey:string,runId:string){
 const r=await requestJson({PROVIDER_TIMEOUT_MS:10000,PROVIDER_RESPONSE_MAX_BYTES:65536},`https://api.render.com/v1/task-runs/${encodeURIComponent(runId)}`,{headers:{authorization:`Bearer ${apiKey}`}});
 if(r.status!==200)throw new Error('Render reconciliation unavailable');
 return z.object({id:z.literal(runId),status:z.enum(['pending','running','completed','succeeded','failed','canceled','paused']),input:z.unknown()}).parse(r.body);
}
// API shapes verified against @renderinc/sdk 1.7.0 generated schema. Bounded
// transport is used because getTaskRun in that SDK has no AbortSignal parameter.
export function renderTasks(apiKey:string):RenderTasks{
 const headers={authorization:`Bearer ${apiKey}`,'content-type':'application/json'};
 const limits={PROVIDER_TIMEOUT_MS:10000,PROVIDER_RESPONSE_MAX_BYTES:65536};
 return {
  async start(task,dispatchId){
   const r=await requestJson(limits,'https://api.render.com/v1/task-runs',{method:'POST',headers,body:JSON.stringify({task,input:[{dispatchId}],idempotencyKey:dispatchId})});
   if(r.status!==202&&r.status!==200)throw new Error('Render launch outcome unresolved');
   return z.object({id:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)}).parse(r.body).id;
  },
  async status(runId){
   return (await readRenderRun(apiKey,runId)).status;
  },
 };
}
