import type { Bounty } from '../db/schema.js';
import type { FundingEnv } from '../env.js';
import { termsHash,isSponsoredTerms } from '../domain/funded-terms.js';
import { PROMPT_VERSION } from '../verifier/prompt.js';
// Foundation-only sandbox acceptance under ADR 0021: full synthetic acceptance
// is deferred by the user. This is not a passing evaluation or production approval.
// Exact bounty scope remains mandatory; settle.ts independently requires a current
// qualifying review, evidence, sponsor, CI and all final award/payment guards.
// User-approved ADR 0026 exception; it cannot authorize another bounty or frozen terms.
const v6DevnetCase={promptVersion:'repopay-verifier-v6',bountyId:'9',repoId:'1435468752',issueNumber:21,amountCents:100,termsHash:'d42965f0ace59e02d357e9db3c03ad845092f5e1e75f1b8627e7f40ffed48c78'};
const foundationProfile={promptVersion:'repopay-verifier-v5',sdkVersion:'1.0.28'};
export function acceptsDemoProfile(env:FundingEnv,bounty:Bounty):boolean {
 const scope=env.SETTLEMENT_DEMO_SCOPE,terms=bounty.fundedTerms;
 const acceptedPrompt=PROMPT_VERSION===foundationProfile.promptVersion||(PROMPT_VERSION===v6DevnetCase.promptVersion&&bounty.id===v6DevnetCase.bountyId&&bounty.repoId===v6DevnetCase.repoId&&bounty.issueNumber===v6DevnetCase.issueNumber&&bounty.amountCents===v6DevnetCase.amountCents&&bounty.currency==='PYUSD'&&terms?.version===6&&termsHash(terms)===v6DevnetCase.termsHash);
 return !!scope&&scope.bountyId===bounty.id&&scope.repoId===bounty.repoId&&scope.amountCents===bounty.amountCents&&!!terms&&isSponsoredTerms(terms)&&termsHash(terms)===scope.termsHash&&(terms.version===6?env.PYUSD_DEVNET_ENABLED:env.PP_MERCHANT_ID===terms.merchantId)&&terms.policy.model==='auto'&&terms.policy.sdkVersion===foundationProfile.sdkVersion&&acceptedPrompt;
}
