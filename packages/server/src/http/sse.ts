import type { Express } from 'express';
import type { PoolClient } from 'pg';
import { eq,gt } from 'drizzle-orm';
import { bountyActivity,bounties } from '../db/schema.js';
import { cursor,readModels } from '../read-models/bounties.js';
import { AuthError } from '../github/oauth.js';
import { requireSession } from './session.js';
import type { AuthenticationDependencies } from './auth.js';
// One LISTEN connection per mounted app; notifications carry only a schema wake-up.
// Durable activity IDs are hints, not commit order or a financial authority.
export function mountStream(app:Express,deps:AuthenticationDependencies){
 const models=readModels(deps),subscribers=new Set<()=>void>();let listener:PoolClient|undefined,connecting:Promise<void>|undefined;
 const wake=()=>{for(const notify of subscribers)notify();};
 function connect(){if(listener)return Promise.resolve();connecting??=(async()=>{const client=await deps.database.pool.connect();if(!subscribers.size){client.release();return;}listener=client;client.on('notification',msg=>{if(msg.channel==='repopay_activity'&&msg.payload===deps.database.schemaName)wake();});client.on('error',()=>{if(listener===client){listener=undefined;client.release(true);}connecting=undefined;wake();});await client.query('LISTEN repopay_activity');})().catch(()=>{listener?.release(true);listener=undefined;}).finally(()=>{connecting=undefined;});return connecting;}
 app.get('/api/stream',async(req,res)=>{
  let last:string;try{await requireSession(deps.auth,req);last=cursor(req.get('Last-Event-ID')??req.query.cursor);}catch(e){res.status(e instanceof AuthError?e.status:503).json({error:'Live updates require a current session.'});return;}
  res.status(200).set({'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();
  let closed=false,busy=false,pending=false;let previousScope:Set<string>|undefined;
  const send=(event:string,data:unknown,id?:string)=>{if(!closed){if(res.writableLength>65536){res.end();return;}res.write(`${id?'id: '+id+'\n':''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);}};
  async function refresh(){if(closed)return;if(busy){pending=true;return;}busy=true;try{
   const session=await requireSession(deps.auth,req);
   const repos=await deps.database.orm.selectDistinctOn([bounties.repoId,bounties.installationId]).from(bounties).limit(101);if(repos.length>100)throw new Error('Stream scope exceeds bound');const allowed=new Set<string>();for(const b of repos){try{await models.access(session,b);allowed.add(b.repoId+':'+b.installationId);}catch(e){if(!(e instanceof AuthError&&[403,404].includes(e.status)))throw e;}}if(previousScope&&[...previousScope].some(id=>!allowed.has(id)))throw new AuthError(403);previousScope=allowed;
   const rows=await deps.database.orm.select({activity:bountyActivity,bounty:bounties}).from(bountyActivity).innerJoin(bounties,eq(bounties.id,bountyActivity.bountyId)).where(gt(bountyActivity.id,last)).orderBy(bountyActivity.id).limit(100);
   for(const row of rows){last=row.activity.id;try{if(!allowed.has(row.bounty.repoId+':'+row.bounty.installationId))continue;send('invalidate',{bountyId:row.bounty.id},row.activity.id);}catch(e){if(!(e instanceof AuthError&&[403,404].includes(e.status)))throw e;}}
   // Always full refetch: repairs lower sequence IDs committed after higher IDs,
   // missed notifications and all lifecycle updates without an activity record.
   send('refresh',{full:true});if(!listener)void connect();
  }catch{send('access-lost',{message:'Access must be checked again.'});res.end();}finally{busy=false;if(pending){pending=false;void refresh();}}}
  const notify=()=>{void refresh();};subscribers.add(notify);const timer=setInterval(notify,deps.env.SSE_HEARTBEAT_SEC*1000);
  const close=()=>{if(closed)return;closed=true;clearInterval(timer);subscribers.delete(notify);if(!subscribers.size&&listener){const client=listener;listener=undefined;void client.query('UNLISTEN repopay_activity').then(()=> { client.release(); },()=> { client.release(true); });}};
  req.on('close',close);res.on('close',close);await connect();await refresh();
 });
}
