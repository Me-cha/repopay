import { sql } from 'drizzle-orm';
import { check, customType, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
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
