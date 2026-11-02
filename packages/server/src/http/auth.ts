import type { Express,Request,Response } from 'express';
import type { Database } from '../db/client.js';
import type { AuthEnv } from '../env.js';
import type { GitHub } from '../github/app.js';
import { AuthError,type AuthService } from '../github/oauth.js';
import { randomToken } from '../util/crypto.js';
import { checkCsrf,cookie,requireSession,setCookie } from './session.js';
export interface AuthenticationDependencies {database:Database;env:AuthEnv;auth:AuthService;github:GitHub}
export const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??''));
export const dollars=(value:number)=>`$${String(Math.floor(value/100))}.${String(value%100).padStart(2,'0')}`;
export const formatIST=(d:Date|string|null|undefined):string=>{if(!d)return '—';const date=typeof d==='string'?new Date(d):d;if(isNaN(date.getTime()))return String(d);return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(date)+' IST';};
export function infoTip(text:string):string{return `<span class="has-tooltip"><button type="button" class="info-btn" aria-label="Info" tabindex="0">i</button><span class="tooltip-content">${escapeHtml(text)}</span></span>`;}
export function htmlPage(title:string,content:string,userLogin?:string):string {
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Repopay</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans/style.min.css"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-mono/style.min.css"><style>
:root{--font-sans:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;--font-mono:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace;--bg:#f8f9fa;--surface:#ffffff;--text:#111418;--muted:#57606a;--line:#eaedf0;--line-strong:#d4d8de;--border:#d4d8de;--accent:#0070ba;--escrow:#003087;--pass:#116329;--pass-bg:#dafbe1;--pass-border:#aceebb;--warn:#9a6700;--warn-bg:#fff8c5;--warn-border:#fae17d;--danger:#cf222e;--danger-bg:#ffebe9;--danger-border:#ffc1ba;--radius:6px}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--font-sans);font-size:13.5px;line-height:1.5;-webkit-font-smoothing:antialiased}
.header{height:54px;background:var(--surface);border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 40px}
.brand-group{display:flex;align-items:center;gap:12px}
.brand{font-size:15px;font-weight:600;letter-spacing:-0.02em;color:var(--text);text-decoration:none;display:flex;align-items:center;gap:8px}
.nav-links{display:flex;align-items:center;gap:20px;font-size:13px}
.nav-links a{color:var(--muted);text-decoration:none}
.nav-links a:hover{color:var(--text)}
.user-badge{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:500;color:var(--text);padding:3px 10px;background:var(--bg);border:1px solid var(--line);border-radius:100px}
.user-badge::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--pass)}
main.wrapper{max-width:1080px;margin:32px auto;padding:0 24px}
.title-row{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px}
.title-group h1{font-size:21px;font-weight:600;letter-spacing:-0.02em;color:var(--text);margin:0}
.title-group p{font-size:13px;color:var(--muted);margin-top:2px;margin-bottom:0}
.meta-time{font-family:var(--font-mono);font-size:12px;color:var(--muted)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:24px;margin-bottom:20px}
.card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--line)}
.card-header h2{font-size:14px;font-weight:600;letter-spacing:-0.01em;color:var(--text);margin:0;display:flex;align-items:center;gap:6px}
.two-col{display:grid;grid-template-columns:1.4fr 1fr;gap:20px}
a{color:var(--accent);text-decoration:none;text-underline-offset:2px}
a:hover{text-decoration:underline}
button,.btn{font-family:var(--font-sans);font-size:13px;font-weight:600;padding:8px 16px;border-radius:var(--radius);border:1px solid transparent;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;transition:all 0.12s;min-height:36px}
.btn-primary,button[type="submit"]:not(.btn-outline):not(.btn-danger):not(.btn-paypal){background:#111418;color:white;border-color:#111418}
.btn-primary:hover,button[type="submit"]:not(.btn-outline):not(.btn-danger):not(.btn-paypal):hover{background:#24292f}
.btn-outline{background:var(--surface);color:var(--text);border:1px solid var(--line-strong)}
.btn-outline:hover{background:var(--bg)}
.btn-paypal{background:#0070ba;color:#ffffff;border-color:#0070ba;font-weight:600}
.btn-paypal:hover{background:#005ea6}
.btn-danger{background:var(--surface);color:var(--danger);border:1px solid var(--danger-border)}
.btn-danger:hover{background:var(--danger-bg)}
input:not([type=checkbox]):not([type=hidden]),select,textarea{display:block;width:100%;box-sizing:border-box;font:inherit;font-size:13px;border:1px solid var(--border);border-radius:6px;padding:8px 10px;min-height:38px;background:var(--surface);color:var(--text);margin-top:4px}
input:focus,select:focus,textarea:focus{border-color:var(--accent);outline:none}
textarea{min-height:70px;font-family:inherit}
label{display:block;margin:12px 0 4px;font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase}
p{margin:6px 0 10px}
.muted{color:var(--muted);font-size:13px}
.chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:2px 7px;border-radius:100px;border:1px solid var(--line-strong);background:#f3f4f6;color:var(--muted);font-family:var(--font-mono);letter-spacing:0.02em}
.chip-pass{background:var(--pass-bg);color:var(--pass);border-color:var(--pass-border)}
.chip-fail,.chip-danger{background:var(--danger-bg);color:var(--danger);border-color:var(--danger-border)}
.chip-pending,.chip-warn{background:var(--warn-bg);color:var(--warn);border-color:var(--warn-border)}
.chip-info{background:#ddf4ff;color:var(--accent);border-color:#b6e3ff}
.has-tooltip{position:relative;display:inline-flex;align-items:center}
.info-btn{display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;border-radius:50%;border:1px solid var(--line-strong);background:var(--surface);color:var(--muted);font-size:11px;font-family:var(--font-mono);font-weight:600;cursor:pointer;padding:0;line-height:1;margin-left:4px;vertical-align:middle;min-height:unset}
.info-btn:hover{background:var(--bg);color:var(--text);border-color:var(--text)}
.tooltip-box{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:#111418;color:#ffffff;padding:6px 10px;border-radius:5px;font-size:11.5px;line-height:1.4;white-space:normal;width:max-content;max-width:250px;box-shadow:0 4px 14px rgba(0,0,0,0.18);pointer-events:none;opacity:0;visibility:hidden;transition:opacity .15s ease,visibility .15s ease;z-index:100;font-weight:400;text-align:left}
.has-tooltip:hover .tooltip-box{opacity:1;visibility:visible}
dialog.confirm-modal{border:1px solid var(--line-strong);border-radius:8px;padding:24px;background:var(--surface);color:var(--text);max-width:440px;width:90vw;box-shadow:0 20px 40px rgba(0,0,0,0.15);margin:auto}
dialog.confirm-modal::backdrop{background:rgba(17,20,24,0.45);backdrop-filter:blur(2px)}
.modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.modal-header h3{font-size:16px;font-weight:600;margin:0}
.modal-close{background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted);padding:0;line-height:1;min-height:unset}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.kv-grid{display:grid;grid-template-columns:140px 1fr;gap:8px 16px;font-size:13px;padding:12px 14px;background:var(--bg);border:1px solid var(--line);border-radius:var(--radius);margin:12px 0}
.kv-grid dt{color:var(--muted);font-size:12px;font-weight:500;display:flex;align-items:center;gap:4px}
.kv-grid dd{margin:0;font-family:var(--font-mono);font-size:12.5px;font-variant-numeric:tabular-nums;display:flex;align-items:center;gap:6px;word-break:break-word}
.split-progress{display:flex;height:6px;border-radius:3px;overflow:hidden;margin:10px 0 6px;background:var(--line)}
.split-a{background:var(--escrow)}
.split-b{background:var(--accent)}
.notice-banner{padding:12px 14px;border-radius:var(--radius);font-size:13px;margin:12px 0;border:1px solid var(--line)}
.notice-banner.info{background:#ddf4ff;border-left:3px solid #0969da;color:#0550ae}
.notice-banner.warn{background:var(--warn-bg);border-left:3px solid var(--warn);color:#6c5400}
.notice-banner.danger{background:var(--danger-bg);border-left:3px solid var(--danger);color:var(--danger)}
.code-box{background:var(--bg);border:1px solid var(--line);border-radius:var(--radius);padding:12px 14px;font-family:var(--font-mono);font-size:12.5px;line-height:1.55;color:#24292f;white-space:pre-wrap;margin:10px 0}
.conduit-bar{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:20px 24px;margin-bottom:24px;gap:16px}
.conduit-node{padding:12px 16px;background:var(--bg);border:1px solid var(--line);border-radius:var(--radius)}
.conduit-node .node-type{font-size:10.5px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;color:var(--muted);margin-bottom:4px;display:flex;align-items:center;gap:4px}
.conduit-node .node-val{font-size:13.5px;font-weight:600;color:var(--text)}
.conduit-node .node-meta{font-size:11.5px;font-family:var(--font-mono);color:var(--muted);margin-top:2px}
.conduit-arrow{display:flex;flex-direction:column;align-items:center;color:var(--muted);font-size:11px;font-family:var(--font-mono)}
.conduit-arrow svg{width:20px;height:20px;stroke:var(--line-strong)}
@media(max-width:768px){.two-col{grid-template-columns:1fr}.header{padding:0 16px}.conduit-bar{grid-template-columns:1fr}.kv-grid{grid-template-columns:1fr}}
</style><script src="/assets/actions.js" defer></script></head><body><header class="header"><div class="brand-group"><a href="/" class="brand"><svg width="18" height="18" viewBox="0 0 1024 1024" fill="none" aria-hidden="true" style="vertical-align:middle;margin-right:8px;border-radius:4px"><rect width="1024" height="1024" rx="200" fill="#14171A"/><path fill-rule="evenodd" clip-rule="evenodd" d="M 340 716 L 340 307 L 586 307 L 654 375 L 654 482 L 595 541 L 542 488 L 490 541 L 414 541 L 414 716 Z M 414 382 L 550 382 L 580 412 L 580 448 L 550 478 L 414 478 Z" fill="#FFFFFF"/><polygon points="542,490 681,716 590,716 490,551" fill="#4DFD9F"/></svg>Repopay</a><span class="chip">MIDDLEWARE</span></div><nav class="nav-links"><a href="/dashboard/">Overview</a><a href="/connect">Payout Settings</a>${userLogin?`<div class="user-badge">@${escapeHtml(userLogin)}</div>`:''}</nav></header><main class="wrapper">${content}<noscript><p>JavaScript is required to submit confirmation and sign-out forms securely. Read-only pages remain available.</p></noscript></main></body></html>`;
}
export function sensitiveHeaders(response:Response) {
 // img-src admits GitHub avatars only; every other directive stays closed.
 response.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data: https://github.com https://avatars.githubusercontent.com; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});
}
/** Signed-out visitors always land on the sign-in route instead of an error page. */
export const signInRedirect=(response:Response,reason?:'signin')=>{response.redirect(303,reason?'/?error='+reason:'/');};
export function safeError(response:Response,error:unknown,returnTo='/') {
 // A missing or expired session is not an error the user can act on here.
 if(error instanceof AuthError&&error.status===401){signInRedirect(response);return;}
 // Action pages (funding, review, cancellation, payout) keep explicit failures:
 // hiding them would conceal 409 recovery guidance and authorization denials.
 const status=error instanceof AuthError?error.status:503;
 response.status(status).type('html').send(htmlPage('Unable to continue',`<p role="alert">${escapeHtml(error instanceof AuthError?error.message:'The service is temporarily unavailable. Please try again.')}</p><p><a href="${escapeHtml(returnTo)}">Try again</a> · <a href="/dashboard">Back to overview</a></p>`));
}
export async function pageSession(deps:AuthenticationDependencies,request:Request,response:Response) {
 try{return await requireSession(deps.auth,request);}catch(error){if(error instanceof AuthError&&error.status===401){signInRedirect(response);return undefined;}throw error;}
}
export function mountAuth(app:Express,deps:AuthenticationDependencies) {
 const {env,auth}=deps;
 app.get('/login',async(request,response)=>{
  try{
   const returnTo=request.query.returnTo??'/dashboard';if(typeof returnTo!=='string')throw new AuthError(400,'Invalid return address.');
   const binding=randomToken();const url=await auth.beginLogin(returnTo,binding);
   setCookie(response,env,'repopay_oauth',binding,env.OAUTH_STATE_TTL_SEC);response.redirect(303,url);
  }catch{signInRedirect(response,'signin');}
 });
 app.get('/oauth/github/callback',async(request,response,next)=>{
  // Sponsor authorization shares the GitHub App's configured callback URL.
  // Let the sponsor route registered below validate its separate state and
  // browser binding instead of treating it as a normal Repopay login.
  if(cookie(request,'repopay_sponsor_oauth')){next();return;}
  try{
   const {code,state}=request.query;const binding=cookie(request,'repopay_oauth');
   if(typeof code!=='string'||typeof state!=='string'||!binding)throw new AuthError(400,'Invalid login callback. Start again.');
   const result=await auth.completeLogin(code,state,binding);
   // Rotate an existing local session only after successful authentication.
   const previous=cookie(request,'repopay_session');if(previous){try{const old=await auth.requireLocalSession(previous);await auth.logout(old.id);}catch{/* Already invalid. */}}
   setCookie(response,env,'repopay_session',result.cookie,env.SESSION_TTL_SEC);setCookie(response,env,'repopay_oauth','',0);
   response.redirect(303,result.returnTo==='/'?'/dashboard':result.returnTo);
  }catch{
   // Replayed, expired or tampered callbacks never create a session; the
   // sign-in route shows a short retry message instead of an error page.
   setCookie(response,env,'repopay_oauth','',0);signInRedirect(response,'signin');
  }
 });
 app.get('/logout',async(request,response)=>{
  try{const session=await auth.requireLocalSession(cookie(request,'repopay_session'));await auth.logout(session.id);}
  catch{/* Already invalid or absent. */}
  setCookie(response,env,'repopay_session','',0);signInRedirect(response);
 });
 app.post('/logout',async(request,response)=>{
  let session;
  try{session=await auth.requireLocalSession(cookie(request,'repopay_session'));}
  catch{setCookie(response,env,'repopay_session','',0);signInRedirect(response);return;}
  try{checkCsrf(request,env,session);await auth.logout(session.id);setCookie(response,env,'repopay_session','',0);signInRedirect(response);}
  catch(error){safeError(response,error);}
 });
}
