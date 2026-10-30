import type { Bounty } from '../db/schema.js';
import type { FundingEnv } from '../env.js';
import { termsHash,isSponsoredTerms } from '../domain/funded-terms.js';
import { PROMPT_VERSION } from '../verifier/prompt.js';
// Reviewed 18/18 application-adapter report: docs/evidence/05-auto-v2-20261030.json.
// This accepts the evaluated profile only within an explicitly scoped sandbox demo.
// It does not claim organization or full personal-workflow acceptance.
const evaluated={promptVersion:'gitpay-verifier-v2',sdkVersion:'1.0.28'};
export function acceptsDemoProfile(env:FundingEnv,bounty:Bounty):boolean {
 const scope=env.SETTLEMENT_DEMO_SCOPE,terms=bounty.fundedTerms;
 return !!scope&&scope.bountyId===bounty.id&&scope.repoId===bounty.repoId&&scope.amountCents===bounty.amountCents&&!!terms&&isSponsoredTerms(terms)&&termsHash(terms)===scope.termsHash&&env.PP_MERCHANT_ID===terms.merchantId&&terms.policy.model==='auto'&&terms.policy.sdkVersion===evaluated.sdkVersion&&PROMPT_VERSION===evaluated.promptVersion;
}
