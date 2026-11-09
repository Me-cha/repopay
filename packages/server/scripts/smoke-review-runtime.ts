import { createServer } from 'node:http';
import { mkdtemp,rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { z } from 'zod';

// Exercises the real compiled task entrypoint and pinned SDK registration
// protocol against a local Render-daemon stand-in. No provider or model call.
const directory=await mkdtemp('/tmp/repopay-render-'),socket=directory+'/runtime.sock';
let registration:unknown,registrations=0;
const server=createServer((req,res)=>{
 const chunks:Buffer[]=[];
 req.on('data',(chunk:Buffer)=>chunks.push(chunk));
 req.on('end',()=>{
  if(req.url!=='/register-tasks'||req.method!=='POST'){res.writeHead(404);res.end('{}');return;}
  try{registrations++;registration=JSON.parse(Buffer.concat(chunks).toString('utf8'));res.end('{}');}
  catch{res.writeHead(400);res.end('{}');}
 });
});
try{
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(socket,resolve);});
 const child=spawn(process.execPath,['packages/server/dist/review-workflow.js'],{env:{PATH:process.env.PATH,RENDER_SDK_MODE:'register',RENDER_SDK_SOCKET_PATH:socket},stdio:'ignore'});
 const timer=setTimeout(()=>{child.kill('SIGKILL');},10000);
 const code=await new Promise<number|null>((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);}).finally(()=> { clearTimeout(timer); });
 if(code!==0)throw new Error('Runtime process failed');
 if(registrations!==1)throw new Error('Runtime started more than once');
 const parsed=z.object({tasks:z.array(z.object({name:z.string(),options:z.record(z.string(),z.unknown())}))}).parse(registration);
 if(parsed.tasks.length!==1||parsed.tasks[0]?.name!=='verifySubmission')throw new Error('Task registration mismatch');
 z.object({retry:z.object({max_retries:z.literal(0),wait_duration_ms:z.literal(1000)}),timeout_seconds:z.literal(300),plan:z.literal('flex')}).parse(parsed.tasks[0].options);
 console.log(JSON.stringify({status:'registered_locally',...parsed},null,2));
}catch{console.error('Local Render task registration smoke failed');process.exitCode=1;}
finally{await new Promise<void>(resolve=>server.close(()=>{resolve();}));await rm(directory,{recursive:true,force:true});}
