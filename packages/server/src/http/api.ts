import { eq } from 'drizzle-orm';
import { awards,payoutItems } from '../db/schema.js';
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
   const [award]=await deps.database.orm.select().from(awards).where(eq(awards.bountyId,bounty.id));
   const items=award?await deps.database.orm.select({cents:payoutItems.amountCents,status:payoutItems.status}).from(payoutItems).where(eq(payoutItems.awardId,award.id)):[];
   const paidCents=items.filter(i=>i.status==='SUCCESS').reduce((sum,i)=>sum+i.cents,0);
   response.json({...(award?{award:{id:award.id,amountCents:award.amountCents,allocation:award.allocation,paidCents,unpaidCents:award.amountCents-paidCents}}:{}),id:bounty.id,amountCents:bounty.amountCents,currency:bounty.currency,status:bounty.status,version:bounty.version,needsAttention:bounty.needsAttention});
  }catch(error){response.status(error instanceof AuthError?error.status:503).json({error:error instanceof AuthError?error.message:'Repository access could not be verified.'});}
 });
}
