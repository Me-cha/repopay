import { task,startTaskServer } from '@renderinc/sdk/workflows';
import { parseExecutorSettings } from './reviews/config.js';
import { executeReview,taskInput } from './reviews/executor.js';

task({name:'verifySubmission',retry:{maxRetries:0,waitDurationMs:1000},timeoutSeconds:300,plan:'flex'},async(ctx,input:unknown)=>{
 try{
  const env=parseExecutorSettings(process.env);
  if(env.REVIEW_BACKEND!=='render')throw new Error('Incorrect backend');
  const {dispatchId}=taskInput.parse(input),controller=new AbortController();
  const runId=ctx.metadata.taskRunId;if(!runId)throw new Error('Run identity required');
  const stop=()=> { controller.abort(); };process.once('SIGTERM',stop);process.once('SIGINT',stop);
  try{return await executeReview(dispatchId,runId,env,{signal:controller.signal});}
  finally{process.off('SIGTERM',stop);process.off('SIGINT',stop);}
 }catch{return {status:'configuration_or_input_rejected'};}
});
await startTaskServer();
