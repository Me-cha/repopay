import { expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestDatabase } from '../helpers/database.js';
import { migrateDatabase } from '../../src/db/migrate.js';
import { enqueue, claimJob, finishJob, heartbeat, assertLease } from '../../src/jobs/queue.js';
it('two workers claim once; expired lease fences old completion and domain writes', async () => {
 const f = await createTestDatabase(); try {
  await migrateDatabase(f.database);
  await f.database.withTransaction(tx => enqueue(tx, { kind: 'sync_bounty', payload: { bountyId: '1' }, dedupeKey: 'test', maxAttempts: 3 }));
  const claims = await Promise.all(['a','b'].map(w => claimJob(f.database, w, 30)));
  expect(claims.filter(Boolean)).toHaveLength(1); const old = claims.find(Boolean); if (!old) throw new Error('missing claim');
  await f.database.orm.execute(sql`update jobs set locked_until=now()-interval '1 second'`);
  const fresh = await claimJob(f.database, 'new', 30); if (!fresh) throw new Error('missing reclaim');
  expect(await heartbeat(f.database, old, 30)).toBe(false);
  expect(await finishJob(f.database, old)).toBe(false);
  await expect(f.database.withTransaction(tx => assertLease(tx, old))).rejects.toThrow();
  expect(await finishJob(f.database, fresh)).toBe(true);
 } finally { await f.close(); }
});
it('crashes at max attempts become failed rather than infinite reclaims', async () => {
 const f = await createTestDatabase(); try {
  await migrateDatabase(f.database);
  await f.database.withTransaction(tx => enqueue(tx, { kind: 'sync_bounty', payload: { bountyId: '1' }, dedupeKey: 'test', maxAttempts: 1 }));
  await claimJob(f.database, 'a', 30);
  await f.database.orm.execute(sql`update jobs set locked_until=now()-interval '1 second'`);
  expect(await claimJob(f.database, 'b', 30)).toBeNull();
  const result = await f.database.pool.query<{status: string}>('select status from jobs'); expect(result.rows[0]?.status).toBe('failed');
 } finally { await f.close(); }
});
