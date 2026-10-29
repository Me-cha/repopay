import { createHash } from 'node:crypto';
import { expect,it } from 'vitest';
import { termsSchema,termsHash } from '../../src/domain/funded-terms.js';
// Original v1 insertion order is part of the persisted hash contract.
const legacy={version:1,repoId:'2',issueNumber:1,creatorGhId:'4',amountCents:5000,currency:'USD',title:'Fix parser',criteria:'Reject invalid input',issueUpdatedAt:'2026-10-28T00:00:00Z',merchantId:'MERCHANT12345',policy:{version:'gitpay-v1',minConfidence:0.75,minShare:0.05,ciRequired:true,ciContexts:[{name:'test',appId:'15368'}],maxDiffChars:160000,maxCriteriaChars:16000,model:'nvidia/nemotron-3-ultra-550b-a55b',selectionRule:'first-qualifying-merged:merged_at,pr_number,pr_id',noticeHours:72,fundedCancellationEnabled:false}};
it('reads original Nemotron terms without changing their hash or provider meaning',()=>{
 const parsed=termsSchema.parse(legacy);
 expect(parsed).toEqual(legacy);
 expect(termsHash(parsed)).toBe(createHash('sha256').update(JSON.stringify(legacy)).digest('hex'));
 expect(parsed.policy).not.toHaveProperty('provider');
 expect(()=>termsSchema.parse({...legacy,policy:{...legacy.policy,model:'test-model',provider:'copilot'}})).toThrow();
});
it('requires an explicit model and provider in version 2 terms',()=>{
 const terms={...legacy,version:2,policy:{...legacy.policy,model:'test-model',provider:'copilot',sdkVersion:'1.0.28'}};
 expect(termsSchema.parse(terms).policy.model).toBe('test-model');
 for(const model of ['', 'auto','AUTO']) expect(()=>termsSchema.parse({...terms,policy:{...terms.policy,model}})).toThrow();
 expect(()=>termsSchema.parse({...terms,policy:{...terms.policy,provider:'nvidia'}})).toThrow();
});
