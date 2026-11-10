import { expect,it,vi } from 'vitest';
vi.mock('../../src/verifier/prompt.js',()=>({PROMPT_VERSION:'repopay-verifier-v5'}));
import { acceptsDemoProfile } from '../../src/settlement/profile.js';
import { termsHash,makeTerms } from '../../src/domain/funded-terms.js';
import { intentFixture } from '../helpers/funding.js';
it('scope binds the exact bounty, repository, amount and frozen terms; default is closed',async()=>{
 const f=await intentFixture();try{
  const env={...f.env,COPILOT_MODEL:'auto'};
  const terms=makeTerms(env,f.bounty,{title:'Fix',body:'Fix parser',updatedAt:'2026-10-30T00:00:00Z'},{sponsorGhId:'4',sponsorLogin:'maintainer',modelId:'auto',revokedAt:null});
  const bounty={...f.bounty,fundedTerms:terms};
  const scope={bountyId:bounty.id,repoId:bounty.repoId,amountCents:bounty.amountCents,termsHash:termsHash(terms)};
  expect(acceptsDemoProfile(env,bounty)).toBe(false);
  expect(acceptsDemoProfile({...env,SETTLEMENT_DEMO_SCOPE:scope},bounty)).toBe(true);
  for(const change of [{bountyId:'999'},{repoId:'999'},{amountCents:1},{termsHash:'0'.repeat(64)}])expect(acceptsDemoProfile({...env,SETTLEMENT_DEMO_SCOPE:{...scope,...change}},bounty)).toBe(false);
  expect(acceptsDemoProfile({...env,SETTLEMENT_DEMO_SCOPE:scope},{...bounty,fundedTerms:f.terms})).toBe(false);
  expect(acceptsDemoProfile({...env,PP_MERCHANT_ID:'OTHER',SETTLEMENT_DEMO_SCOPE:scope},bounty)).toBe(false);
 }finally{await f.close();}
});
