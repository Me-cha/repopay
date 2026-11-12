import { randomUUID } from 'node:crypto';
import { expect,it,vi } from 'vitest';
import { executeReview,identity,type Broker } from '../../src/reviews/executor.js';
import { authenticateExecutor,executorSignature } from '../../src/reviews/auth.js';
import { parseExecutorSettings,parseReviewSettings,artifactVersion } from '../../src/reviews/config.js';
import { CopilotCleanupError,CopilotDiagnosticError } from '../../src/models/copilot.js';
import type { verify } from '../../src/verifier/verify.js';

const settings={REVIEW_BACKEND:'dedicated',REVIEW_GENERATION:'1',PUBLIC_URL:'http://127.0.0.1:3000',REVIEW_EXECUTOR_KEY:Buffer.alloc(32,3).toString('base64')};
const env=parseExecutorSettings(settings);
it('rejects broad executor credentials and unversioned Render tasks',()=>{
 for(const name of ['DATABASE_URL','PP_SECRET','TOKEN_ENC_KEY','RENDER_API_KEY','COPILOT_GITHUB_TOKEN'])expect(()=>parseExecutorSettings({...settings,[name]:'sensitive'})).toThrow('forbidden');
 expect(()=>parseExecutorSettings({...settings,PUBLIC_URL:'https://user:password@host.test'})).toThrow();
 expect(()=>parseExecutorSettings({...settings,REVIEW_BROKER_URL:'https://host.test'})).toThrow('PUBLIC_URL');
 expect(()=>parseReviewSettings({REVIEW_BACKEND:'render',REVIEW_EXECUTOR_KEY:settings.REVIEW_EXECUTOR_KEY,RENDER_API_KEY:'r'.repeat(25),RENDER_REVIEW_TASK:'review/verifySubmission'})).toThrow();
 expect(identity(env,'run')).toMatchObject({artifactVersion});
});
it('authenticates exact method/path/body/time and rejects stale or altered requests',()=>{
 const path='/internal/reviews/id/claim',time=String(Date.now()),body='{}',sig=executorSignature(settings.REVIEW_EXECUTOR_KEY,path,time,body);
 expect(authenticateExecutor(settings.REVIEW_EXECUTOR_KEY,path,time,sig,body)).toBe(true);
 expect(authenticateExecutor(settings.REVIEW_EXECUTOR_KEY,path+'/other',time,sig,body)).toBe(false);
 expect(authenticateExecutor(settings.REVIEW_EXECUTOR_KEY,path,time,sig,'{"other":1}')).toBe(false);
 expect(authenticateExecutor(settings.REVIEW_EXECUTOR_KEY,path,String(Date.now()-61000),sig,body)).toBe(false);
});
it.each(['grant_response_lost','model_error','cleanup_unknown','unclaimed'] as const)('never repeats inference after %s',async failure=>{
 const operations:string[]=[],ownerToken=randomUUID();
 const call:Broker=(_id,operation)=>Promise.resolve().then(()=>{
  operations.push(operation);
  if(operation==='claim')return {ownerToken:failure==='unclaimed'?null:ownerToken};
  if(operation==='prepare')return {ready:true,input:{}};
  if(operation==='begin'){
   if(failure==='grant_response_lost')throw new Error('lost');
   return {credentials:{COPILOT_GITHUB_TOKEN:'ghu_test',COPILOT_BILLING_OWNER_ID:'4',COPILOT_AUTH_KIND:'user',COPILOT_MODEL:'auto',PROVIDER_RESPONSE_MAX_BYTES:10000}};
  }
  return {};
 });
 const model=vi.fn<typeof verify>(()=>Promise.reject(failure==='cleanup_unknown'?new CopilotCleanupError('unconfirmed'):new Error('provider details')));
 const result=await executeReview(randomUUID(),'run',env,{broker:call,model});
 expect(model).toHaveBeenCalledTimes(['model_error','cleanup_unknown'].includes(failure)?1:0);
 expect(operations.filter(op=>op==='begin').length).toBeLessThanOrEqual(1);
 expect(operations.includes('stop')).toBe(!['cleanup_unknown','unclaimed'].includes(failure));
 expect(JSON.stringify(result)).not.toContain('provider details');
});
it('logs only a safe SDK stage and code when execution stops',async()=>{
 const ownerToken=randomUUID();
 const call:Broker=(_id,operation)=>Promise.resolve(operation==='claim'?{ownerToken}:operation==='prepare'?{ready:true,input:{}}:operation==='begin'?{credentials:{COPILOT_GITHUB_TOKEN:'ghu_test',COPILOT_BILLING_OWNER_ID:'4',COPILOT_AUTH_KIND:'user',COPILOT_MODEL:'auto',PROVIDER_RESPONSE_MAX_BYTES:10000}}:{});
 const model=vi.fn<typeof verify>((_input,_credentials,_factory,_signal,onStage)=>{onStage?.('copilot_sdk_startup');return Promise.reject(new CopilotDiagnosticError('private token and prompt details','copilot_sdk_startup','COPILOT_SDK_ERROR'));});
 const log=vi.spyOn(console,'error').mockImplementation(()=>{});
 try{
  const result=await executeReview(randomUUID(),'run',env,{broker:call,model});
  expect(result.status).toBe('stopped');
  expect(log).toHaveBeenCalledTimes(1);
  const diagnostic=JSON.parse(String(log.mock.calls[0]?.[0])) as unknown;
  expect(diagnostic).toMatchObject({event:'review_executor_stopped',stage:'copilot_sdk_startup',code:'COPILOT_SDK_ERROR'});
  expect(JSON.stringify(diagnostic)).not.toContain('private token');
  expect(JSON.stringify(diagnostic)).not.toContain('prompt details');
 }finally{log.mockRestore();}
});
it('logs the allowlisted broker code without its response body',async()=>{
 const fetch=vi.fn<typeof globalThis.fetch>(()=>Promise.resolve(new Response(JSON.stringify({error:'private token details',code:'SPONSOR_AUTH_REJECTED'}),{status:409,headers:{'content-type':'application/json'}})));
 vi.stubGlobal('fetch',fetch);const log=vi.spyOn(console,'error').mockImplementation(()=>{});
 try{
  const result=await executeReview(randomUUID(),'run',env);
  expect(result.status).toBe('stopped');
  const diagnostic=JSON.parse(String(log.mock.calls[0]?.[0])) as unknown;
  expect(diagnostic).toMatchObject({event:'review_executor_stopped',stage:'claim',code:'SPONSOR_AUTH_REJECTED',httpStatus:409});
  expect(JSON.stringify(diagnostic)).not.toContain('private token details');
 }finally{log.mockRestore();vi.unstubAllGlobals();}
});
