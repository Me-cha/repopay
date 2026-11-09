import express, { type Express } from 'express';
import { and,eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client.js';
import { reviewDispatches } from '../db/schema.js';
import type { createReviewService } from '../reviews/service.js';
import { claimReview,heartbeatReview,terminateReview } from '../reviews/store.js';
import { executorIdentity,ownerRequest,reviewOutput } from '../reviews/contracts.js';
import { authenticateExecutor } from '../reviews/auth.js';
import { sensitiveHeaders } from './auth.js';

export interface ReviewExecutorDependencies {database:Database;key:string;service:ReturnType<typeof createReviewService>}
export function mountReviewExecutor(app:Express,deps:ReviewExecutorDependencies){
 app.use('/internal/reviews',express.raw({type:'application/json',limit:1048576,inflate:false}));
 app.post('/internal/reviews/:id/:operation',async(req,res)=>{
  sensitiveHeaders(res);
  const raw:unknown=req.body;
  if(!Buffer.isBuffer(raw)||!authenticateExecutor(deps.key,req.path,req.get('x-review-time'),req.get('x-review-signature'),raw.toString('utf8'))){res.status(401).json({error:'Executor authorization required'});return;}
  try{
   const body:unknown=JSON.parse(raw.toString('utf8'));const {id,operation}=req.params;
   if(id==='queue'&&operation==='next'){
    const identity=executorIdentity.parse(body);if(identity.backend!=='dedicated'){res.status(403).json({error:'Dedicated executor required'});return;}
    const [row]=await deps.database.orm.select({id:reviewDispatches.id}).from(reviewDispatches).where(and(eq(reviewDispatches.status,'ADMITTED'),eq(reviewDispatches.backend,'dedicated'),eq(reviewDispatches.generation,identity.generation),eq(reviewDispatches.artifactVersion,identity.artifactVersion))).orderBy(reviewDispatches.createdAt).limit(1);
    res.json({dispatchId:row?.id??null});return;
   }
   z.uuid().parse(id);
   if(operation==='claim'){
    const identity=executorIdentity.parse(body),row=await claimReview(deps.database,id,identity.runId,identity.backend,identity.generation,identity.artifactVersion);
    res.json({ownerToken:row?.ownerToken??null});return;
   }
   if(operation==='complete'){
    const input=ownerRequest.extend({output:reviewOutput}).strict().parse(body);
    await deps.service.complete(id,input.ownerToken,input.output);res.json({saved:true});return;
   }
   const {ownerToken}=ownerRequest.parse(body);
   if(operation==='prepare'){res.json(await deps.service.prepare(id,ownerToken));return;}
   if(operation==='begin'){res.json({credentials:await deps.service.begin(id,ownerToken)});return;}
   if(operation==='heartbeat'){await heartbeatReview(deps.database,id,ownerToken);res.json({alive:true});return;}
   if(operation==='stop'){
    const [row]=await deps.database.orm.select().from(reviewDispatches).where(and(eq(reviewDispatches.id,id),eq(reviewDispatches.ownerToken,ownerToken)));
    if(!row?.runId)throw new Error('Owner unavailable');
    // Render's physical slot stays held until its API confirms terminal state.
    if(row.backend==='dedicated')await terminateReview(deps.database,id,row.runId);
    res.json({stopped:true});return;
   }
   res.status(404).json({error:'Unknown review operation'});
  }catch{res.status(409).json({error:'Review unavailable, stale, or already claimed'});}
 });
}
