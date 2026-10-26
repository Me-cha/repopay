import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from './client.js';
export async function migrateDatabase(database: Database): Promise<void> {
  const client = await database.pool.connect();
  const lock = `gitpay:migrate:${database.schemaName}`;
  try {
    await client.query('select pg_advisory_lock(hashtext($1))', [lock]);
    await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL('./migrations/', import.meta.url)), migrationsSchema: database.schemaName });
  } finally {
    try { await client.query('select pg_advisory_unlock(hashtext($1))', [lock]); }
    finally { client.release(); }
  }
}
