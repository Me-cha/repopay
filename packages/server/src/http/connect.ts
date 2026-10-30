import type { Express } from 'express';
import { z } from 'zod';
import { connectContributor,getContributorConnection } from '../actions/connect.js';
import { checkCsrf,csrfFor,requireSession } from './session.js';
import { escapeHtml,htmlPage,pageSession,safeError,type AuthenticationDependencies } from './auth.js';

export function mountConnect(app:Express,deps:AuthenticationDependencies) {
 app.get('/connect',async(request,response)=>{
  try{
   const session=await pageSession(deps,request,response);if(!session)return;
   const connected=await getContributorConnection(deps.database,session.ghId,deps.env.PAYMENT_DATA_ENC_KEY);
   const state=connected?`<p>PayPal email connected for <strong>${escapeHtml(connected.ghLogin)}</strong>: <strong>${escapeHtml(connected.maskedEmail)}</strong>.</p>`:'<p>No PayPal email is connected.</p>';
   response.type('html').send(htmlPage('Connect PayPal',`${state}<p>This saves a self-declared sandbox payout address. It does not verify PayPal account ownership, reserve a bounty, promise an award, or send money. Changing it applies only to future payout intents; existing intents keep their saved destination.</p><form method="post" action="/connect"><input type="hidden" name="csrf" value="${csrfFor(session,'/connect')}"><label for="paypalEmail">PayPal email</label><br><input id="paypalEmail" name="paypalEmail" type="email" maxlength="254" autocomplete="email" required><p><button type="submit">Save PayPal email</button></p></form><p><a href="/">Back to GitPay</a></p>`));
  }catch(error){safeError(response,error,request.path);}
 });
 app.post('/connect',async(request,response)=>{
  try{
   const session=await requireSession(deps.auth,request);checkCsrf(request,deps.env,session);
   const body:unknown=request.body;
   const parsed=z.object({paypalEmail:z.unknown()}).safeParse(body);
   const result=await connectContributor(deps.database,session,{paypalEmail:parsed.success?parsed.data.paypalEmail:undefined},deps.env.PAYMENT_DATA_ENC_KEY,deps.auth.clock.now.bind(deps.auth.clock));
   response.type('html').send(htmlPage('PayPal email saved',`<p>Saved for <strong>${escapeHtml(result.ghLogin)}</strong> as <strong>${escapeHtml(result.maskedEmail)}</strong>.</p><p>The value is private and encrypted. This does not claim or pay a bounty. Updates affect future payout intents only.</p><p><a href="/connect">Review connection</a> · <a href="/">Return to GitPay</a></p>`));
  }catch(error){safeError(response,error,request.path);}
 });
}
