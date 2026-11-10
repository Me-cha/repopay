import { readModels } from '../read-models/bounties.js';
import type { Express,Response } from 'express';
import { z } from 'zod';
import { assertCancellable,authorizeAction,findBounty } from '../actions/guards.js';
import { assertToken,confirmAction,issueActionToken,readActionToken } from '../actions/tokens.js';
import type { Bounty } from '../db/schema.js';
import { AuthError,type Session } from '../github/oauth.js';
import { checkCsrf,csrfFor,requireSession } from './session.js';
import { dollars,escapeHtml,fact,dialogCard,htmlPage,pageSession,safeError,type AuthenticationDependencies } from './auth.js';
const bodySchema=z.object({csrf:z.string().min(1)}).strict();
function recovery(response:Response,error:unknown,bounty:Bounty) {
 if(!(error instanceof AuthError)||error.status!==409)throw error;
  response.status(409).type('html').send(htmlPage('Check bounty status',dialogCard({title:'Check bounty status',subtitle:'This confirmation can no longer be used.',closeHref:'/dashboard/contributions',body:`<p role="alert">${escapeHtml(error.message)}</p>`+summary(bounty),foot:`<a class="btn btn-primary" href="/bounties/${bounty.id}">View current bounty status</a>`+(bounty.status==='OPEN'&&!bounty.captureRequestKey&&!bounty.captureId&&!bounty.fundedAt?`<a class="dlg-link" href="/bounties/${bounty.id}/cancel">Prepare a fresh confirmation</a>`:'')})));
}
function summary(b:Bounty) {return `<div class="facts">${fact('Repository',escapeHtml(b.repoFullName))}${fact('Issue',`#${String(b.issueNumber)}`)}${fact('Amount',`<strong>${b.currency==='USD'?dollars(b.amountCents):(b.amountCents/100).toFixed(2)} ${b.currency}</strong>`)}${fact('State',`<span class="chip${b.status==='CANCELLED'?' chip-fail':b.status==='OPEN'?'':' chip-pass'}" id="bounty-status">${escapeHtml(b.status)}</span>`)}</div>`;}
function form(session:Session,path:string,label:string) {return `<form method="post" action="${escapeHtml(path)}"><input type="hidden" name="csrf" value="${csrfFor(session,path)}"><button type="submit">${escapeHtml(label)}</button></form>`;}
export function mountConfirm(app:Express,deps:AuthenticationDependencies) {
 const {database,env,auth,github}=deps;
 app.get('/assets/actions.js',(_request,response)=>{
  response.type('application/javascript').send(`
document.addEventListener('click',function(e){
 var m=e.target.closest('[data-modal]');
 if(m){var d=document.getElementById(m.getAttribute('data-modal'));if(d&&typeof d.showModal==='function')d.showModal();}
 var c=e.target.closest('[data-close-modal]');
 if(c){var cd=c.closest('dialog');if(cd&&typeof cd.close==='function')cd.close();}
});
for (const form of document.querySelectorAll('form[method="post"]')) {
 form.addEventListener('submit', async event => {
  event.preventDefault();const button=form.querySelector('button[type="submit"]');if(button?.disabled)return;
  const label=button?.textContent;if(button){button.disabled=true;button.textContent='Submitting…';}
  let feedback=form.querySelector('[role="alert"]');if(!feedback){feedback=document.createElement('p');feedback.setAttribute('role','alert');form.append(feedback);}feedback.textContent='';
  try {
   const body=new URLSearchParams();for(const [key,value] of new FormData(form)){if(typeof value==='string')body.append(key,value);}
   // CORS-mode same-origin fetch preserves Origin under no-referrer. Native form
   // navigation sends Origin:null, which the server deliberately rejects.
   const response=await fetch(form.action,{method:'POST',body,mode:'cors',credentials:'same-origin',cache:'no-store',referrerPolicy:'no-referrer'});
   const target=new URL(response.url);if(target.origin!==location.origin)throw new Error('Unexpected redirect');
   if(response.ok&&response.headers.get('content-type')?.startsWith('application/json')){
    const next=new URL((await response.json()).redirect);
    if(next.origin+next.pathname!=='https://github.com/login/oauth/authorize')throw new Error('Unexpected redirect');
    location.assign(next.href);return;
   }
   if(response.ok||response.status===409){location.assign(target.href);return;}
   const page=new DOMParser().parseFromString(await response.text(),'text/html');
   feedback.textContent=page.querySelector('[role="alert"]')?.textContent||'Unable to submit. Reload this page and try again.';
   if(response.status===401){const login=document.createElement('a');login.href='/login?returnTo='+encodeURIComponent(location.pathname);login.textContent='Sign in again';feedback.append(' ',login);}
  } catch {feedback.textContent='The response was interrupted. Reload this page to check the saved state before trying again.';}
  finally {if(button){button.disabled=false;button.textContent=label;}}
 });
}
const target=document.querySelector('[data-bounty-id]');
if(target) {
 const feedback=document.getElementById('poll-feedback');
 const refresh=async()=>{
  try {
   if(document.visibilityState==='hidden')return;
   const response=await fetch('/api/bounties/'+encodeURIComponent(target.dataset.bountyId),{credentials:'same-origin',cache:'no-store'});
   if(!response.ok) { target.dataset.stale='true';target.replaceChildren(feedback); feedback.textContent=response.status===401?'Session expired. Sign in again to refresh.':'Unable to refresh. Please try again.';return; }
   const data=await response.json();
   const signature=JSON.stringify([data.status,data.award?.paidCents??0,data.cancellation?.stage??null,data.needsAttention]);
   if(target.dataset.stale==='true'||target.dataset.signature!==signature){location.reload();return;}
   if(typeof data.status==='string')document.getElementById('bounty-status').textContent=data.status;
   feedback.textContent=data.needsAttention?'Synchronization or funding needs attention.':'Status is up to date.';
  } catch {target.dataset.stale='true';target.replaceChildren(feedback);feedback.textContent='Connection interrupted. Private status is hidden until access can be verified. Retrying…';}
  finally {setTimeout(refresh,${String(env.POLL_INTERVAL_MS)});}
 };
 setTimeout(refresh,${String(env.POLL_INTERVAL_MS)});
}`);
 });
 app.get('/bounties/:id/cancel',async(request,response)=>{
  try{
   const session=await pageSession(deps,request,response);if(!session)return;
   const bounty=await findBounty(database,request.params.id);await authorizeAction(auth,github,session,bounty,'cancel_draft');assertCancellable(bounty);
    response.type('html').send(htmlPage('Review draft cancellation',dialogCard({title:'Cancel this draft?',subtitle:'Unfunded · no payment or refund is involved.',closeHref:`/bounties/${bounty.id}`,body:summary(bounty)+'<p class="dlg-note">This draft is unfunded. Cancelling closes this draft without a payment or refund. Its history is retained.</p>',foot:form(session,request.path,'Prepare confirmation')+`<a class="dlg-link" href="/bounties/${bounty.id}">Keep draft</a>`}),session.ghLogin));
  }catch(error){safeError(response,error,request.path);}
 });
 app.post('/bounties/:id/cancel',async(request,response)=>{
  try{
   const session=await requireSession(auth,request);checkCsrf(request,env,session);if(!bodySchema.safeParse(request.body).success)throw new AuthError(400,'Unexpected action parameters.');
   const bounty=await findBounty(database,request.params.id);const ctx=await authorizeAction(auth,github,session,bounty,'cancel_draft');
   const token=await issueActionToken(database,env,session,ctx,bounty,()=>auth.clock.now());response.redirect(303,'/a/'+token);
  }catch(error){safeError(response,error,request.path);}
 });
 app.get('/a/:token',async(request,response)=>{
  try{
   const session=await pageSession(deps,request,response);if(!session)return;
   const token=await readActionToken(database,request.params.token);const bounty=await findBounty(database,token.bountyId);
   await authorizeAction(auth,github,session,bounty,'cancel_draft');
   try{assertToken(token,bounty,auth.clock.now());}catch(error){recovery(response,error,bounty);return;}
    response.type('html').send(htmlPage('Confirm draft cancellation',dialogCard({title:'Confirm cancellation',subtitle:'Step 2 of 2 · single-use confirmation.',closeHref:`/bounties/${bounty.id}`,body:summary(bounty)+'<p class="dlg-note"><strong>This will cancel the unfunded draft.</strong> No money will move, and the draft history will remain available. Anyone may still work on the issue.</p>',foot:form(session,request.path,'Confirm cancellation')+`<a class="dlg-link" href="/bounties/${bounty.id}">Keep draft and view status</a>`}),session.ghLogin));
  }catch(error){safeError(response,error,request.path);}
 });
 app.post('/a/:token',async(request,response)=>{
  try{
   const session=await requireSession(auth,request);checkCsrf(request,env,session);if(!bodySchema.safeParse(request.body).success)throw new AuthError(400,'Unexpected action parameters.');
   const raw=request.params.token,token=await readActionToken(database,raw),bounty=await findBounty(database,token.bountyId);
   const ctx=await authorizeAction(auth,github,session,bounty,'cancel_draft');
   try{await confirmAction(database,env,session,ctx,raw,()=>auth.clock.now());}
   catch(error){if(!(error instanceof AuthError)||error.status!==409)throw error;const current=await findBounty(database,bounty.id);await authorizeAction(auth,github,session,current,'read');recovery(response,error,current);return;}
   response.redirect(303,'/bounties/'+bounty.id);
  }catch(error){safeError(response,error,request.path);}
 });
 app.get('/bounties/:id',async(request,response)=>{
  try{
   const session=await pageSession(deps,request,response);if(!session)return;
   const bounty=await findBounty(database,request.params.id);await authorizeAction(auth,github,session,bounty,'read');
   const view=await readModels(deps).detail(session,bounty.id),signature=JSON.stringify([view.status,view.award?.paidCents??0,view.cancellation?.stage??null,view.needsAttention]);
    response.type('html').send(htmlPage('Bounty status',`<section data-bounty-id="${bounty.id}" data-signature="${escapeHtml(signature)}">`+dialogCard({title:'Bounty status',subtitle:`${bounty.repoFullName} #${String(bounty.issueNumber)}`,closeHref:'/dashboard/contributions',body:summary(bounty)+`<div class="facts">${fact('Next',`${escapeHtml(view.nextAction.actor)} · <a href="${escapeHtml(view.nextAction.href)}">${escapeHtml(view.nextAction.label)}</a>`)}${fact('Award committed',`${((view.award?.amountCents??0)/100).toFixed(2)} ${bounty.currency}`)}${fact('Delivered',`${((view.award?.paidCents??0)/100).toFixed(2)} ${bounty.currency}`)}</div>${view.cancellation?`<p class="dlg-note">Cancellation review: ${escapeHtml(view.cancellation.stage)}. ${view.cancellation.stage==='COMPLETED'?'Refund confirmed.':'No completed refund is implied.'} <a href="/cancellations/${view.cancellation.id}">View notice and evidence</a>.</p>`:''}<p class="dlg-note">${bounty.status==='CANCELLED'?((bounty.captureId||bounty.chainFundingSignature)?'Reviewed refund confirmed. History is retained.':'Draft cancelled. No payment or refund was sent.'):'This page shows the saved bounty state.'}</p>${bounty.needsAttention?'<p role="status" class="dlg-note">Synchronization or funding needs attention. Restore access and request /bounty status.</p>':''}<p id="poll-feedback" role="status" class="dlg-note">Checking for updates…</p>`,foot:(bounty.status==='OPEN'?`<a class="btn btn-primary" href="/bounties/${bounty.id}/fund">Review funding</a><a class="dlg-link danger" href="/bounties/${bounty.id}/cancel">Review draft cancellation</a>`:`<a class="btn btn-outline" href="/dashboard/?bounty=${bounty.id}">View full reasoning and history</a>`)+`<span class="grow"></span><a class="dlg-link" href="/bounties/${bounty.id}">Refresh status</a>`})+'</section>',session.ghLogin));
  }catch(error){safeError(response,error,request.path);}
 });
}
