import type { Request,Response } from 'express';
import type { AuthEnv } from '../env.js';
import { AuthError,type AuthService,type LocalSession } from '../github/oauth.js';
import { equalSecret,mac } from '../util/crypto.js';
export function cookie(request:Request,name:string):string|undefined {
 const values=(request.headers.cookie??'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(name+'='));
 if(values.length!==1)return undefined;return values[0]?.slice(name.length+1);
}
export function setCookie(response:Response,env:AuthEnv,name:string,value:string,maxAge:number) {
 response.appendHeader('Set-Cookie',`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${String(maxAge)}${new URL(env.PUBLIC_URL).protocol==='https:'?'; Secure':''}`);
}
export const requireSession=(auth:AuthService,request:Request)=>auth.requireSession(cookie(request,'repopay_session'));
export const csrfFor=(session:LocalSession,path:string)=>mac(session.csrfSecret,session.id+':POST:'+path);
export function checkCsrf(request:Request,env:AuthEnv,session:LocalSession) {
 const body:unknown=request.body;
 const csrf=typeof body==='object'&&body!==null&&'csrf' in body?body.csrf:undefined;
 const origin=request.get('origin');
 const publicOrigin=new URL(env.PUBLIC_URL).origin;
 const isOriginAllowed=origin===publicOrigin||origin===`http://localhost:${String(env.PORT)}`||origin===`http://127.0.0.1:${String(env.PORT)}`;
 if(!isOriginAllowed||typeof csrf!=='string'||!equalSecret(csrf,csrfFor(session,request.path)))throw new AuthError(403,'This request could not be verified. Reload the page and try again.');
}
