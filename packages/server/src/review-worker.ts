import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { z } from 'zod';
import { parseExecutorSettings } from './reviews/config.js';
import { brokerClient,executeReview,identity } from './reviews/executor.js';

try{
 const env=parseExecutorSettings(process.env);if(env.REVIEW_BACKEND!=='dedicated')throw new Error('Dedicated backend required');
 const controller=new AbortController(),stop=()=> { controller.abort(); };process.once('SIGTERM',stop);process.once('SIGINT',stop);
 const broker=brokerClient(env);
 const loop=async()=>{while(!controller.signal.aborted){
  try{
   const runId=randomUUID(),next=z.object({dispatchId:z.uuid().nullable()}).parse(await broker('queue','next',identity(env,runId)));
   if(next.dispatchId){const result=await executeReview(next.dispatchId,runId,env,{broker,signal:controller.signal});if(result.status==='cleanup_unknown'){controller.abort();process.exitCode=1;}}
  }catch{ /* Provider failures retain durable state. Never print SDK/token errors. */ }
  await setTimeout(1000,undefined,{signal:controller.signal}).catch(()=>{});
 }};
 await Promise.all([loop(),loop()]);
 process.off('SIGTERM',stop);process.off('SIGINT',stop);
}catch{console.error('Isolated review worker configuration failed');process.exitCode=1;}
