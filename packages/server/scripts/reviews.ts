import { z } from 'zod';
import { and,eq,or } from 'drizzle-orm';
import { createDatabase } from '../src/db/client.js';
import { checkMigrations } from '../src/db/compatibility.js';
import { reviewControl,reviewDispatches } from '../src/db/schema.js';
import { configureReviews,pauseReviews,resumeReviews,terminateReview,recoverTerminatedRenderRun } from '../src/reviews/store.js';
import { parseReviewSettings } from '../src/reviews/config.js';
import { renderTasks,readRenderRun } from '../src/reviews/render.js';

const db=createDatabase(z.url().parse(process.env.DATABASE_URL));
try{
 await checkMigrations(db);
 const command=process.argv[2]??'status';
 if(command==='pause')await pauseReviews(db);
 else if(command==='configure'||command==='resume'){
  const s=parseReviewSettings(process.env);
  if(command==='configure')await configureReviews(db,s.REVIEW_BACKEND,s.REVIEW_GENERATION);
  else await resumeReviews(db,s.REVIEW_BACKEND,s.REVIEW_GENERATION);
 }else if(command==='reconcile'){
  const id=z.uuid().parse(process.argv[3]);const [row]=await db.orm.select().from(reviewDispatches).where(eq(reviewDispatches.id,id));
  if(!row?.runId||row.backend!=='render'||!process.env.RENDER_API_KEY)throw new Error('Known Render run and API key required');
  const status=await renderTasks(process.env.RENDER_API_KEY).status(row.runId);
  if(!['completed','succeeded','failed','canceled'].includes(status))throw new Error('Render has not confirmed termination');
  await terminateReview(db,id,row.runId);
 }else if(command==='recover-render-run'){
  const id=z.uuid().parse(process.argv[3]),runId=z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).parse(process.argv[4]);
  if(!process.env.RENDER_API_KEY)throw new Error('API key required');
  const run=await readRenderRun(process.env.RENDER_API_KEY,runId);
  await recoverTerminatedRenderRun(db,id,runId,run);
 }else if(command==='confirm-local-exit'){
  // No automatic lease-expiry recovery. Operator must confirm the actual process
  // is dead, then supply the exact dispatch and run IDs shown by status.
  const id=z.uuid().parse(process.argv[3]),runId=z.uuid().parse(process.argv[4]);
  if(process.argv[5]!=='--process-exit-confirmed')throw new Error('Explicit process-exit evidence required');
  const [row]=await db.orm.select().from(reviewDispatches).where(and(eq(reviewDispatches.id,id),eq(reviewDispatches.runId,runId)));
  if(row?.backend!=='dedicated')throw new Error('Dedicated run required');await terminateReview(db,id,runId);
 }else if(command!=='status')throw new Error('Unknown review operation');
 const control=await db.orm.select().from(reviewControl);
 const pending=await db.orm.select({id:reviewDispatches.id,jobId:reviewDispatches.jobId,backend:reviewDispatches.backend,generation:reviewDispatches.generation,status:reviewDispatches.status,runId:reviewDispatches.runId,capacityHeld:reviewDispatches.capacityHeld,errorCode:reviewDispatches.errorCode}).from(reviewDispatches).where(or(eq(reviewDispatches.capacityHeld,true),eq(reviewDispatches.status,'READY'))).orderBy(reviewDispatches.createdAt).limit(100);
 console.log(JSON.stringify({control,pending},null,2));
}catch{console.error('Review operation failed. Check configuration, generation and termination evidence.');process.exitCode=1;}
finally{await db.close();}
