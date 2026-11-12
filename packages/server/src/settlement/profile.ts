import type { Bounty } from '../db/schema.js';
import type { FundingEnv } from '../env.js';
import { isSponsoredTerms,termsSchema } from '../domain/funded-terms.js';
import { PROMPT_VERSION } from '../verifier/prompt.js';

// ADR 0027: deployment-level enablement, never a bounty ID allowlist. The
// reviewed prompt/SDK contract remains pinned; future versions need validation.
const acceptedProfile={promptVersion:'repopay-verifier-v6',sdkVersion:'1.0.28',paypalBase:'https://api-m.sandbox.paypal.com'};
export function acceptsSettlementProfile(env:FundingEnv,bounty:Bounty):boolean {
 if(!env.SETTLEMENT_ENABLED||PROMPT_VERSION!==acceptedProfile.promptVersion||env.PP_BASE!==acceptedProfile.paypalBase)return false;
 const parsed=termsSchema.safeParse(bounty.fundedTerms);
 if(!parsed.success)return false;
 const terms=parsed.data;
 if(!isSponsoredTerms(terms)||terms.policy.model!=='auto'||terms.policy.sdkVersion!==acceptedProfile.sdkVersion)return false;
 if(terms.repoId!==bounty.repoId||terms.issueNumber!==bounty.issueNumber||terms.creatorGhId!==bounty.createdByGhId||terms.amountCents!==bounty.amountCents||terms.currency!==bounty.currency)return false;
 if(terms.version===6)return env.PYUSD_DEVNET_ENABLED&&bounty.currency==='PYUSD';
 return (terms.version===4||terms.version===5)&&bounty.currency==='USD'&&!!env.PP_MERCHANT_ID&&env.PP_MERCHANT_ID===terms.merchantId;
}
