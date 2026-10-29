import { PayPalWebhookError,type PayPalHeaders } from '../paypal/webhooks.js';
import express, { type Express, type ErrorRequestHandler } from 'express';
import { WebhookError } from '../github/handlers.js';
import type { GitHubHeaders } from '../github/handlers.js';
import type { Database } from '../db/client.js';
import { mountAuth,sensitiveHeaders,type AuthenticationDependencies } from './auth.js';
import { mountConfirm } from './confirm.js';
import { mountFunding } from './fund.js';
import { mountCopilotSponsor } from './sponsor.js';
import { mountConnect } from './connect.js';
import { mountVerificationRetry } from './retry.js';
import type { FundingEnv } from '../env.js';
import { mountApi } from './api.js';
import { listCopilotModels } from '../models/copilot.js';
export interface AppDependencies { database: Pick<Database, 'health'>; version: string; webhook?: {maxBytes:number; ingest:(body:Buffer,headers:GitHubHeaders)=>Promise<unknown>}; authentication?:AuthenticationDependencies; funding?:{env:FundingEnv;ingest?:(body:Buffer,headers:PayPalHeaders)=>Promise<void>;listCopilotModels?:typeof listCopilotModels} }
export function buildApp(deps: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  if(deps.webhook) {
    const webhook=deps.webhook;
    app.post('/webhooks/github',express.raw({type:'application/json',limit:webhook.maxBytes,inflate:false}),async(request,response)=>{
      const timer=setTimeout(()=>{if(!response.headersSent)response.status(503).json({error:'Webhook intake unavailable; retry delivery'});},9000);
      try {
        if(!Buffer.isBuffer(request.body)){response.status(415).json({error:'JSON body required'});return;}
        await webhook.ingest(request.body,{event:request.get('x-github-event')??'',deliveryId:request.get('x-github-delivery')??'',signature:request.get('x-hub-signature-256')??''});
        if(!response.headersSent)response.status(202).json({accepted:true});
      } catch(error){if(!response.headersSent)response.status(error instanceof WebhookError?error.status:503).json({error:'Webhook not accepted'});}
      finally{clearTimeout(timer);}
    });
    const errors:ErrorRequestHandler=(error:unknown,_request,response,_next)=>{ if(response.headersSent){_next(error);return;} const status=typeof error==='object'&&error!==null&&'status' in error&&error.status===413?413:400;response.status(status).json({error:'Invalid webhook body'});};
    app.use(errors);
  }
  if(deps.funding?.ingest) {
    const {env,ingest}=deps.funding;
    app.post('/webhooks/paypal',express.raw({type:'application/json',limit:env.WEBHOOK_BODY_MAX_BYTES,inflate:false}),async(request,response)=>{
      try {
        if(!Buffer.isBuffer(request.body)){response.status(415).json({error:'JSON body required'});return;}
        await ingest(request.body,{transmissionId:request.get('paypal-transmission-id')??'',transmissionTime:request.get('paypal-transmission-time')??'',certUrl:request.get('paypal-cert-url')??'',authAlgo:request.get('paypal-auth-algo')??'',transmissionSig:request.get('paypal-transmission-sig')??''});
        response.status(202).json({accepted:true});
      }catch(error){response.status(error instanceof PayPalWebhookError?error.status:503).json({error:'PayPal webhook not accepted'});}
    });
    const errors:ErrorRequestHandler=(error:unknown,_request,response,next)=>{if(response.headersSent){next(error);return;}response.status(typeof error==='object'&&error!==null&&'status' in error&&error.status===413?413:400).json({error:'Invalid PayPal webhook body'});};app.use(errors);
  }
  if(deps.authentication) {
    app.use((_request,response,next)=>{sensitiveHeaders(response);next();});
    app.use(express.urlencoded({extended:false,limit:4096,parameterLimit:5}));
    mountAuth(app,deps.authentication);mountConfirm(app,deps.authentication);mountApi(app,deps.authentication);mountConnect(app,deps.authentication);
    if(deps.funding){mountFunding(app,{...deps.authentication,env:deps.funding.env,...(deps.funding.listCopilotModels?{listCopilotModels:deps.funding.listCopilotModels}:{})});mountCopilotSponsor(app,{...deps.authentication,model:deps.funding.env.COPILOT_MODEL,responseMaxBytes:deps.funding.env.PROVIDER_RESPONSE_MAX_BYTES});mountVerificationRetry(app,deps.authentication);}
    const errors:ErrorRequestHandler=(error,_request,response,next)=>{if(response.headersSent){next(error);return;}response.status(400).json({error:'Invalid request body'});};
    app.use(errors);
  }
  app.get('/healthz', async (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    try { await deps.database.health(); response.json({ status: 'ready', version: deps.version }); }
    catch { response.status(503).json({ status: 'unavailable', version: deps.version }); }
  });
  return app;
}
