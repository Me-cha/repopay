import type { Express } from 'express';
import { z } from 'zod';
import { claimDashboardTour,hasSeenDashboardTour } from '../actions/onboarding.js';
import { AuthError } from '../github/oauth.js';
import type { AuthenticationDependencies } from './auth.js';
import { checkCsrf,csrfFor,requireSession } from './session.js';
const path='/api/onboarding/dashboard';
const bodySchema=z.object({csrf:z.string().min(1)}).strict();
export function mountOnboarding(app:Express,deps:AuthenticationDependencies) {
 app.get(path,async(req,res)=>{
  try{const s=await requireSession(deps.auth,req);res.json({seen:await hasSeenDashboardTour(deps.database,s.ghId),csrf:csrfFor(s,path)});}
  catch(e){res.status(e instanceof AuthError?e.status:503).json({error:'Onboarding unavailable.'});}
 });
 app.post(path,async(req,res)=>{
  try{
   const s=await requireSession(deps.auth,req);checkCsrf(req,deps.env,s);
   if(!bodySchema.safeParse(req.body).success)throw new AuthError(400,'Invalid onboarding request.');
   res.json({show:await claimDashboardTour(deps.database,s,deps.auth.clock.now())});
  }catch(e){res.status(e instanceof AuthError?e.status:503).json({error:'Onboarding unavailable.'});}
 });
}
