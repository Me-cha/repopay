import type { Express,Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import type { FundingEnv } from '../env.js';
import type { AuthenticationDependencies } from './auth.js';
import { AuthError } from '../github/oauth.js';
import { authorizeAction,findBounty } from '../actions/guards.js';
import { chainTransfers } from '../db/schema.js';
import { walletService } from '../solana/wallet.js';
import { chainService } from '../solana/service.js';
import { createChainProvider } from '../solana/provider.js';
import { currentTerms } from './fund.js';
import { makeChainTerms,termsHash } from '../domain/funded-terms.js';
import { checkCsrf,csrfFor,requireSession } from './session.js';
export function mountPyusd(app:Express,deps:AuthenticationDependencies&{env:FundingEnv}) {
 const {database:db,env,auth,github}=deps,provider=createChainProvider(env),wallets=walletService(db,env.PUBLIC_URL),chain=chainService(db,env,provider);
 const error=(res:Response,e:unknown)=>res.status(e instanceof AuthError?e.status:503).json({error:e instanceof AuthError?e.message:'PYUSD is unavailable. Keep the existing transfer; retry status later.'});
 const guard=()=>{if(!env.PYUSD_DEVNET_ENABLED)throw new AuthError(409,'PYUSD devnet is disabled.');};
 app.get('/api/pyusd',async(req,res)=>{try{guard();const s=await requireSession(auth,req),wallet=await wallets.get(s.ghId);res.json({network:'solana-devnet',login:s.ghLogin,address:wallet?.address??null,csrfChallenge:csrfFor(s,'/api/pyusd/wallet/challenge'),csrfConfirm:csrfFor(s,'/api/pyusd/wallet/confirm')});}catch(e){error(res,e);}});
 app.post('/api/pyusd/wallet/challenge',async(req,res)=>{try{guard();const s=await requireSession(auth,req);checkCsrf(req,env,s);const p=z.object({address:z.string().max(44)}).parse(req.body);res.json(await wallets.challenge(s,p.address));}catch(e){error(res,e);}});
 app.post('/api/pyusd/wallet/confirm',async(req,res)=>{try{guard();const s=await requireSession(auth,req);checkCsrf(req,env,s);const p=z.object({id:z.uuid(),signature:z.string().max(100)}).parse(req.body);await wallets.confirm(s,p.id,p.signature);res.json({saved:true});}catch(e){error(res,e);}});
 app.get('/api/pyusd/bounties/:id',async(req,res)=>{try{guard();const s=await requireSession(auth,req),b=await findBounty(db,req.params.id);await authorizeAction(auth,github,s,b,'read');
  const [r]=await db.orm.select().from(chainTransfers).where(eq(chainTransfers.id,b.chainFundingId??''));
  if(r){res.json({status:b.status,transferStatus:r.status,id:r.id,wire:r.ghId===s.ghId&&!r.signature?r.wire:null,signature:r.signature,attention:r.attention,...(r.ghId===s.ghId?{csrfPrepare:csrfFor(s,`/api/pyusd/transfers/${r.id}/prepare`),csrfSign:csrfFor(s,`/api/pyusd/transfers/${r.id}/sign`)}:{}),amount:r.amount/100,terms:r.terms});return;}
  await authorizeAction(auth,github,s,b,'fund');
  if(b.status!=='OPEN'||b.currency!=='USD')throw new AuthError(409,'This bounty cannot start PYUSD checkout.');
  const w=await wallets.get(s.ghId);if(!w)throw new AuthError(409,'Save your funding wallet first.');
  const terms=makeChainTerms(await currentTerms(deps,b),await provider.treasury(),w.address,env.PYUSD_REFUNDS_ENABLED);
  res.json({status:b.status,terms,hash:termsHash(terms),csrfReserve:csrfFor(s,req.path),amount:b.amountCents/100});
 }catch(e){error(res,e);}});
 app.post('/api/pyusd/bounties/:id',async(req,res)=>{try{guard();const s=await requireSession(auth,req);checkCsrf(req,env,s);const p=z.object({hash:z.string().length(64)}).parse(req.body),b=await findBounty(db,req.params.id),ctx=await authorizeAction(auth,github,s,b,'fund'),w=await wallets.get(s.ghId);if(!w)throw new AuthError(409,'Save your funding wallet first.');
  const terms=makeChainTerms(await currentTerms(deps,b),await provider.treasury(),w.address,env.PYUSD_REFUNDS_ENABLED);if(termsHash(terms)!==p.hash)throw new AuthError(409,'Terms changed. Review them again.');
  const r=await chain.reserveFunding(s,ctx,b,terms);res.json({reserved:true,id:r.id});
 }catch(e){error(res,e);}});
 app.post('/api/pyusd/transfers/:id/sign',async(req,res)=>{try{guard();const s=await requireSession(auth,req);checkCsrf(req,env,s);const p=z.object({wire:z.string().max(2200)}).parse(req.body),r=await chain.get(req.params.id),b=await findBounty(db,r.bountyId);await authorizeAction(auth,github,s,b,'fund');await chain.submitFunding(r.id,s,p.wire);res.json({saved:true});}catch(e){error(res,e);}});
 // A preparation outage can be resumed without reserving another transfer.
 app.post('/api/pyusd/transfers/:id/prepare',async(req,res)=>{try{guard();const s=await requireSession(auth,req);checkCsrf(req,env,s);const r=await chain.get(req.params.id),b=await findBounty(db,r.bountyId);await authorizeAction(auth,github,s,b,'fund');const prepared=await chain.signingReady(r.id,s);res.json({saved:true,id:prepared.id,wire:prepared.wire,csrfSign:csrfFor(s,`/api/pyusd/transfers/${prepared.id}/sign`)});}catch(e){error(res,e);}});
}
