import { randomUUID } from 'node:crypto';
import { and,eq,inArray,isNull,lte,sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { reviewDispatches } from '../db/schema.js';
import { claimJob,finishJob } from '../jobs/queue.js';
import { admitReview,controlLock,createDispatch,terminateReview } from './store.js';
import type { ReviewSettings } from './config.js';
import { renderTasks,type RenderTasks } from './render.js';

export async function dispatchOnce(db:Database,settings:ReviewSettings,provider?:RenderTasks){
 if(settings.REVIEW_BACKEND==='shared')return;
 const enabled=await db.withTransaction(async tx=>{const c=await controlLock(tx);return c&&!c.paused&&c.backend===settings.REVIEW_BACKEND&&c.generation===settings.REVIEW_GENERATION;});
 if(enabled){
  const job=await claimJob(db,`reviews:${randomUUID()}`,60,{only:'verify_submission'});
  if(job){try{await createDispatch(db,job,settings.REVIEW_BACKEND,settings.REVIEW_GENERATION,settings.RENDER_REVIEW_TASK);await finishJob(db,job);}catch{await finishJob(db,job,true);}}
  await admitReview(db);
 }
 if(settings.REVIEW_BACKEND!=='render'||!provider)return;
 // Reconcile even while paused: terminal provider evidence can free capacity.
 const active=await db.orm.select().from(reviewDispatches).where(and(eq(reviewDispatches.backend,'render'),eq(reviewDispatches.capacityHeld,true))).limit(2);
 for(const row of active){if(row.runId){try{if(['completed','succeeded','failed','canceled'].includes(await provider.status(row.runId)))await terminateReview(db,row.id,row.runId);}catch{/* Hold uncertain capacity. */}}}
 if(!enabled)return;
 const launch=await db.withTransaction(async tx=>{
  const c=await controlLock(tx);if(!c||c.paused||c.generation!==settings.REVIEW_GENERATION||c.backend!=='render')return null;
  const [row]=await tx.select().from(reviewDispatches).where(and(eq(reviewDispatches.backend,'render'),eq(reviewDispatches.generation,c.generation),eq(reviewDispatches.capacityHeld,true),isNull(reviewDispatches.runId),inArray(reviewDispatches.status,['ADMITTED','LAUNCHING','LAUNCH_UNKNOWN']),lte(reviewDispatches.nextLaunchAt,new Date()))).orderBy(reviewDispatches.createdAt).limit(1).for('update');
  if(!row)return null;
  // Stop before Render's 24-hour deduplication window, including clock/latency margin.
  if(row.launchStartedAt&&Date.now()-row.launchStartedAt.getTime()>=23*3600000){await tx.update(reviewDispatches).set({status:'LAUNCH_UNKNOWN',errorCode:'LAUNCH_WINDOW_EXPIRED',nextLaunchAt:new Date('9999-01-01')}).where(eq(reviewDispatches.id,row.id));return null;}
  await tx.update(reviewDispatches).set({status:'LAUNCHING',launchStartedAt:row.launchStartedAt??new Date(),nextLaunchAt:sql`now()+interval '30 seconds'`}).where(eq(reviewDispatches.id,row.id));return row;
 });
 if(!launch?.taskIdentifier)return;
 try{
  const runId=await provider.start(launch.taskIdentifier,launch.id);
  await db.withTransaction(async tx=>{
   await controlLock(tx);const [fresh]=await tx.select().from(reviewDispatches).where(eq(reviewDispatches.id,launch.id)).for('update');
   if(fresh?.runId&&fresh.runId!==runId)throw new Error('Render run binding conflict');
   await tx.update(reviewDispatches).set({runId}).where(eq(reviewDispatches.id,launch.id));
  });
 }catch{await db.orm.update(reviewDispatches).set({status:'LAUNCH_UNKNOWN',errorCode:'LAUNCH_UNRESOLVED'}).where(and(eq(reviewDispatches.id,launch.id),isNull(reviewDispatches.ownerToken)));}
}
export function startReviewDispatcher(db:Database,settings:ReviewSettings,onError:()=>void){
 const provider=settings.RENDER_API_KEY?renderTasks(settings.RENDER_API_KEY):undefined;
 let closed=false,pending:Promise<void>|undefined;
 const tick=()=>{if(!closed&&!pending)pending=dispatchOnce(db,settings,provider).catch(onError).finally(()=>{pending=undefined;});};
 const timer=setInterval(tick,1000);tick();
 return {async close(){closed=true;clearInterval(timer);await pending;}};
}
