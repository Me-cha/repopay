import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
export function createDatabase(connectionString: string, schemaName = 'public') {
  if (!/^(public|test_[a-f0-9]{32})$/.test(schemaName)) throw new Error('Invalid database schema');
  const pool = new pg.Pool({ connectionString, options: `-c search_path=${schemaName}`, connectionTimeoutMillis: 5000, query_timeout: 10000, max: 5 });
  // Idle connection failures must not become unhandled EventEmitter errors; readiness exposes outages.
  pool.on('error', () => {});
  const orm = drizzle(pool, { schema });
  let closing: Promise<void> | undefined;
  return { pool, orm, schemaName, withTransaction: orm.transaction.bind(orm),
    async health(): Promise<void> { await pool.query('select 1'); },
    async close(): Promise<void> { closing ??= pool.end(); await closing; },
  };
}
export type Database = ReturnType<typeof createDatabase>;
