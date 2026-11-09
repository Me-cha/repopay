import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client.js';
import type { Transaction } from '../db/transaction.js';
import { jobs } from '../db/schema.js';
import type { JobSpec, LeasedJob } from './kinds.js';
export async function enqueue(tx: Transaction, job: JobSpec): Promise<void> {
 await tx.insert(jobs).values(job).onConflictDoNothing({ target: jobs.dedupeKey });
}
const leaseSchema = z.object({ id:z.string(),kind:z.string(),payload:z.record(z.string(),z.unknown()),lease_owner:z.string(),lease_token:z.string(),attempts:z.number().int(),max_attempts:z.number().int() });
export async function claimJob(db: Database, owner: string, leaseSec: number,filter:{only?:string;exclude?:string}={}): Promise<LeasedJob | null> {
 const kindFilter=filter.only?sql`kind=${filter.only}`:filter.exclude?sql`kind<>${filter.exclude}`:sql`(kind<>'verify_submission' or not exists(select 1 from review_execution_control where paused or backend<>'shared'))`;
 return db.withTransaction(async tx => {
  // Serialize shared-backend acquisition with drain/switch operations. Dedicated
  // dispatch acquisition separately checks control before creating its record.
  if(!filter.only&&!filter.exclude)await tx.execute(sql`select pg_advisory_xact_lock(hashtext('repopay-review-admission'))`);
  await tx.execute(sql`update jobs set status='failed',last_error='Lease expired at attempt limit; inspect and retry safely',updated_at=now() where ${kindFilter} and status='running' and locked_until<=now() and attempts>=max_attempts`);
  const result = await tx.execute(sql`update jobs set status='running',lease_owner=${owner},lease_token=${randomUUID()},lease_heartbeat_at=now(),locked_until=now()+${leaseSec}*interval '1 second',attempts=attempts+1,updated_at=now() where id=(select id from jobs where ${kindFilter} and attempts<max_attempts and ((status='queued' and run_after<=now()) or (status='running' and locked_until<=now())) order by run_after,id for update skip locked limit 1) returning *`);
  const row: unknown = result.rows[0]; if (!row) return null; const v=leaseSchema.parse(row);
  return {id:v.id,kind:v.kind,payload:v.payload,leaseOwner:v.lease_owner,leaseToken:v.lease_token,attempts:v.attempts,maxAttempts:v.max_attempts};
 });
}
function owned(job: LeasedJob) { return and(eq(jobs.id,job.id),eq(jobs.status,'running'),eq(jobs.leaseOwner,job.leaseOwner),eq(jobs.leaseToken,job.leaseToken),sql`${jobs.lockedUntil}>now()`); }
export async function assertLease(tx: Transaction, job: LeasedJob): Promise<void> {
 const [row] = await tx.select({id:jobs.id}).from(jobs).where(owned(job)).for('update');
 if (!row) throw new Error('Job lease lost');
}
export async function heartbeat(db: Database, job: LeasedJob, seconds: number): Promise<boolean> {
 const rows=await db.orm.update(jobs).set({leaseHeartbeatAt:sql`now()`,lockedUntil:sql`now()+${seconds}*interval '1 second'`}).where(owned(job)).returning({id:jobs.id}); return rows.length===1;
}
export async function finishJob(db: Database, job: LeasedJob, failed = false): Promise<boolean> {
 const exhausted=failed && job.attempts>=job.maxAttempts;
 const rows=await db.orm.update(jobs).set({status:failed ? exhausted?'failed':'queued':'done',lastError:failed?'GitHub operation failed; inspect access/provider availability and retry safely':null,runAfter:sql`now()+${Math.min(2**job.attempts*2,300)}*interval '1 second'`,lockedUntil:null,leaseOwner:null,leaseToken:null,updatedAt:sql`now()`}).where(owned(job)).returning({id:jobs.id});return rows.length===1;
}
