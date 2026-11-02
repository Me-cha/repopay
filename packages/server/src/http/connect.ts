import type { Express } from 'express';
import { z } from 'zod';
import { connectContributor,getContributorConnection } from '../actions/connect.js';
import { AuthError } from '../github/oauth.js';
import { checkCsrf,csrfFor,requireSession } from './session.js';
import { escapeHtml,htmlPage,infoTip,pageSession,safeError,type AuthenticationDependencies } from './auth.js';

export function mountConnect(app:Express,deps:AuthenticationDependencies) {
 app.get('/api/connect',async(request,response)=>{
  try{
   const session=await requireSession(deps.auth,request);
   const connected=await getContributorConnection(deps.database,session.ghId,deps.env.PAYMENT_DATA_ENC_KEY);
   response.json({connected:Boolean(connected),ghId:session.ghId,ghLogin:session.ghLogin,maskedEmail:connected?.maskedEmail??null,connectionVersion:connected?.connectionVersion??null,csrf:csrfFor(session,'/api/connect')});
  }catch(error){
   response.status(error instanceof AuthError?error.status:503).json({error:error instanceof AuthError?error.message:'Payout destination status could not be loaded.'});
  }
 });
 app.post('/api/connect',async(request,response)=>{
  try{
   const session=await requireSession(deps.auth,request);checkCsrf(request,deps.env,session);
   const body:unknown=request.body;
   const parsed=z.object({paypalEmail:z.unknown()}).safeParse(body);
   const result=await connectContributor(deps.database,session,{paypalEmail:parsed.success?parsed.data.paypalEmail:undefined},deps.env.PAYMENT_DATA_ENC_KEY,deps.auth.clock.now.bind(deps.auth.clock));
   response.json({connected:true,ghId:result.ghId,ghLogin:result.ghLogin,maskedEmail:result.maskedEmail,connectionVersion:result.connectionVersion,csrf:csrfFor(session,'/api/connect')});
  }catch(error){
   response.status(error instanceof AuthError?error.status:503).json({error:error instanceof AuthError?error.message:'Payout destination could not be updated.'});
  }
 });
 app.get('/connect',async(request,response)=>{
  try{
   const session=await pageSession(deps,request,response);if(!session)return;
   const connected=await getContributorConnection(deps.database,session.ghId,deps.env.PAYMENT_DATA_ENC_KEY);
   const content=`<div class="title-row"><div class="title-group"><h1>Contributor Payout Destination</h1><p>Configure recipient PayPal address for automatic bounty disbursement.</p></div><div class="meta-time">Timezone: Asia/Kolkata (IST)</div></div><div class="two-col"><div class="card"><div class="card-header"><h2>Connected Destination ${infoTip('Destination email is encrypted at rest using AES-256 GCM.')}</h2><span class="chip ${connected?'chip-pass':''}">${connected?'ACTIVE':'NOT CONNECTED'}</span></div><dl class="kv-grid"><dt>GitHub Identity</dt><dd><strong>@${escapeHtml(session.ghLogin)}</strong> <span class="chip">OAuth Bound</span></dd><dt>PayPal Destination</dt><dd><strong>${connected?escapeHtml(connected.maskedEmail):'None connected'}</strong></dd><dt>Connection Version</dt><dd>${connected?`v${String(connected.connectionVersion)}`:'—'}</dd><dt>Security Storage</dt><dd><span class="chip chip-pass">AES-256 GCM</span></dd></dl><div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--line)"><form method="post" action="/connect"><input type="hidden" name="csrf" value="${csrfFor(session,'/connect')}"><label for="paypalEmail">Update Payout Email</label><input id="paypalEmail" name="paypalEmail" type="email" maxlength="254" autocomplete="email" placeholder="contributor@example.com" required style="font-family:var(--font-mono);margin-bottom:12px"><button type="submit">Update Destination Email</button></form></div></div><div class="card"><div class="card-header"><h2>Update Scope &amp; Settlement Rules ${infoTip('Awards disburse automatically upon qualifying PR merge.')}</h2><span class="chip">ESCROW POLICY</span></div><p class="muted">Updates apply to future payout reservations; existing intents keep their saved destination.</p><p class="muted">Connecting or updating your PayPal address here or inside the Repopay workspace automatically resumes any committed awards waiting in <code>AWAITING_CLAIM</code>.</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px"><a href="/dashboard/payouts/settings" class="btn btn-primary">Open Workspace Payout Settings</a><a href="/dashboard/payouts" class="btn btn-outline">View Disbursement Ledger</a></div></div></div>`;
   response.type('html').send(htmlPage('Contributor Payout Settings',content,session.ghLogin));
  }catch(error){safeError(response,error,request.path);}
 });
 app.post('/connect',async(request,response)=>{
  try{
   const session=await requireSession(deps.auth,request);checkCsrf(request,deps.env,session);
   const body:unknown=request.body;
   const parsed=z.object({paypalEmail:z.unknown()}).safeParse(body);
   const result=await connectContributor(deps.database,session,{paypalEmail:parsed.success?parsed.data.paypalEmail:undefined},deps.env.PAYMENT_DATA_ENC_KEY,deps.auth.clock.now.bind(deps.auth.clock));
   const content=`<div class="card" style="max-width:540px;margin:40px auto"><div class="card-header"><h2>Payout Destination Updated</h2><span class="chip chip-pass">SAVED</span></div><dl class="kv-grid"><dt>GitHub Account</dt><dd><strong>@${escapeHtml(result.ghLogin)}</strong></dd><dt>Connected Email</dt><dd><code>${escapeHtml(result.maskedEmail)}</code></dd><dt>Security</dt><dd><span class="chip chip-pass">AES-256 GCM Encrypted</span></dd></dl><p class="muted" style="margin:16px 0">Payout destination is active and encrypted at rest.</p><div style="display:flex;gap:10px"><a href="/connect" class="btn btn-outline">Review connection</a><a href="/dashboard/" class="btn btn-primary">Return to Overview</a></div></div>`;
   response.type('html').send(htmlPage('PayPal Email Saved',content,session.ghLogin));
  }catch(error){safeError(response,error,request.path);}
 });
}
