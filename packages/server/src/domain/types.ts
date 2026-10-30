import { z } from 'zod';
const centsSchema = z.number().int().min(0).max(2147483647).brand<'Cents'>();
const githubIdSchema = z.string().regex(/^[1-9]\d*$/).brand<'GitHubId'>();
const providerIdSchema = z.string().min(1).max(256).brand<'ProviderId'>();
export type Cents = z.infer<typeof centsSchema>;
export type GitHubId = z.infer<typeof githubIdSchema>;
export type ProviderId = z.infer<typeof providerIdSchema>;
export const cents = (value: unknown): Cents => centsSchema.parse(value);
export const githubId = (value: unknown): GitHubId => githubIdSchema.parse(value);
export const providerId = (value: unknown): ProviderId => providerIdSchema.parse(value);
export interface BountyRef { repoId: GitHubId; issueNumber: number }
export interface PrRef { repoId: GitHubId; prNumber: number }
export type ActionSource = 'github_comment' | 'github_label' | 'confirmation' | 'policy' | 'operator';
// Only trusted server authorization code may construct this context. Never accept it from a request body.
export interface Authorization { repoId: GitHubId; action: string; role: 'participant' | 'maintainer' | 'operator' | 'system'; checkedAt: Date }
export interface ActorContext { actorGhId: GitHubId; source: ActionSource; authorization: Authorization }
export type ActionResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string; retryable: boolean };
export interface Clock { now(): Date }
// Set when a review job fails; cleared once a later review reaches an outcome.
export const REVIEW_UNAVAILABLE_REASON = 'Solution review service unavailable; maintainer review and retry required';
export type { Transaction } from '../db/transaction.js';
