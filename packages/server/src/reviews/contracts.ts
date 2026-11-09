import { z } from 'zod';
import { verdictSchema } from '../verifier/schema.js';
import { COPILOT_SDK_VERSION } from '../models/copilot.js';
import { PROMPT_VERSION } from '../verifier/prompt.js';

export const executorIdentity=z.object({runId:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),backend:z.enum(['dedicated','render']),generation:z.number().int().positive(),artifactVersion:z.string().max(100)}).strict();
export const ownerRequest=z.object({ownerToken:z.uuid()}).strict();
export const reviewOutput=z.object({
 value:verdictSchema,model:z.string().min(1).max(200).refine(model=>model.toLowerCase()!=='auto'),
 provider:z.literal('copilot'),requestedModel:z.string().min(1).max(200),sdkVersion:z.literal(COPILOT_SDK_VERSION),billingOwnerId:z.string().regex(/^[1-9]\d*$/),
 promptHash:z.string().regex(/^[a-f0-9]{64}$/),promptVersion:z.literal(PROMPT_VERSION),elapsedMs:z.number().nonnegative().max(300000),
 usage:z.object({totalNanoAiu:z.number().nonnegative().nullable(),totalPremiumRequestCost:z.number().nonnegative().nullable(),totalApiDurationMs:z.number().nonnegative(),totalUserRequests:z.number().nonnegative(),inputTokens:z.number().nonnegative(),outputTokens:z.number().nonnegative(),cacheReadTokens:z.number().nonnegative(),cacheWriteTokens:z.number().nonnegative()}).strict(),
}).strict();
export type ReviewOutput=z.infer<typeof reviewOutput>;
