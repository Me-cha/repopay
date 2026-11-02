import {vi} from 'vitest';
vi.mock('../../src/verifier/prompt.js',()=>({PROMPT_VERSION:'repopay-verifier-future'}));
import {expect,it} from 'vitest';
import {PROMPT_VERSION} from '../../src/verifier/prompt.js';
import {acceptsDemoProfile} from '../../src/settlement/profile.js';
import {termsHash,makeTerms} from '../../src/domain/funded-terms.js';
import {intentFixture} from '../helpers/funding.js';
it('a future prompt cannot inherit scoped foundation acceptance',async()=>{
 expect(PROMPT_VERSION).toBe('repopay-verifier-future');
 const f=await intentFixture();try{const env={...f.env,COPILOT_MODEL:'auto'};const terms=makeTerms(env,f.bounty,{title:'Fix',body:'Fix parser',updatedAt:'2026-10-30T00:00:00Z'},{sponsorGhId:'4',sponsorLogin:'maintainer',modelId:'auto',revokedAt:null});const bounty={...f.bounty,fundedTerms:terms};
 expect(acceptsDemoProfile({...env,SETTLEMENT_DEMO_SCOPE:{bountyId:bounty.id,repoId:bounty.repoId,amountCents:bounty.amountCents,termsHash:termsHash(terms)}},bounty)).toBe(false);
 }finally{await f.close();}
});
