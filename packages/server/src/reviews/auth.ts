import { createHmac,timingSafeEqual } from 'node:crypto';

export function executorSignature(key:string,path:string,timestamp:string,body:string){
 return createHmac('sha256',Buffer.from(key,'base64')).update(`POST\n${path}\n${timestamp}\n${body}`).digest('hex');
}
export function authenticateExecutor(key:string,path:string,timestamp:string|undefined,signature:string|undefined,body:string){
 if(!timestamp||!signature||!/^\d{13}$/.test(timestamp)||! /^[a-f0-9]{64}$/.test(signature)||Math.abs(Date.now()-Number(timestamp))>60000)return false;
 const expected=Buffer.from(executorSignature(key,path,timestamp,body),'hex'),actual=Buffer.from(signature,'hex');
 return actual.length===expected.length&&timingSafeEqual(expected,actual);
}
