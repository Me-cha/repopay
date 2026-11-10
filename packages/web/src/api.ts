import { z } from 'zod';
import { bountyPageSchema,connectStatusSchema,detailSchema,meSchema,payoutPageSchema } from '../../server/src/read-models/contracts.js';
export type { BountyDto,ConnectStatusDto,DetailDto,PayoutDto,ReviewDto } from '../../server/src/read-models/contracts.js';
export class ReadError extends Error {
 constructor(readonly status:number,customMessage?:string){
  super(customMessage??(status===401?'Your session expired. Sign in again.':status===403?'Repository access was removed. Sign in with an account that has access.':'Unable to verify current access or load data. Retry when the connection is available.'));
 }
}
async function get<T extends z.ZodType>(path:string,schema:T,signal?:AbortSignal):Promise<z.output<T>>{
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...(signal?{signal}:{})});
 if(!response.ok){
  let msg:string|undefined;
  try{const body:unknown=await response.json();if(body&&typeof body==='object'&&'error' in body&&typeof body.error==='string')msg=body.error;}catch{/* ignore */}
  throw new ReadError(response.status,msg);
 }
 return schema.parse(await response.json());
}
async function postForm<T extends z.ZodType>(path:string,params:Record<string,string>,schema:T):Promise<z.output<T>>{
 const response=await fetch(path,{
  method:'POST',
  mode:'cors',
  credentials:'same-origin',
  cache:'no-store',
  referrerPolicy:'no-referrer',
  headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams(params).toString(),
 });
 if(!response.ok){
  let msg:string|undefined;
  try{const body:unknown=await response.json();if(body&&typeof body==='object'&&'error' in body&&typeof body.error==='string')msg=body.error;}catch{/* ignore */}
  throw new ReadError(response.status,msg);
 }
 return schema.parse(await response.json());
}
export const api={
 dashboardTour:()=>get('/api/onboarding/dashboard',z.object({seen:z.boolean(),csrf:z.string()})),
 claimDashboardTour:(csrf:string)=>postForm('/api/onboarding/dashboard',{csrf},z.object({show:z.boolean()})),
 me:(signal?:AbortSignal)=>get('/api/me',meSchema,signal),
 bounties:(cursor='0',signal?:AbortSignal)=>get('/api/bounties?cursor='+encodeURIComponent(cursor),bountyPageSchema,signal),
 payouts:(cursor='0',signal?:AbortSignal)=>get('/api/payouts?cursor='+encodeURIComponent(cursor),payoutPageSchema,signal),
 detail:(id:string,signal?:AbortSignal,before?:string)=>get('/api/bounties/'+encodeURIComponent(id)+(before?'?before='+encodeURIComponent(before):''),detailSchema,signal),
 connectStatus:(signal?:AbortSignal)=>get('/api/connect',connectStatusSchema,signal),
 updateConnect:(paypalEmail:string,csrf:string)=>postForm('/api/connect',{paypalEmail,csrf},connectStatusSchema),
};
export const money=(cents:number,currency='USD')=>currency==='PYUSD'?`${(cents/100).toFixed(2)} PYUSD`:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
export const label=(value:string)=>value.replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase());
export const formatTimeIST=(date:Date|string|number=new Date())=>{
 const d=typeof date==='string'||typeof date==='number'?new Date(date):date;
 return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}).format(d)+' IST';
};
export const formatDateIST=(date:Date|string|number)=>{
 const d=typeof date==='string'||typeof date==='number'?new Date(date):date;
 return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric'}).format(d);
};
export const formatDateTimeIST=(date:Date|string|number|null|undefined)=>{
 if(!date)return '—';
 const d=typeof date==='string'||typeof date==='number'?new Date(date):date;
 if(isNaN(d.getTime()))return String(date);
 return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(d)+' IST';
};
export function subscribe(refresh:()=>void,invalidate:()=>void,heartbeatMs:number){
 const source=new EventSource('/api/stream');
 source.addEventListener('open',refresh);source.addEventListener('invalidate',refresh);source.addEventListener('refresh',refresh);
 const lost=()=>{invalidate();source.close();};source.addEventListener('access-lost',lost);
 // Fail closed on errors; native EventSource reconnects transient failures. The
 // periodic/focus refetch still restores state if the stream stays unavailable.
 source.addEventListener('error',()=>{invalidate();});
 const focus=()=>{if(document.visibilityState==='visible')refresh();};
 window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
 const timer=window.setInterval(focus,heartbeatMs);
 return ()=>{source.close();clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};
}
