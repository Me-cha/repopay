import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {acceptsDemoProfile} from '../../src/settlement/profile.js';
import {termsSchema,termsHash} from '../../src/domain/funded-terms.js';
import {PROMPT_VERSION} from '../../src/verifier/prompt.js';
import {intentFixture} from '../helpers/funding.js';
it('v6 accepts only the approved devnet bounty and immutable terms with an explicit matching scope',async()=>{
 const f=await intentFixture();try{
  expect(PROMPT_VERSION).toBe('repopay-verifier-v6');
  const terms=termsSchema.parse(JSON.parse(readFileSync(new URL('../fixtures/pyusd-nine-terms.json',import.meta.url),'utf8')));
  const bounty={...f.bounty,id:'9',repoId:'1435468752',issueNumber:21,amountCents:100,currency:'PYUSD',fundedTerms:terms};
  const scope={bountyId:bounty.id,repoId:bounty.repoId,amountCents:100,termsHash:termsHash(terms)};
  const env={...f.env,PYUSD_DEVNET_ENABLED:true,SETTLEMENT_DEMO_SCOPE:scope};
  expect(scope.termsHash).toBe('d42965f0ace59e02d357e9db3c03ad845092f5e1e75f1b8627e7f40ffed48c78');
  expect(acceptsDemoProfile(env,bounty)).toBe(true);
  expect(acceptsDemoProfile({...env,SETTLEMENT_DEMO_SCOPE:null},bounty)).toBe(false);
  expect(acceptsDemoProfile({...env,PYUSD_DEVNET_ENABLED:false},bounty)).toBe(false);
  for(const change of [{id:'10'},{repoId:'99'},{amountCents:101},{issueNumber:22},{currency:'USD'}]){
   const changed={...bounty,...change};
   expect(acceptsDemoProfile({...env,SETTLEMENT_DEMO_SCOPE:{...scope,bountyId:changed.id,repoId:changed.repoId,amountCents:changed.amountCents}},changed)).toBe(false);
  }
  for(const change of [{bountyId:'10'},{repoId:'99'},{amountCents:101},{termsHash:'0'.repeat(64)}])expect(acceptsDemoProfile({...env,SETTLEMENT_DEMO_SCOPE:{...scope,...change}},bounty)).toBe(false);
  const changedTerms={...terms,criteria:terms.criteria+' changed'};
  expect(acceptsDemoProfile({...env,SETTLEMENT_DEMO_SCOPE:{...scope,termsHash:termsHash(changedTerms)}},{...bounty,fundedTerms:changedTerms})).toBe(false);
  expect(acceptsDemoProfile({...env,SETTLEMENT_DEMO_SCOPE:{bountyId:f.bounty.id,repoId:f.bounty.repoId,amountCents:f.bounty.amountCents,termsHash:termsHash(f.terms)}},{...f.bounty,fundedTerms:f.terms})).toBe(false);
 }finally{await f.close();}
});
