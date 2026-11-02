import { sql } from 'drizzle-orm';
import { expect, it } from 'vitest';
import { createTestDatabase, validateTestDatabaseUrl } from '../helpers/database.js';
import { jobs, deliveries } from '../../src/db/schema.js';
import { migrateDatabase } from '../../src/db/migrate.js';
it('fresh_migration_boots and migration_rerun_safe', async () => {
  const fixture = await createTestDatabase();
  try {
    await migrateDatabase(fixture.database);
    await migrateDatabase(fixture.database);
    expect(await fixture.database.orm.select().from(jobs)).toEqual([]);
    expect(await fixture.database.orm.select().from(deliveries)).toEqual([]);
  } finally { await fixture.close(); }
});
it('failed_transaction_leaves_no_rows and durable payload survives commit', async () => {
  const fixture = await createTestDatabase();
  try {
    await migrateDatabase(fixture.database);
    await expect(fixture.database.withTransaction(async tx => {
      await tx.insert(jobs).values({ kind: 'test', payload: { repoId: '9007199254740993' }, maxAttempts: 3 });
      throw new Error('rollback');
    })).rejects.toThrow('rollback');
    expect(await fixture.database.orm.select().from(jobs)).toEqual([]);
    await fixture.database.withTransaction(async tx => {
      await tx.insert(jobs).values({ kind: 'test', payload: { repoId: '9007199254740993' }, maxAttempts: 3 });
    });
    const [job] = await fixture.database.orm.select().from(jobs);
    expect(job?.payload).toEqual({ repoId: '9007199254740993' });
    expect(typeof job?.id).toBe('string');
    await expect(fixture.database.orm.execute(sql`update jobs set status='running'`)).rejects.toThrow();
  } finally { await fixture.close(); }
});
it('fixtures cannot erase each other', async () => {
  const [first, second] = await Promise.all([createTestDatabase(), createTestDatabase()]);
  try {
    await Promise.all([migrateDatabase(first.database), migrateDatabase(second.database)]);
    await second.database.orm.insert(jobs).values({ kind: 'keep', payload: {}, maxAttempts: 1 });
    await first.close();
    expect(await second.database.orm.select().from(jobs)).toHaveLength(1);
  } finally { await first.close(); await second.close(); }
});
it.each([undefined, 'postgresql://user:pass@127.0.0.1/repopay', 'postgresql://user:pass@example.com/repopay_test', 'postgresql://user:pass@localhost/repopay_test?options=-csearch_path%3Dpublic'])('unsafe_test_database_refused_before_reset %s', url => {
  expect(() => validateTestDatabaseUrl(url)).toThrow();
});
