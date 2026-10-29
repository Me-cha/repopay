import type { Express,Request,Response } from 'express';
import type { Database } from '../db/client.js';
import type { AuthEnv } from '../env.js';
import type { GitHub } from '../github/app.js';
import { AuthError,type AuthService } from '../github/oauth.js';
import { randomToken } from '../util/crypto.js';
import { checkCsrf,cookie,csrfFor,requireSession,setCookie } from './session.js';
export interface AuthenticationDependencies {database:Database;env:AuthEnv;auth:AuthService;github:GitHub}
export const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??''));
export const dollars=(value:number)=>`$${String(Math.floor(value/100))}.${String(value%100).padStart(2,'0')}`;
export function htmlPage(title:string,content:string):string {
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · GitPay</title><style>body{margin:0;background:#f5f6f8;color:#18202b;font:17px/1.6 system-ui,sans-serif}main{max-width:640px;margin:8vh auto;padding:32px;background:white;border:1px solid #d9dee5;border-radius:12px}h1{line-height:1.2;font-size:30px}a{color:#174ea6}button{font:inherit;font-weight:600;background:#174ea6;color:white;border:0;border-radius:6px;padding:12px 20px;cursor:pointer}a:focus-visible,button:focus-visible{outline:3px solid #b34c00;outline-offset:4px}.muted{color:#526070}dl{display:grid;grid-template-columns:1fr 2fr;gap:8px}dd{margin:0;overflow-wrap:anywhere}.brand{font-weight:700;letter-spacing:.04em}@media(max-width:700px){main{margin:20px;padding:24px}dl{display:block}dd{margin-bottom:14px}}</style><script src="/assets/actions.js" defer></script></head><body><main><a class="brand" href="/">GitPay</a><h1>${escapeHtml(title)}</h1>${content}<noscript><p>JavaScript is required to submit confirmation and sign-out forms securely. Read-only pages remain available.</p></noscript></main></body></html>`;
}
export function sensitiveHeaders(response:Response) {
 response.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});
}
export function safeError(response:Response,error:unknown,returnTo='/') {
 const status=error instanceof AuthError?error.status:503;
 response.status(status).type('html').send(htmlPage('Unable to continue',`<p role="alert">${escapeHtml(error instanceof AuthError?error.message:'The service is temporarily unavailable. Please try again.')}</p><p><a href="/login?returnTo=${encodeURIComponent(returnTo)}">Sign in again</a> · <a href="/">Return to GitPay</a></p>`));
}
export async function pageSession(deps:AuthenticationDependencies,request:Request,response:Response) {
 try{return await requireSession(deps.auth,request);}catch(error){if(error instanceof AuthError&&error.status===401){response.redirect(303,'/login?returnTo='+encodeURIComponent(request.originalUrl));return undefined;}throw error;}
}
export function mountAuth(app:Express,deps:AuthenticationDependencies) {
 const {env,auth}=deps;
 app.get('/login',async(request,response)=>{
  try{
   const returnTo=request.query.returnTo??'/';if(typeof returnTo!=='string')throw new AuthError(400,'Invalid return address.');
   const binding=randomToken();const url=await auth.beginLogin(returnTo,binding);
   setCookie(response,env,'gitpay_oauth',binding,env.OAUTH_STATE_TTL_SEC);response.redirect(303,url);
  }catch(error){safeError(response,error);}
 });
 app.get('/oauth/github/callback',async(request,response,next)=>{
  // Sponsor authorization shares the GitHub App's configured callback URL.
  // Let the sponsor route registered below validate its separate state and
  // browser binding instead of treating it as a normal GitPay login.
  if(cookie(request,'gitpay_sponsor_oauth')){next();return;}
  try{
   const {code,state}=request.query;const binding=cookie(request,'gitpay_oauth');
   if(typeof code!=='string'||typeof state!=='string'||!binding)throw new AuthError(400,'Invalid login callback. Start again.');
   const result=await auth.completeLogin(code,state,binding);
   // Rotate an existing local session only after successful authentication.
   const previous=cookie(request,'gitpay_session');if(previous){try{const old=await auth.requireLocalSession(previous);await auth.logout(old.id);}catch{/* Already invalid. */}}
   setCookie(response,env,'gitpay_session',result.cookie,env.SESSION_TTL_SEC);setCookie(response,env,'gitpay_oauth','',0);response.redirect(303,result.returnTo);
  }catch(error){setCookie(response,env,'gitpay_oauth','',0);safeError(response,error);}
 });
 app.get('/',async(request,response)=>{
  try{
   const session=await auth.requireLocalSession(cookie(request,'gitpay_session'));
   response.type('html').send(htmlPage('Signed in',`<p>Signed in as <strong>${escapeHtml(session.ghLogin)}</strong>.</p><p>Return to your GitHub issue and use <code>/bounty cancel</code> to request an unfunded draft cancellation.</p><form method="post" action="/logout"><input type="hidden" name="csrf" value="${csrfFor(session,'/logout')}"><button type="submit">Sign out</button></form>`));
  }catch(error){if(error instanceof AuthError&&error.status===401)response.type('html').send(htmlPage('Issue bounties on GitHub','<p>Sign in to review an action requested on your GitHub issue.</p><p><a href="/login">Sign in with GitHub</a></p>'));else safeError(response,error);}
 });
 app.post('/logout',async(request,response)=>{
  try{const session=await auth.requireLocalSession(cookie(request,'gitpay_session'));checkCsrf(request,env,session);await auth.logout(session.id);setCookie(response,env,'gitpay_session','',0);response.redirect(303,'/');}catch(error){safeError(response,error);}
 });
}
