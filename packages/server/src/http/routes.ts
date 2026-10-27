import express, { type Express, type ErrorRequestHandler } from 'express';
import { WebhookError } from '../github/handlers.js';
import type { GitHubHeaders } from '../github/handlers.js';
import type { Database } from '../db/client.js';
export interface AppDependencies { database: Pick<Database, 'health'>; version: string; webhook?: {maxBytes:number; ingest:(body:Buffer,headers:GitHubHeaders)=>Promise<unknown>} }
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
  app.get('/healthz', async (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    try { await deps.database.health(); response.json({ status: 'ready', version: deps.version }); }
    catch { response.status(503).json({ status: 'unavailable', version: deps.version }); }
  });
  return app;
}
