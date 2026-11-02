import type { Express } from 'express';
import type { AuthenticationDependencies } from './auth.js';
import { AuthError } from '../github/oauth.js';
import { csrfFor,requireSession } from './session.js';
import { cursor,readModels } from '../read-models/bounties.js';
import { payoutRows } from '../read-models/payouts.js';
export function mountApi(app:Express,deps:AuthenticationDependencies){
 const models=readModels(deps);
 const routes=['/api/me','/api/bounties','/api/payouts','/api/bounties/:id'];
 for(const route of routes)app.get(route,async(req,res)=>{try{const s=await requireSession(deps.auth,req);
  if(route==='/api/me'){res.json({id:s.ghId,login:s.ghLogin,operator:'CANCELLATION_OPERATOR_GH_IDS' in deps.env&&Array.isArray(deps.env.CANCELLATION_OPERATOR_GH_IDS)&&deps.env.CANCELLATION_OPERATOR_GH_IDS.includes(s.ghId),heartbeatSeconds:deps.env.SSE_HEARTBEAT_SEC,csrf:csrfFor(s,'/logout')});return;}
  if(route==='/api/bounties/:id'){res.json(await models.detail(s,typeof req.params.id==='string'?req.params.id:'',req.query.before===undefined?undefined:cursor(req.query.before)));return;}
  const after=cursor(req.query.cursor);
  if(route==='/api/bounties'){res.json(await models.list(s,after));return;}
  const page=await models.candidates(s,after);res.json({items:(await Promise.all(page.rows.map(b=>payoutRows(deps.database,b)))).flat(),nextCursor:page.nextCursor});
 }catch(e){res.status(e instanceof AuthError?e.status:503).json({error:e instanceof AuthError?e.message:'Repository access could not be verified.'});}});
}
