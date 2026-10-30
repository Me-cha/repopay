import { z } from 'zod';
import type { FundingEnv } from '../env.js';
import type { Bounty } from '../db/schema.js';
import { AuthError } from '../github/oauth.js';
import { sha256 } from '../util/crypto.js';
const legacyTermsSchema=z.object({
 version:z.literal(1),repoId:z.string(),issueNumber:z.number().int().positive(),creatorGhId:z.string(),
 amountCents:z.number().int().positive(),currency:z.literal('USD'),title:z.string().min(1).max(1000),criteria:z.string().min(1).max(16000),issueUpdatedAt:z.string(),merchantId:z.string().min(1),
 policy:z.object({version:z.string(),minConfidence:z.number(),minShare:z.number(),ciRequired:z.boolean(),ciContexts:z.array(z.object({name:z.string(),appId:z.string()})),maxDiffChars:z.number(),maxCriteriaChars:z.literal(16000),model:z.literal('nvidia/nemotron-3-ultra-550b-a55b'),selectionRule:z.literal('first-qualifying-merged:merged_at,pr_number,pr_id'),noticeHours:z.literal(72),fundedCancellationEnabled:z.literal(false)}).strict(),
}).strict();
const copilotTermsSchema=legacyTermsSchema.extend({version:z.literal(2),policy:legacyTermsSchema.shape.policy.extend({
 model:z.string().min(1).max(200).regex(/^[a-zA-Z0-9._:/-]+$/).refine(value=>value.toLowerCase()!=='auto'),provider:z.literal('copilot'),sdkVersion:z.literal('1.0.28'),
})});
const sponsoredTermsSchema=copilotTermsSchema.extend({version:z.literal(3),sponsor:z.object({kind:z.literal('user'),id:z.string().regex(/^[1-9]\d*$/),login:z.string().min(1).max(100)}).strict()});
// Version 4 freezes the Auto policy: GitHub selects the serving model per request,
// and each verification records the model Copilot reported (ADR 0007).
const autoTermsSchema=sponsoredTermsSchema.extend({version:z.literal(4),policy:copilotTermsSchema.shape.policy.extend({model:z.literal('auto')})});
const cancellationTermsSchema=autoTermsSchema.extend({version:z.literal(5),policy:autoTermsSchema.shape.policy.extend({fundedCancellationEnabled:z.literal(true)})});
export const termsSchema=z.discriminatedUnion('version',[legacyTermsSchema,copilotTermsSchema,sponsoredTermsSchema,autoTermsSchema,cancellationTermsSchema]);
export type SponsoredTerms=Extract<FundedTerms,{version:3|4|5}>;
export const isSponsoredTerms=(terms:FundedTerms):terms is SponsoredTerms=>terms.version===3||terms.version===4||terms.version===5;
export type FundedTerms=z.infer<typeof termsSchema>;
export interface IssueTerms {title:string;body:string;updatedAt:string}
export interface SponsorSnapshot {sponsorGhId:string;sponsorLogin:string;modelId:string;revokedAt:Date|null}
export function makeTerms(env:FundingEnv,bounty:Bounty,issue:IssueTerms,sponsor?:SponsorSnapshot):FundedTerms {
 if(!env.PP_MERCHANT_ID)throw new AuthError(409,'Configure the receiving sandbox merchant before funding.');
 const contexts=env.POLICY_CI_CONTEXTS[bounty.repoId]??[];
 if(env.POLICY_CI_REQUIRED&&!contexts.length)throw new AuthError(409,'Configure trusted CI contexts and producing App IDs for this repository before funding.');
 if(!issue.body.trim()||issue.body.length>16000)throw new AuthError(409,'Acceptance criteria must be present and at most 16000 characters.');
 if(!env.COPILOT_MODEL)throw new AuthError(409,'Configure a Copilot model, or auto, before funding.');
 const base={repoId:bounty.repoId,issueNumber:bounty.issueNumber,creatorGhId:bounty.createdByGhId,amountCents:bounty.amountCents,currency:bounty.currency,title:issue.title,criteria:issue.body,issueUpdatedAt:issue.updatedAt,merchantId:env.PP_MERCHANT_ID,policy:{version:env.POLICY_VERSION,minConfidence:env.POLICY_MIN_CONFIDENCE,minShare:env.POLICY_MIN_SHARE,ciRequired:env.POLICY_CI_REQUIRED,ciContexts:contexts,maxDiffChars:env.MAX_DIFF_CHARS,maxCriteriaChars:16000,model:env.COPILOT_MODEL,provider:'copilot' as const,sdkVersion:'1.0.28' as const,selectionRule:'first-qualifying-merged:merged_at,pr_number,pr_id' as const,noticeHours:72 as const,fundedCancellationEnabled:false as const}};
 if(!sponsor){if(env.COPILOT_MODEL==='auto')throw new AuthError(409,'Auto review terms require a connected repository sponsor.');return termsSchema.parse({version:2,...base});}
 if(sponsor.revokedAt||sponsor.modelId!==env.COPILOT_MODEL)throw new AuthError(409,'Reconnect the Copilot sponsor for the configured model before funding.');
 if(env.FUNDED_CANCELLATION_ENABLED&&env.CANCELLATION_SANDBOX_REPO_ID===bounty.repoId){if(env.COPILOT_MODEL!=='auto'||!env.CANCELLATION_OPERATOR_GH_IDS.length)throw new AuthError(409,'Cancellation terms require Auto and an independent operator.');return termsSchema.parse({version:5,...base,policy:{...base.policy,fundedCancellationEnabled:true},sponsor:{kind:'user',id:sponsor.sponsorGhId,login:sponsor.sponsorLogin}});}
 return termsSchema.parse({version:env.COPILOT_MODEL==='auto'?4:3,...base,sponsor:{kind:'user',id:sponsor.sponsorGhId,login:sponsor.sponsorLogin}});
}
export const termsHash=(terms:FundedTerms)=>sha256(JSON.stringify(termsSchema.parse(terms)));
