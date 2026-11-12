import { expect,it,vi } from 'vitest';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { completeCopilot,listCopilotModels,CopilotDiagnosticError,type CopilotRuntime,type RuntimeFactory } from '../../src/models/copilot.js';
import { parseCopilotEnv } from '../../src/env.js';
const input={COPILOT_GITHUB_TOKEN:'ghu_synthetic',COPILOT_BILLING_OWNER_ID:'4',COPILOT_AUTH_KIND:'user',COPILOT_MODEL:'test-model',COPILOT_TIMEOUT_MS:'1000',COPILOT_SHUTDOWN_TIMEOUT_MS:'100',COPILOT_MAX_INPUT_BYTES:'1000',PROVIDER_RESPONSE_MAX_BYTES:'1000'};
const config=()=>parseCopilotEnv(input);
const schema=z.object({verdict:z.enum(['RESOLVES','DOES_NOT_RESOLVE'])}).strict();
function fixture() {
 const session={sessionId:'session',send:vi.fn(()=>Promise.resolve<unknown>({verdict:'RESOLVES'})),getModel:vi.fn(()=>Promise.resolve('test-model')),getUsage:vi.fn(()=>Promise.resolve({totalNanoAiu:125000000,totalPremiumRequestCost:0.25,totalApiDurationMs:850,totalUserRequests:1,lastCallInputTokens:120,lastCallOutputTokens:45,modelMetrics:{'test-model':{usage:{inputTokens:120,outputTokens:45,cacheReadTokens:0,cacheWriteTokens:0}}}})),abort:vi.fn(()=>Promise.resolve())};
 const client:CopilotRuntime={start:vi.fn(()=>Promise.resolve()),listModels:vi.fn(()=>Promise.resolve([{id:'test-model'}])),createSession:vi.fn(()=>Promise.resolve(session)),forceStop:vi.fn(()=>Promise.resolve())};
 const factory=vi.fn<RuntimeFactory>(()=>client);return {client,session,factory};
}
it('uses explicit sponsored identity in an isolated tool-free runtime and returns validated output',async()=>{
 const f=fixture();const result=await completeCopilot(config(),'saved evidence',schema,f.factory);
 expect(result.value).toEqual({verdict:'RESOLVES'});expect(result.provider).toBe('copilot');expect(result.billingOwnerId).toBe('4');
 expect(result.usage).toEqual({totalNanoAiu:125000000,totalPremiumRequestCost:0.25,totalApiDurationMs:850,totalUserRequests:1,inputTokens:120,outputTokens:45,cacheReadTokens:0,cacheWriteTokens:0});
 const options=f.factory.mock.calls[0]?.[0];expect(options).toMatchObject({mode:'empty',useLoggedInUser:false,gitHubToken:input.COPILOT_GITHUB_TOKEN,logLevel:'none'});
 expect(options?.env).not.toHaveProperty('PP_SECRET');expect(options?.env).not.toHaveProperty('GH_PRIVATE_KEY');expect(options?.env).not.toHaveProperty('GITHUB_TOKEN');
 const session=vi.mocked(f.client.createSession).mock.calls[0]?.[0];expect(session).toMatchObject({availableTools:[],enableSkills:false,enableConfigDiscovery:false,enableHostGitOperations:false});
 expect(session?.excludedTools).toEqual(['builtin:*','mcp:*','custom:*']);
 expect(session?.onPermissionRequest?.({kind:'shell',canOfferSessionApproval:false,commands:[],fullCommandText:'echo test',hasWriteFileRedirection:false,intention:'test',possiblePaths:[],possibleUrls:[]},{sessionId:'session'})).toMatchObject({kind:'reject'});
 expect(f.client.forceStop).toHaveBeenCalled();expect(existsSync(options?.workingDirectory??'missing')).toBe(false);
});
it.each([{bad:'shape'},'not JSON',undefined])('rejects malformed output %j without fallback',async value=>{
 const f=fixture();f.session.send.mockResolvedValue(value);await expect(completeCopilot(config(),'evidence',schema,f.factory)).rejects.toThrow(/Copilot/);expect(f.session.send).toHaveBeenCalledTimes(1);expect(f.client.forceStop).toHaveBeenCalled();
});
it('accepts a valid negative decision without retry and refuses an unavailable or changed model',async()=>{
 const f=fixture();f.session.send.mockResolvedValue({verdict:'DOES_NOT_RESOLVE'});expect((await completeCopilot(config(),'evidence',schema,f.factory)).value.verdict).toBe('DOES_NOT_RESOLVE');
 vi.mocked(f.client.listModels).mockResolvedValue([]);await expect(completeCopilot(config(),'evidence',schema,f.factory)).rejects.toThrow(/available/);
 vi.mocked(f.client.listModels).mockResolvedValue([{id:'test-model'}]);f.session.getModel.mockResolvedValue('other');await expect(completeCopilot(config(),'evidence',schema,f.factory)).rejects.toThrow(/model/);
});
it('bounds output/input and redacts provider failures',async()=>{
 const f=fixture();await expect(completeCopilot(config(),'x'.repeat(1001),schema,f.factory)).rejects.toThrow(/input/);expect(f.factory).not.toHaveBeenCalled();
 f.session.send.mockRejectedValue(new Error('private-token-private-code'));await expect(completeCopilot(config(),'evidence',schema,f.factory)).rejects.toThrow('Copilot request failed');
 f.session.send.mockResolvedValue({verdict:'RESOLVES',extra:'x'.repeat(1001)});await expect(completeCopilot(config(),'evidence',schema,f.factory)).rejects.toThrow(/limit/);
});
it('preserves only a safe SDK stage and code for startup failures',async()=>{
 const f=fixture();vi.mocked(f.client.start).mockRejectedValue(new Error('private runtime token'));
 let failure:unknown;try{await completeCopilot(config(),'evidence',schema,f.factory);}catch(error){failure=error;}
 expect(failure).toBeInstanceOf(CopilotDiagnosticError);
 expect(failure).toMatchObject({diagnosticStage:'copilot_sdk_startup',diagnosticCode:'COPILOT_SDK_ERROR'});
 expect((failure as Error).message).not.toContain('private runtime token');
});
it('deadline aborts the session and stops the runtime instead of merely stopping the wait',async()=>{
 const f=fixture();f.session.send.mockImplementation(()=>new Promise(()=>{}));
 await expect(completeCopilot({...config(),COPILOT_TIMEOUT_MS:20},'evidence',schema,f.factory)).rejects.toThrow(/timed out/);
 expect(f.session.abort).toHaveBeenCalled();expect(f.client.forceStop).toHaveBeenCalledTimes(1);
});
it('lost review ownership aborts an active SDK request and cleans its subprocess',async()=>{
 const f=fixture(),controller=new AbortController();
 f.session.send.mockImplementation(()=>{controller.abort();return new Promise(()=>{});});
 await expect(completeCopilot(config(),'evidence',schema,f.factory,controller.signal)).rejects.toThrow(/stopped/);
 expect(f.session.abort).toHaveBeenCalled();expect(f.client.forceStop).toHaveBeenCalledTimes(1);
 expect(existsSync(f.factory.mock.calls[0]?.[0].workingDirectory??'missing')).toBe(false);
});
it('listing is read-only and missing explicit sponsor cannot fall back to CLI credentials',async()=>{
 const f=fixture();expect(await listCopilotModels(config(),f.factory)).toEqual([{model:'test-model',listed:true}]);expect(f.client.createSession).not.toHaveBeenCalled();
 expect(()=>parseCopilotEnv({...input,COPILOT_GITHUB_TOKEN:''})).toThrow(/COPILOT_GITHUB_TOKEN/);
 expect(parseCopilotEnv({...input,COPILOT_MODEL:'AUTO'}).COPILOT_MODEL).toBe('auto');
 expect(()=>parseCopilotEnv({...input,COPILOT_AUTH_KIND:'organization'})).toThrow();
});

it('bounds startup and shutdown, and does not return a result when cleanup fails',async()=>{
 const f=fixture();vi.mocked(f.client.start).mockImplementation(()=>new Promise(()=>{}));
 await expect(completeCopilot({...config(),COPILOT_TIMEOUT_MS:20},'evidence',schema,f.factory)).rejects.toThrow(/timed out/);
 expect(f.client.createSession).not.toHaveBeenCalled();expect(f.client.forceStop).toHaveBeenCalled();
 const g=fixture();vi.mocked(g.client.forceStop).mockImplementation(()=>new Promise(()=>{}));
 await expect(completeCopilot({...config(),COPILOT_SHUTDOWN_TIMEOUT_MS:20},'evidence',schema,g.factory)).rejects.toThrow(/shutdown/);
});
it('rejects streaming overflow and mid-request model switching',async()=>{
 for (const type of ['assistant.message_delta','session.model_change'] as const) {
  const f=fixture();f.session.send.mockImplementation(()=>{
   const event=type==='assistant.message_delta'
    ? {type,data:{deltaContent:'x'.repeat(1001),messageId:'m'},id:'event',timestamp:'now',parentId:null,ephemeral:true as const}
    : {type,data:{newModel:'other'},id:'event',timestamp:'now',parentId:null};
   vi.mocked(f.client.createSession).mock.calls[0]?.[0].onEvent?.(event);
   return new Promise(()=>{});
  });
  await expect(completeCopilot(config(),'evidence',schema,f.factory)).rejects.toThrow(/limit|model changed/);
  expect(f.session.abort).toHaveBeenCalled();expect(f.client.forceStop).toHaveBeenCalled();
 }
});
it('lists available models before choosing one, but refuses generation without a fixed model',async()=>{
 const f=fixture();const env=parseCopilotEnv({...input,COPILOT_MODEL:''});
 expect(await listCopilotModels(env,f.factory)).toEqual([{model:'test-model',listed:true}]);
 await expect(completeCopilot(env,'evidence',schema,f.factory)).rejects.toThrow(/explicit model/);
});
const usageEvent=(model:string)=>({type:'assistant.usage' as const,data:{model,inputTokens:120,outputTokens:45},id:'usage',timestamp:'now',parentId:null,ephemeral:true as const});
function autoFixture(models:string[]) {
 const f=fixture();vi.mocked(f.client.listModels).mockResolvedValue([]);f.session.getModel.mockResolvedValue('auto');
 f.session.send.mockImplementation(()=>{for(const model of models)vi.mocked(f.client.createSession).mock.calls[0]?.[0].onEvent?.(usageEvent(model));return Promise.resolve({verdict:'RESOLVES'});});
 return f;
}
it('Auto requests auto despite an empty Free catalog and records the model Copilot actually served',async()=>{
 const f=autoFixture(['gpt-6-luna']);
 const result=await completeCopilot(parseCopilotEnv({...input,COPILOT_MODEL:'auto'}),'evidence',schema,f.factory);
 expect(vi.mocked(f.client.createSession).mock.calls[0]?.[0].model).toBe('auto');
 expect(result).toMatchObject({value:{verdict:'RESOLVES'},requestedModel:'auto',model:'gpt-6-luna'});
});
it.each([[[]],[['auto']],[['gpt-6-luna','gpt-6-astra']]])('Auto refuses a result whose serving model cannot be established %j',async models=>{
 const f=autoFixture(models);
 await expect(completeCopilot(parseCopilotEnv({...input,COPILOT_MODEL:'auto'}),'evidence',schema,f.factory)).rejects.toThrow(/provenance/);
 expect(f.client.forceStop).toHaveBeenCalled();
});
it('treats an authenticated but empty model catalog as unavailable, not a passing preflight',async()=>{
 const f=fixture();vi.mocked(f.client.listModels).mockResolvedValue([]);
 await expect(listCopilotModels(parseCopilotEnv({...input,COPILOT_MODEL:''}),f.factory)).rejects.toThrow(/no accessible models/);
 expect(f.client.createSession).not.toHaveBeenCalled();expect(f.client.forceStop).toHaveBeenCalled();
});
