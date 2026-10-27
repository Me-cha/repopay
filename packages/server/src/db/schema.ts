import { sql } from 'drizzle-orm';
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
 createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('one_active_bounty_per_issue').on(t.repoId,t.issueNumber).where(sql`${t.status}<>'CANCELLED'`),check('bounty_amount_check',sql`${t.amountCents}>0 and ${t.currency}='USD'`),check('bounty_status_check',sql`${t.status} in ('OPEN','CANCELLED')`),check('bounty_source_check',sql`${t.createdVia} in ('label','command')`)]);
export const bountyActivity = pgTable('bounty_activity', {
 id:stringSerial('id').primaryKey(),bountyId:stringBigint('bounty_id').notNull().references(()=>bounties.id),actorGhId:stringBigint('actor_gh_id'),source:text('source').notNull(),action:text('action').notNull(),metadata:jsonb('metadata').$type<Record<string,unknown>>().notNull().default({}),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
});
export type Bounty = typeof bounties.$inferSelect;
