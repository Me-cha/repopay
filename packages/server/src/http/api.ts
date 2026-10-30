import type { Express } from 'express';
import type { AuthenticationDependencies } from './auth.js';
import { AuthError } from '../github/oauth.js';
import { findBounty,authorizeAction } from '../actions/guards.js';
import { requireSession } from './session.js';
export function mountApi(app:Express,deps:AuthenticationDependencies) {
 app.get('/api/bounties/:id',async(request,response)=>{
  try{
   const session=await requireSession(deps.auth,request);const bounty=await findBounty(deps.database,request.params.id);
   await authorizeAction(deps.auth,deps.github,session,bounty,'read');
   response.json({id:bounty.id,amountCents:bounty.amountCents,currency:bounty.currency,status:bounty.status,version:bounty.version,needsAttention:bounty.needsAttention});
  }catch(error){response.status(error instanceof AuthError?error.status:503).json({error:error instanceof AuthError?error.message:'Repository access could not be verified.'});}
 });
}
