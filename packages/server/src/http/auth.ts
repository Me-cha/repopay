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
export function infoTip(text:string):string{return `<span class="has-tooltip"><button type="button" class="info-btn" aria-label="Info" tabindex="0">?</button><span class="tooltip-box">${escapeHtml(text)}</span></span>`;}
/** Minimal dialog-style card used by every action page. Callers pass pre-escaped HTML. */
export function dialogCard(o:{title:string;subtitle?:string;badge?:string;body:string;foot?:string;closeHref?:string}):string{
 return `<div class="dlg-stage"><section class="dlg" role="dialog" aria-modal="false" aria-label="${escapeHtml(o.title)}"><div class="dlg-head"><div><h1>${escapeHtml(o.title)}${o.badge?` ${o.badge}`:''}</h1>${o.subtitle?`<p>${escapeHtml(o.subtitle)}</p>`:''}</div>${o.closeHref?`<a class="dlg-close" href="${escapeHtml(o.closeHref)}" aria-label="Close">×</a>`:''}</div><div class="dlg-body">${o.body}</div>${o.foot?`<div class="dlg-foot">${o.foot}</div>`:''}</section></div>`;
}
export const fact=(key:string,value:string):string=>`<div class="fact"><span class="k">${key}</span><span class="v">${value}</span></div>`;
export const fold=(title:string,body:string,hint?:string):string=>`<details class="fold"><summary><span>${title}${hint?`<span class="hint">${hint}</span>`:''}</span></summary><div class="fold-body">${body}</div></details>`;
export function htmlPage(title:string,content:string,userLogin?:string):string {
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Repopay</title><style>
:root{--font-sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;--font-mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;--bg:#f4f4f5;--surface:#ffffff;--text:#18181b;--muted:#71717a;--line:#e4e4e7;--line-strong:#d4d4d8;--border:#d4d4d8;--accent:#18181b;--escrow:#16a34a;--pass:#15803d;--pass-bg:#dcfce7;--pass-border:#bbf7d0;--warn:#b45309;--warn-bg:#fef3c7;--warn-border:#fde68a;--danger:#dc2626;--danger-bg:#fee2e2;--danger-border:#fecaca;--radius:12px}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--font-sans);font-size:13.5px;line-height:1.55;-webkit-font-smoothing:antialiased}
.header{height:58px;background:var(--surface);border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 32px}
.brand-group{display:flex;align-items:center;gap:10px}
.brand{font-size:15px;font-weight:700;letter-spacing:-0.025em;color:var(--text);text-decoration:none;display:flex;align-items:center;gap:8px}
.nav-links{display:flex;align-items:center;gap:18px;font-size:13px;font-weight:500}
.nav-links a{color:var(--muted);text-decoration:none;transition:color .12s}
.nav-links a:hover{color:var(--text);text-decoration:none}
.user-badge{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--text);padding:4px 10px;background:var(--bg);border:1px solid var(--line);border-radius:100px}
.user-badge::before{content:'';width:6px;height:6px;border-radius:50%;background:#16a34a}
main.wrapper{max-width:960px;margin:32px auto;padding:0 24px}
.title-row{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;gap:16px;flex-wrap:wrap}
.title-group h1{font-size:22px;font-weight:700;letter-spacing:-0.025em;color:var(--text);margin:0}
.title-group p{font-size:13px;color:var(--muted);margin-top:3px;margin-bottom:0}
.meta-time{font-family:var(--font-mono);font-size:12px;color:var(--muted)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:24px;margin-bottom:18px;box-shadow:0 1px 2px rgba(24,24,27,0.03)}
.card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--line);gap:12px}
.card-header h2{font-size:14.5px;font-weight:600;letter-spacing:-0.01em;color:var(--text);margin:0;display:flex;align-items:center;gap:6px}
.two-col{display:grid;grid-template-columns:1.35fr 1fr;gap:18px}
a{color:#18181b;text-decoration:underline;text-decoration-color:var(--line-strong);text-underline-offset:3px}
a:hover{text-decoration-color:#18181b}
button,.btn{font-family:var(--font-sans);font-size:13px;font-weight:600;padding:9px 16px;border-radius:10px;border:1px solid transparent;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;transition:all 0.14s;min-height:38px}
.btn-primary,button[type="submit"]:not(.btn-outline):not(.btn-danger):not(.btn-paypal){background:#18181b;color:#ffffff;border-color:#18181b}
.btn-primary:hover,button[type="submit"]:not(.btn-outline):not(.btn-danger):not(.btn-paypal):hover{background:#27272a;text-decoration:none}
.btn-outline{background:var(--surface);color:var(--text);border:1px solid var(--line-strong);text-decoration:none}
.btn-outline:hover{background:var(--bg);text-decoration:none}
.btn-paypal{background:#0070ba;color:#ffffff;border-color:#0070ba;font-weight:600;text-decoration:none}
.btn-paypal:hover{background:#005ea6;text-decoration:none}
.btn-danger{background:var(--surface);color:var(--danger);border:1px solid var(--danger-border);text-decoration:none}
.btn-danger:hover{background:var(--danger-bg);text-decoration:none}
input:not([type=checkbox]):not([type=hidden]),select,textarea{display:block;width:100%;box-sizing:border-box;font:inherit;font-size:13px;border:1px solid var(--border);border-radius:10px;padding:9px 12px;min-height:40px;background:var(--surface);color:var(--text);margin-top:4px}
input:focus,select:focus,textarea:focus{border-color:#18181b;outline:none;box-shadow:0 0 0 3px rgba(24,24,27,0.08)}
textarea{min-height:76px;font-family:inherit}
label{display:block;margin:12px 0 4px;font-size:11.5px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em}
p{margin:8px 0 12px}
h2{font-size:16px;font-weight:600;letter-spacing:-0.015em;margin:14px 0 8px}
.muted{color:var(--muted);font-size:13px}
.chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;border:1px solid var(--line);background:#f4f4f5;color:#52525b;font-family:var(--font-mono);letter-spacing:0.02em}
.chip-pass{background:var(--pass-bg);color:var(--pass);border-color:var(--pass-border)}
.chip-fail,.chip-danger{background:var(--danger-bg);color:var(--danger);border-color:var(--danger-border)}
.chip-pending,.chip-warn{background:var(--warn-bg);color:var(--warn);border-color:var(--warn-border)}
.chip-info{background:#e0f2fe;color:#0369a1;border-color:#bae6fd}
.has-tooltip{position:relative;display:inline-flex;align-items:center}
.info-btn{display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;border-radius:50%;border:1px solid var(--line-strong);background:var(--bg);color:var(--muted);font-size:10.5px;font-family:var(--font-mono);font-weight:700;cursor:pointer;padding:0;line-height:1;margin-left:4px;vertical-align:middle;min-height:unset}
.info-btn:hover,.info-btn:focus-visible{background:#18181b;color:#ffffff;border-color:#18181b}
.tooltip-box,.tooltip-content{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:#18181b;color:#ffffff;padding:7px 10px;border-radius:8px;font-size:11.5px;line-height:1.45;white-space:normal;width:max-content;max-width:260px;box-shadow:0 8px 24px rgba(0,0,0,0.18);pointer-events:none;opacity:0;visibility:hidden;transition:opacity .14s ease,visibility .14s ease;z-index:100;font-weight:400;text-align:left}
.has-tooltip:hover .tooltip-box,.has-tooltip:focus-within .tooltip-box,.has-tooltip:hover .tooltip-content,.has-tooltip:focus-within .tooltip-content{opacity:1;visibility:visible}
dialog.confirm-modal{border:1px solid var(--line-strong);border-radius:14px;padding:24px;background:var(--surface);color:var(--text);max-width:440px;width:90vw;box-shadow:0 20px 40px rgba(0,0,0,0.16);margin:auto}
dialog.confirm-modal::backdrop{background:rgba(24,24,27,0.45);backdrop-filter:blur(2px)}
.modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.modal-header h3{font-size:16px;font-weight:600;margin:0}
.modal-close{background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted);padding:0;line-height:1;min-height:unset}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.kv-grid{display:grid;grid-template-columns:150px 1fr;gap:8px 16px;font-size:13px;padding:14px 16px;background:var(--bg);border:1px solid var(--line);border-radius:10px;margin:12px 0}
.kv-grid dt{color:var(--muted);font-size:12px;font-weight:500;display:flex;align-items:center;gap:4px}
.kv-grid dd{margin:0;font-family:var(--font-mono);font-size:12.5px;font-variant-numeric:tabular-nums;display:flex;align-items:center;gap:6px;word-break:break-word}
.criteria-box,.code-box{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:14px 16px;font-family:var(--font-mono);font-size:12.5px;line-height:1.6;color:#27272a;white-space:pre-wrap;margin:10px 0}
.split-progress{display:flex;height:6px;border-radius:3px;overflow:hidden;margin:10px 0 6px;background:var(--line)}
.split-a{background:#18181b}
.split-b{background:#16a34a}
.notice-banner{padding:12px 14px;border-radius:10px;font-size:13px;margin:12px 0;border:1px solid var(--line)}
.notice-banner.info{background:#f0f9ff;border-left:3px solid #0284c7;color:#0c4a6e}
.notice-banner.warn{background:var(--warn-bg);border-left:3px solid var(--warn);color:#78350f}
.notice-banner.danger{background:var(--danger-bg);border-left:3px solid var(--danger);color:var(--danger)}
.conduit-bar{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px 24px;margin-bottom:24px;gap:16px}
.conduit-node{padding:12px 16px;background:var(--bg);border:1px solid var(--line);border-radius:10px}
.conduit-node .node-type{font-size:10.5px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;color:var(--muted);margin-bottom:4px;display:flex;align-items:center;gap:4px}
.conduit-node .node-val{font-size:13.5px;font-weight:600;color:var(--text)}
.conduit-node .node-meta{font-size:11.5px;font-family:var(--font-mono);color:var(--muted);margin-top:2px}
.conduit-arrow{display:flex;flex-direction:column;align-items:center;color:var(--muted);font-size:11px;font-family:var(--font-mono)}
.conduit-arrow svg{width:20px;height:20px;stroke:var(--line-strong)}
.dlg-stage{min-height:calc(100vh - 58px - 64px);display:flex;align-items:flex-start;justify-content:center;padding-top:24px}
.dlg{width:100%;max-width:560px;background:var(--surface);border:1px solid var(--line);border-radius:20px;box-shadow:0 24px 60px rgba(24,24,27,0.10),0 2px 6px rgba(24,24,27,0.04);overflow:hidden}
.dlg-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px 24px 4px}
.dlg-head h1{font-size:19px;font-weight:700;letter-spacing:-0.02em;margin:0}
.dlg-head p{margin:3px 0 0;font-size:13px;color:var(--muted)}
.dlg-close{flex:none;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--line-strong);color:var(--muted);font-size:17px;line-height:1;text-decoration:none!important}
.dlg-close:hover{background:var(--bg);color:var(--text)}
.dlg-body{padding:14px 24px 6px}
.dlg-body>p{margin:10px 0}
.dlg-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:16px 24px 22px}
.dlg-foot form{margin:0}
.dlg-foot .grow{flex:1}
.dlg-link{font-size:13px;font-weight:600;color:var(--muted);text-decoration:none}
.dlg-link:hover{color:var(--text);text-decoration:underline}
.dlg-link.danger{color:var(--danger)}
.dlg-amount{display:flex;align-items:baseline;gap:8px;margin:8px 0 2px}
.dlg-amount strong{font-size:30px;font-weight:700;letter-spacing:-0.03em;font-variant-numeric:tabular-nums}
.dlg-amount span{font-size:12px;color:var(--muted);font-weight:600}
.facts{margin:10px 0 4px;border:1px solid var(--line);border-radius:12px;background:var(--bg)}
.fact{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:10px 14px;font-size:13px}
.fact+.fact{border-top:1px solid var(--line)}
.fact .k{color:var(--muted);font-size:12px;font-weight:500;line-height:20px}
.fact .v{font-weight:600;text-align:right;word-break:break-word;line-height:20px}
details.fold{margin:8px 0;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
details.fold>summary{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;padding:11px 14px;font-size:13px;font-weight:600}
details.fold>summary::-webkit-details-marker{display:none}
details.fold>summary::after{content:'+';font-family:var(--font-mono);color:var(--muted);font-weight:500}
details.fold[open]>summary::after{content:'−'}
details.fold>summary .hint{font-weight:500;font-size:11.5px;color:var(--muted);margin-left:8px}
details.fold>.fold-body{padding:0 14px 14px}
details.fold .criteria-box{margin:0}
details.fold .kv-grid{margin:8px 0 0}
.dlg-note{font-size:12px;color:var(--muted);margin:8px 0 0}
.crypto-payment-choice{display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:14px;margin:14px 0;border:1px solid var(--line);border-radius:12px;background:var(--bg)}
.crypto-payment-choice h2{font-size:14px;margin:0}
.crypto-payment-choice .dlg-note{margin-top:4px}
.crypto-buyer-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.crypto-checkout label{text-transform:none;letter-spacing:0;font-size:12px}
.crypto-checkout-action{display:flex;align-items:center;gap:10px;margin-top:16px;flex-wrap:wrap}
@media(max-width:480px){.crypto-buyer-fields{grid-template-columns:1fr;gap:0}.crypto-payment-choice .btn,.crypto-checkout .btn{width:100%;min-height:44px;text-align:center}.crypto-checkout input,.crypto-checkout select{min-height:44px}}
@media(max-width:768px){.two-col{grid-template-columns:1fr}.header{padding:0 16px}.conduit-bar{grid-template-columns:1fr}.kv-grid{grid-template-columns:1fr}}
@media(max-width:600px){.header{height:auto;min-height:58px;flex-wrap:wrap;gap:8px;padding:12px 16px}.nav-links{flex-wrap:wrap;gap:12px}.nav-links a{min-height:32px;display:inline-flex;align-items:center}.user-badge{overflow-wrap:anywhere}main.wrapper{margin:16px auto;padding:0 16px}.dlg-stage{padding-top:8px}.dlg{min-width:0}.dlg-head{padding:18px 16px 4px}.dlg-body{padding:14px 16px 6px}.dlg-foot{padding:16px;gap:12px}.dlg-foot .grow{display:none}.fact{align-items:flex-start}.fact .k{flex:none}.fold .hint{display:block}.criteria-box{overflow-wrap:anywhere}}
</style><script src="/assets/actions.js" defer></script></head><body><header class="header"><div class="brand-group"><a href="/dashboard" class="brand"><svg width="20" height="20" viewBox="0 0 1024 1024" fill="none" aria-hidden="true" style="vertical-align:middle;border-radius:5px"><rect width="1024" height="1024" rx="200" fill="#14171A"/><path fill-rule="evenodd" clip-rule="evenodd" d="M 340 716 L 340 307 L 586 307 L 654 375 L 654 482 L 595 541 L 542 488 L 490 541 L 414 541 L 414 716 Z M 414 382 L 550 382 L 580 412 L 580 448 L 550 478 L 414 478 Z" fill="#FFFFFF"/><polygon points="542,490 681,716 590,716 490,551" fill="#4DFD9F"/></svg>Repopay</a><span class="chip">ESCROW DESK</span></div><nav class="nav-links"><a href="/dashboard">Dashboard</a><a href="/dashboard/contributions">Contributions</a><a href="/dashboard/payouts/settings">Payouts</a>${userLogin?`<div class="user-badge">@${escapeHtml(userLogin)}</div>`:''}</nav></header><main class="wrapper">${content}<noscript><p>JavaScript is required to submit confirmation and sign-out forms securely. Read-only pages remain available.</p></noscript></main></body></html>`;
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
 response.status(status).type('html').send(htmlPage('Unable to continue',dialogCard({title:'Unable to continue',subtitle:'Nothing was changed.',closeHref:'/dashboard',body:`<p role="alert">${escapeHtml(error instanceof AuthError?error.message:'The service is temporarily unavailable. Please try again.')}</p>`,foot:`<a class="btn btn-primary" href="${escapeHtml(returnTo)}">Try again</a><a class="dlg-link" href="/dashboard">Back to overview</a>`})));
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
