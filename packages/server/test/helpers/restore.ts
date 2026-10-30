import { spawn } from 'node:child_process';
import { validateTestDatabaseUrl } from './database.js';
// Only the isolated local *_test database. Uses matching PostgreSQL 16 clients.
export async function restoreTool(tool:'pg_dump'|'psql',schemaName:string,input?:Buffer):Promise<Buffer>{
 if(!/^test_[a-f0-9]{32}$/.test(schemaName))throw new Error('Refusing non-test schema');
 const url=new URL(validateTestDatabaseUrl(process.env.TEST_DATABASE_URL));
 const connection=['-U',decodeURIComponent(url.username),'-d',url.pathname.slice(1)];
 const base=process.env.CI?['run','--rm','-i','--network','host','-e','PGPASSWORD','postgres:16.13-alpine',tool,'-h',url.hostname,'-p',url.port||'5432']:['compose','exec','-T','postgres',tool];
 const args=[...base,...connection,...(tool==='pg_dump'?['--schema',schemaName,'--no-owner','--no-privileges']:['-v','ON_ERROR_STOP=1'])];
 return new Promise((resolve,reject)=>{const child=spawn('docker',args,{env:{...process.env,PGPASSWORD:decodeURIComponent(url.password)},stdio:['pipe','pipe','pipe']});const chunks:Buffer[]=[];let bytes=0;child.stdout.on('data',(b:Buffer)=>{bytes+=b.length;if(bytes>16000000){child.kill();reject(new Error('Test dump exceeded bound'));}else chunks.push(b);});child.stderr.resume();child.on('error',()=> { reject(new Error('Local PostgreSQL restore tool unavailable')); });child.on('exit',code=>{if(code===0)resolve(Buffer.concat(chunks));else reject(new Error('Local PostgreSQL restore tool failed'));});child.stdin.end(input);});
}
