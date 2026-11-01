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
export const formatIST=(d:Date|string|null|undefined):string=>{if(!d)return '—';const date=typeof d==='string'?new Date(d):d;if(isNaN(date.getTime()))return String(d);return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(date)+' IST';};
export function htmlPage(title:string,content:string):string {
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · GitPay</title><style>
:root{--bg:#f8f9fa;--surface:#ffffff;--text:#1a1a1a;--muted:#57606a;--line:#eaedf0;--border:#d4d8de;--accent:#0070ba;--escrow:#003087;--pass:#116329;--pass-bg:#dafbe1;--danger:#cf222e;--danger-bg:#ffebe9;--warn:#9a6700;--warn-bg:#fff8c5}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.6 'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:720px;margin:32px auto;padding:28px 32px;background:var(--surface);border:1px solid var(--line);border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.02)}
header.page-nav{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:20px;font-size:13px}
h1{font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-0.02em;margin:12px 0 16px}
h2{font-size:15px;line-height:1.4;font-weight:600;letter-spacing:-0.01em;margin:24px 0 10px}
h3{font-size:14px;font-weight:600;margin:16px 0 8px}
a{color:var(--accent);text-decoration:none;text-underline-offset:2px}
a:hover{text-decoration:underline}
button{font:inherit;font-size:13px;font-weight:600;background:#111418;color:white;border:1px solid #111418;border-radius:6px;padding:8px 16px;cursor:pointer;min-height:38px;transition:background 0.12s}
button:hover{background:#24292f}
.btn-outline{background:var(--surface);color:var(--text);border:1px solid var(--border)}
.btn-outline:hover{background:var(--bg)}
.btn-danger{background:var(--surface);color:var(--danger);border:1px solid var(--danger)}
.btn-danger:hover{background:var(--danger-bg)}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
input:not([type=checkbox]):not([type=hidden]),select,textarea{display:block;width:100%;box-sizing:border-box;font:inherit;font-size:13px;border:1px solid var(--border);border-radius:6px;padding:8px 10px;min-height:38px;background:var(--surface);color:var(--text);margin-top:4px}
input:focus,select:focus,textarea:focus{border-color:var(--accent)}
textarea{min-height:90px;font-family:inherit}
form{margin:16px 0}
label{display:block;margin:12px 0;font-size:13px;font-weight:500;color:var(--text)}
p,li{overflow-wrap:anywhere}
.muted{color:var(--muted);font-size:13px}
.brand{font-weight:600;letter-spacing:-0.01em;color:var(--text)}
.chip{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;padding:2px 8px;border-radius:100px;border:1px solid var(--border);background:#f3f4f6;color:var(--muted);font-family:'Geist Mono',ui-monospace,SFMono-Regular,monospace}
.chip-pass{background:var(--pass-bg);color:var(--pass);border-color:#aceebb}
.chip-fail,.chip-danger{background:var(--danger-bg);color:var(--danger);border-color:#ffc1ba}
.chip-pending,.chip-warn{background:var(--warn-bg);color:var(--warn);border-color:#fae17d}
.chip-info{background:#ddf4ff;color:var(--accent);border-color:#b6e3ff}
.kv-grid{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13px;padding:12px 14px;background:var(--bg);border:1px solid var(--line);border-radius:6px;margin:12px 0}
.kv-grid dt{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:0.04em;font-weight:600;display:flex;align-items:center}
.kv-grid dd{margin:0;font-family:'Geist Mono',ui-monospace,SFMono-Regular,monospace;font-size:13px;word-break:break-word}
.split-bar{display:flex;height:6px;border-radius:3px;overflow:hidden;margin:8px 0;background:var(--line)}
.split-bar-a{background:var(--escrow)}
.split-bar-b{background:var(--accent)}
.notice-banner{padding:12px 14px;border-radius:6px;font-size:13px;margin:12px 0;border:1px solid var(--line)}
.notice-banner.info{background:#ddf4ff;border-left:3px solid #0969da;color:#0550ae}
.notice-banner.warn{background:var(--warn-bg);border-left:3px solid var(--warn);color:#6c5400}
.notice-banner.danger{background:var(--danger-bg);border-left:3px solid var(--danger);color:var(--danger)}
.criteria-box{background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:12px 14px;font-family:'Geist Mono',ui-monospace,monospace;font-size:12.5px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0}
@media(max-width:700px){main{margin:12px;padding:20px}.kv-grid{display:block}.kv-grid dd{margin-bottom:10px}}
</style><script src="/assets/actions.js" defer></script></head><body><main><header class="page-nav"><a class="brand" href="/">GitPay <span class="chip" style="font-size:10px;padding:1px 6px">SANDBOX</span></a><nav><a href="/dashboard/">Overview</a> · <a href="/connect">Payouts</a></nav></header><h1>${escapeHtml(title)}</h1>${content}<noscript><p>JavaScript is required to submit confirmation and sign-out forms securely. Read-only pages remain available.</p></noscript></main></body></html>`;
}
export function sensitiveHeaders(response:Response) {
 response.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});
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
   response.type('html').send(htmlPage('Account Session',`<div class="kv-grid"><dt>GitHub Account</dt><dd><strong>@${escapeHtml(session.ghLogin)}</strong> <span class="chip chip-pass">Signed in</span></dd></div><p><a href="/dashboard/">View bounties and payment progress →</a></p><p><a href="/connect">Connect payout details →</a></p><p class="muted">Manage and fund bounties directly on your GitHub issues.</p><form method="post" action="/logout"><input type="hidden" name="csrf" value="${csrfFor(session,'/logout')}"><button class="btn-outline" type="submit">Sign out</button></form>`));
  }catch(error){if(error instanceof AuthError&&error.status===401)response.type('html').send(htmlPage('Issue Bounties on GitHub','<p>GitPay connects GitHub issues with PayPal escrow and automated verification.</p><p><a href="/login"><button type="button">Sign in with GitHub</button></a></p><p class="muted"><a href="/dashboard/">Browse public overview →</a></p>'));else safeError(response,error);}
 });
 app.post('/logout',async(request,response)=>{
  try{const session=await auth.requireLocalSession(cookie(request,'gitpay_session'));checkCsrf(request,env,session);await auth.logout(session.id);setCookie(response,env,'gitpay_session','',0);response.redirect(303,'/');}catch(error){safeError(response,error);}
 });
}
