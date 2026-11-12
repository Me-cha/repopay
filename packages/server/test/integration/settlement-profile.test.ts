import { expect,it } from 'vitest';
import { eq } from 'drizzle-orm';
import { acceptsSettlementProfile } from '../../src/settlement/profile.js';
import { nextSettlementBounty } from '../../src/settlement/service.js';
import { createSettlement } from '../../src/settlement/settle.js';
import { makeTerms } from '../../src/domain/funded-terms.js';
import { awards,bounties,verifications } from '../../src/db/schema.js';
import { intentFixture } from '../helpers/funding.js';
import { awardFixture } from '../helpers/awards.js';
import { required } from '../helpers/auth.js';

it('accepts new bounty identities through their own frozen terms without an ID allowlist',async()=>{
 const f=await intentFixture({method:'paypal'},{COPILOT_MODEL:'auto',SETTLEMENT_ENABLED:true});try{
  for(const [id,repoId,issueNumber,amountCents] of [['9','2',33,10000],['100','99',50,7500]] as const){
   const row={...f.bounty,id,repoId,issueNumber,amountCents};
   const terms=makeTerms({...f.env,POLICY_CI_CONTEXTS:{[repoId]:[{name:'test',appId:'15368'}]}},row,{title:'Fix',body:'Fix parser',updatedAt:'2026-11-12T00:00:00Z'},{sponsorGhId:'4',sponsorLogin:'maintainer',modelId:'auto',revokedAt:null});
   const bounty={...row,fundedTerms:terms};
   expect(acceptsSettlementProfile(f.env,bounty)).toBe(true);
   expect(acceptsSettlementProfile({...f.env,SETTLEMENT_ENABLED:false},bounty)).toBe(false);
   expect(acceptsSettlementProfile({...f.env,PP_MERCHANT_ID:'OTHER'},bounty)).toBe(false);
   for(const change of [{repoId:'999'},{issueNumber:999},{amountCents:1},{currency:'PYUSD'},{createdByGhId:'999'}])expect(acceptsSettlementProfile(f.env,{...bounty,...change})).toBe(false);
   expect(acceptsSettlementProfile(f.env,{...bounty,fundedTerms:null})).toBe(false);
  }
 }finally{await f.close();}
});

it('rotates across funded bounties, skips drafts/holds/awards, and wraps without starvation',async()=>{
 const f=await awardFixture(false,{COPILOT_MODEL:'auto',SETTLEMENT_ENABLED:true});try{
  const insert=async(issueNumber:number,status:string,fundingHold=false)=>required((await f.database.orm.insert(bounties).values({installationId:'1',repoId:'2',repoFullName:'owner/repo',issueNumber,amountCents:100,createdByGhId:'4',createdVia:'command',status,fundingHold}).returning())[0]);
  await insert(90,'OPEN');await insert(91,'FUNDED',true);
  const later=await insert(92,'NEEDS_REVIEW');
  const first=required(await nextSettlementBounty(f.database,f.env));
  expect(first.id).toBe(f.bounty.id);
  expect((await nextSettlementBounty(f.database,f.env,first.id))?.id).toBe(later.id);
  expect((await nextSettlementBounty(f.database,f.env,later.id))?.id).toBe(first.id);
  expect(await nextSettlementBounty(f.database,{...f.env,SETTLEMENT_ENABLED:false})).toBeUndefined();
  await f.add('501','2026-11-12T01:00:00Z');
  await f.database.orm.update(verifications).set({model:'gpt-6-luna'});
  const service=createSettlement(f.database,{scan:f.scan,profileAccepted:b=>Promise.resolve(acceptsSettlementProfile(f.env,b)),acceptedServingModels:['gpt-6-luna']});
  await Promise.all([service.settleBounty(f.bounty.id),service.settleBounty(f.bounty.id)]);
  const committed=await f.database.orm.select().from(awards);
  expect(committed).toHaveLength(1);
  expect(committed[0]?.bountyId).toBe(f.bounty.id);
  expect(committed[0]?.amountCents).toBe(f.bounty.amountCents);
  expect((await nextSettlementBounty(f.database,f.env))?.id).toBe(later.id);
 }finally{await f.close();}
});

it.each(['disabled','uncaptured','funding-hold','partial','ci-fail','error'] as const)('general settlement retains the %s guard',async mode=>{
 const f=await awardFixture(false,{COPILOT_MODEL:'auto',SETTLEMENT_ENABLED:mode!=='disabled'});try{
  const sub=await f.add('501','2026-11-12T01:00:00Z',mode==='error'?'ERROR':'DONE');
  await f.database.orm.update(verifications).set({model:'gpt-6-luna'});
  if(mode==='uncaptured')await f.database.orm.update(bounties).set({captureId:null}).where(eq(bounties.id,f.bounty.id));
  if(mode==='funding-hold')await f.database.orm.update(bounties).set({fundingHold:true}).where(eq(bounties.id,f.bounty.id));
  if(mode==='partial'){
   const review=required((await f.database.orm.select().from(verifications))[0]);
   await f.database.orm.update(verifications).set({result:{...review.result,verdict:'PARTIAL'}});
  }
  if(mode==='ci-fail')required((await f.scan()).evidence.get(sub.id)).ci.status='fail';
  const service=createSettlement(f.database,{scan:f.scan,profileAccepted:b=>Promise.resolve(acceptsSettlementProfile(f.env,b)),acceptedServingModels:['gpt-6-luna']});
  expect((await service.settleBounty(f.bounty.id))?.kind).toBe('held');
  expect(await f.database.orm.select().from(awards)).toHaveLength(0);
 }finally{await f.close();}
});
