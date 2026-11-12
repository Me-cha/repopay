import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {acceptsSettlementProfile} from '../../src/settlement/profile.js';
import {termsSchema} from '../../src/domain/funded-terms.js';
import {intentFixture} from '../helpers/funding.js';
it('accepts new PYUSD identities only with enabled devnet and matching valid frozen terms',async()=>{
 const f=await intentFixture();try{
  const original=termsSchema.parse(JSON.parse(readFileSync(new URL('../fixtures/pyusd-nine-terms.json',import.meta.url),'utf8')));
  if(original.version!==6)throw new Error('fixture');
  const terms={...original,issueNumber:90,amountCents:200};
  const bounty={...f.bounty,id:'999',repoId:terms.repoId,createdByGhId:terms.creatorGhId,issueNumber:90,amountCents:200,currency:'PYUSD',fundedTerms:terms};
  const env={...f.env,SETTLEMENT_ENABLED:true,PYUSD_DEVNET_ENABLED:true};
  expect(acceptsSettlementProfile(env,bounty)).toBe(true);
  expect(acceptsSettlementProfile({...env,PYUSD_DEVNET_ENABLED:false},bounty)).toBe(false);
  expect(acceptsSettlementProfile({...env,SETTLEMENT_ENABLED:false},bounty)).toBe(false);
  expect(acceptsSettlementProfile(env,{...bounty,currency:'USD'})).toBe(false);
  const invalid=JSON.parse(JSON.stringify(terms)) as typeof terms;
  Object.assign(invalid.chain,{network:'solana-mainnet'});
  expect(acceptsSettlementProfile(env,{...bounty,fundedTerms:invalid})).toBe(false);
 }finally{await f.close();}
});
