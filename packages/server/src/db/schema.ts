import { sql } from 'drizzle-orm';
import type { FundedTerms } from '../domain/funded-terms.js';
import { boolean, check, customType, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
const stringSerial = customType<{ data: string; driverData: string; default: true }>({ dataType: () => 'bigserial', fromDriver: value => value });
export const jobs = pgTable('jobs', {
  id: stringSerial('id').primaryKey(), kind: text('kind').notNull(), payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  dedupeKey: text('dedupe_key').unique(), status: text('status', { enum: ['queued', 'running', 'done', 'failed'] }).notNull().default('queued'),
  attempts: integer('attempts').notNull().default(0), maxAttempts: integer('max_attempts').notNull(),
  runAfter: timestamp('run_after', { withTimezone: true }).notNull().defaultNow(),
  leaseOwner: text('lease_owner'), leaseToken: text('lease_token'),
  leaseHeartbeatAt: timestamp('lease_heartbeat_at', { withTimezone: true }), lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastError: text('last_error'), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index('jobs_ready_idx').on(table.status, table.runAfter),
  check('jobs_status_check', sql`${table.status} in ('queued', 'running', 'done', 'failed')`),
  check('jobs_attempts_check', sql`${table.attempts} >= 0 and ${table.maxAttempts} > 0`),
  check('jobs_lease_check', sql`${table.status} <> 'running' or (${table.leaseOwner} is not null and ${table.leaseToken} is not null and ${table.leaseHeartbeatAt} is not null and ${table.lockedUntil} is not null)`),
]);
export const deliveries = pgTable('deliveries', {
  source: text('source', { enum: ['github', 'paypal'] }).notNull(), deliveryId: text('delivery_id').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.source, table.deliveryId] }), check('deliveries_source_check', sql`${table.source} in ('github', 'paypal')`)]);

const stringBigint = customType<{ data: string; driverData: string }>({ dataType: () => 'bigint', fromDriver: value => value });
export const installations = pgTable('installations', {
 id:stringBigint('id').primaryKey(),accountId:stringBigint('account_id').notNull(),accountLogin:text('account_login').notNull(),
 suspendedAt:timestamp('suspended_at',{withTimezone:true}),deletedAt:timestamp('deleted_at',{withTimezone:true}),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
});
export const bounties = pgTable('bounties', {
 id:stringSerial('id').primaryKey(),installationId:stringBigint('installation_id').notNull().references(()=>installations.id),repoId:stringBigint('repo_id').notNull(),repoFullName:text('repo_full_name').notNull(),issueNumber:integer('issue_number').notNull(),
 amountCents:integer('amount_cents').notNull(),currency:text('currency').notNull().default('USD'),status:text('status').notNull().default('OPEN'),version:integer('version').notNull().default(0),
 createdByGhId:stringBigint('created_by_gh_id').notNull(),createdVia:text('created_via').notNull(),statusCommentId:stringBigint('status_comment_id'),
 needsAttention:boolean('needs_attention').notNull().default(false),attentionReason:text('attention_reason'),
 captureRequestKey:text('capture_request_key'),captureId:text('capture_id'),fundedAt:timestamp('funded_at',{withTimezone:true}),
 currentFundingAttemptId:stringBigint('current_funding_attempt_id'),fundedTerms:jsonb('funded_terms').$type<FundedTerms>(),fundingActorGhId:stringBigint('funding_actor_gh_id'),fundingHold:boolean('funding_hold').notNull().default(false),
 createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('one_active_bounty_per_issue').on(t.repoId,t.issueNumber).where(sql`${t.status}<>'CANCELLED'`),check('bounty_amount_check',sql`${t.amountCents}>0 and ${t.currency}='USD'`),check('bounty_status_check',sql`${t.status} in ('OPEN','CANCELLED','CAPTURING','FUNDED')`),check('bounty_source_check',sql`${t.createdVia} in ('label','command')`)]);
export const bountyActivity = pgTable('bounty_activity', {
 id:stringSerial('id').primaryKey(),bountyId:stringBigint('bounty_id').notNull().references(()=>bounties.id),actorGhId:stringBigint('actor_gh_id'),source:text('source').notNull(),action:text('action').notNull(),metadata:jsonb('metadata').$type<Record<string,unknown>>().notNull().default({}),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
});
export type Bounty = typeof bounties.$inferSelect;

export const oauthStates = pgTable('oauth_states', {
 nonceHash: text('nonce_hash').primaryKey(), browserBindingHash: text('browser_binding_hash').notNull(),
 returnTo: text('return_to').notNull(), verifierEnc: text('verifier_enc').notNull(),
 expiresAt: timestamp('expires_at',{withTimezone:true}).notNull(), usedAt: timestamp('used_at',{withTimezone:true}),
});
export const sessions = pgTable('sessions', {
 id: text('id').primaryKey(), ghId: stringBigint('gh_id').notNull(), ghLogin: text('gh_login').notNull(),
 accessTokenEnc: text('access_token_enc').notNull(), refreshTokenEnc: text('refresh_token_enc').notNull(),
 accessExpiresAt: timestamp('access_expires_at',{withTimezone:true}).notNull(), refreshExpiresAt: timestamp('refresh_expires_at',{withTimezone:true}).notNull(),
 tokenGeneration: integer('token_generation').notNull().default(0), csrfSecret: text('csrf_secret').notNull(),
 createdAt: timestamp('created_at',{withTimezone:true}).notNull().defaultNow(), expiresAt: timestamp('expires_at',{withTimezone:true}).notNull(),
});

// Contributor payout destinations are self-declared and private. The stable
// GitHub account ID, not the mutable login, is the identity key.
export const contributors = pgTable('contributors', {
 ghId:stringBigint('gh_id').primaryKey(),ghLogin:text('gh_login').notNull(),paypalEmailEnc:text('paypal_email_enc').notNull(),connectionVersion:integer('connection_version').notNull().default(1),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[check('contributors_connection_version_check',sql`${t.connectionVersion}>0`)]);

export const submissions = pgTable('submissions', {
 id:stringSerial('id').primaryKey(),bountyId:stringBigint('bounty_id').notNull().references(()=>bounties.id),repoId:stringBigint('repo_id').notNull(),prId:stringBigint('pr_id').notNull(),prNumber:integer('pr_number').notNull(),authorGhId:stringBigint('author_gh_id').notNull(),authorLogin:text('author_login').notNull(),status:text('status').notNull().default('OPEN'),headSha:text('head_sha').notNull(),baseSha:text('base_sha').notNull(),mergedAt:timestamp('merged_at',{withTimezone:true}),closedAt:timestamp('closed_at',{withTimezone:true}),observedAt:timestamp('observed_at',{withTimezone:true}).notNull().defaultNow(),evidenceVersion:integer('evidence_version').notNull().default(0),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('submission_bounty_pr_unique').on(t.bountyId,t.prId),check('submission_status_check',sql`${t.status} in ('OPEN','CLOSED','MERGED')`)]);
export type Submission=typeof submissions.$inferSelect;
export const submissionEvidence = pgTable('submission_evidence', {
 id:stringSerial('id').primaryKey(),submissionId:stringBigint('submission_id').notNull().references(()=>submissions.id),version:integer('version').notNull(),headSha:text('head_sha').notNull(),baseSha:text('base_sha').notNull(),testedSha:text('tested_sha'),title:text('title').notNull(),body:text('body').notNull(),diffText:text('diff_text').notNull(),inputTruncated:boolean('input_truncated').notNull(),evidenceSufficient:boolean('evidence_sufficient').notNull(),eligibleAuthors:jsonb('eligible_authors').$type<{ghId:string;login:string}[]>().notNull(),unverifiedAuthors:jsonb('unverified_authors').$type<string[]>().notNull(),ci:jsonb('ci').$type<Record<string,unknown>>().notNull(),snapshotHash:text('snapshot_hash').notNull(),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('submission_evidence_version_unique').on(t.submissionId,t.version)]);
export const verifications = pgTable('verifications', {
 id:stringSerial('id').primaryKey(),submissionId:stringBigint('submission_id').notNull().references(()=>submissions.id),evidenceId:stringBigint('evidence_id').notNull().references(()=>submissionEvidence.id),headSha:text('head_sha').notNull(),attempt:integer('attempt').notNull(),status:text('status').notNull().default('PENDING'),result:jsonb('result').$type<Record<string,unknown>>(),usageMetrics:jsonb('usage_metrics').$type<Record<string,unknown>>(),provider:text('provider').notNull(),model:text('model').notNull(),sdkVersion:text('sdk_version').notNull(),sponsorGhId:stringBigint('sponsor_gh_id').notNull(),promptHash:text('prompt_hash').notNull(),elapsedMs:integer('elapsed_ms'),errorCode:text('error_code'),checkRunId:stringBigint('check_run_id'),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),completedAt:timestamp('completed_at',{withTimezone:true}),
},t=>[uniqueIndex('verification_attempt_unique').on(t.submissionId,t.headSha,t.attempt),check('verification_status_check',sql`${t.status} in ('PENDING','DONE','ERROR')`)]);

// A Copilot sponsor is separate from a browser session. Its credentials remain
// usable for background reviews after the owner signs out of GitPay.
export const copilotSponsorStates = pgTable('copilot_sponsor_states', {
 nonceHash:text('nonce_hash').primaryKey(),browserBindingHash:text('browser_binding_hash').notNull(),
 sessionId:text('session_id').notNull(),actorGhId:stringBigint('actor_gh_id').notNull(),repoId:stringBigint('repo_id').notNull(),installationId:stringBigint('installation_id').notNull(),returnTo:text('return_to').notNull(),
 verifierEnc:text('verifier_enc').notNull(),expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),usedAt:timestamp('used_at',{withTimezone:true}),
});
export const copilotSponsors = pgTable('copilot_sponsors', {
 repoId:stringBigint('repo_id').primaryKey(),installationId:stringBigint('installation_id').notNull(),sponsorGhId:stringBigint('sponsor_gh_id').notNull(),sponsorLogin:text('sponsor_login').notNull(),
 accessTokenEnc:text('access_token_enc').notNull(),refreshTokenEnc:text('refresh_token_enc').notNull(),accessExpiresAt:timestamp('access_expires_at',{withTimezone:true}).notNull(),refreshExpiresAt:timestamp('refresh_expires_at',{withTimezone:true}).notNull(),
 tokenGeneration:integer('token_generation').notNull().default(0),modelId:text('model_id').notNull(),modelVerifiedAt:timestamp('model_verified_at',{withTimezone:true}).notNull(),revokedAt:timestamp('revoked_at',{withTimezone:true}),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[check('copilot_sponsor_model_check',sql`${t.modelId} <> ''`)]);

export const actionTokens = pgTable('action_tokens', {
 tokenHash:text('token_hash').primaryKey(),bountyId:stringBigint('bounty_id').notNull().references(()=>bounties.id),
 action:text('action').notNull(),params:jsonb('params').$type<Record<string,unknown>>().notNull(),
 bountyVersion:integer('bounty_version').notNull(),requestedByGhId:stringBigint('requested_by_gh_id').notNull(),
 expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),usedAt:timestamp('used_at',{withTimezone:true}),usedByGhId:stringBigint('used_by_gh_id'),
 createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[check('action_kind_check',sql`${t.action} in ('cancel_draft','fund')`)]);

export const fundingAttempts=pgTable('funding_attempts',{
 id:stringSerial('id').primaryKey(),bountyId:stringBigint('bounty_id').notNull().references(()=>bounties.id),attemptNumber:integer('attempt_number').notNull(),actorGhId:stringBigint('actor_gh_id').notNull(),
 checkoutOrigin:text('checkout_origin').notNull(),terms:jsonb('terms').$type<FundedTerms>().notNull(),termsHash:text('terms_hash').notNull(),amountCents:integer('amount_cents').notNull(),currency:text('currency').notNull().default('USD'),
 orderRequestKey:text('order_request_key').notNull().unique(),captureRequestKey:text('capture_request_key').notNull().unique(),orderId:text('order_id').unique(),captureId:text('capture_id').unique(),approvalUrl:text('approval_url'),
 orderSubmissionBoundaryAt:timestamp('order_submission_boundary_at',{withTimezone:true}),captureSubmissionBoundaryAt:timestamp('capture_submission_boundary_at',{withTimezone:true}),orderSafeRetryUntil:timestamp('order_safe_retry_until',{withTimezone:true}),captureSafeRetryUntil:timestamp('capture_safe_retry_until',{withTimezone:true}),
 observationVersion:integer('observation_version').notNull().default(0),status:text('status').notNull().default('NEW'),active:boolean('active').notNull().default(true),attention:text('attention'),
 nextReconcileAt:timestamp('next_reconcile_at',{withTimezone:true}).notNull().defaultNow(),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('one_active_funding_attempt').on(t.bountyId).where(sql`${t.active}`),uniqueIndex('funding_attempt_number').on(t.bountyId,t.attemptNumber),check('funding_amount_check',sql`${t.amountCents}>0 and ${t.currency}='USD'`),check('funding_status_check',sql`${t.status} in ('NEW','CREATED','APPROVED','CAPTURING','PENDING','COMPLETED','VOIDED','DECLINED','HOLD')`)]);
export type FundingIntent=typeof fundingAttempts.$inferSelect;
