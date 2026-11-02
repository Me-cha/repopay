import type { Bounty } from '../db/schema.js';
import type { FundingEnv } from '../env.js';
import { termsHash,isSponsoredTerms } from '../domain/funded-terms.js';
import { PROMPT_VERSION } from '../verifier/prompt.js';
// Foundation-only sandbox acceptance under ADR 0021: full synthetic acceptance
// is deferred by the user. This is not a passing evaluation or production approval.
// Exact bounty scope remains mandatory; settle.ts independently requires a current
// qualifying review, evidence, sponsor, CI and all final award/payment guards.
const foundationProfile={promptVersion:'repopay-verifier-v5',sdkVersion:'1.0.28'};
export function acceptsDemoProfile(env:FundingEnv,bounty:Bounty):boolean {
 const scope=env.SETTLEMENT_DEMO_SCOPE,terms=bounty.fundedTerms;
 return !!scope&&scope.bountyId===bounty.id&&scope.repoId===bounty.repoId&&scope.amountCents===bounty.amountCents&&!!terms&&isSponsoredTerms(terms)&&termsHash(terms)===scope.termsHash&&env.PP_MERCHANT_ID===terms.merchantId&&terms.policy.model==='auto'&&terms.policy.sdkVersion===foundationProfile.sdkVersion&&PROMPT_VERSION===foundationProfile.promptVersion;
}
