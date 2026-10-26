import { randomUUID } from 'node:crypto';
import { createDatabase } from '../../src/db/client.js';
export function validateTestDatabaseUrl(value: string | undefined): string {
  if (!value) throw new Error('TEST_DATABASE_URL is required for integration tests');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !/^\/[a-z0-9_]+_test$/.test(url.pathname) || url.search || url.hash) throw new Error('Refusing unsafe TEST_DATABASE_URL; use a local *_test database without query options');
  return url.toString();
}
export async function createTestDatabase() {
  const url = validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);
  const schemaName = 'test_' + randomUUID().replaceAll('-', '');
  const admin = createDatabase(url);
  await admin.pool.query(`CREATE SCHEMA "${schemaName}"`);
  const database = createDatabase(url, schemaName);
  let closed = false;
  return { database, async close() {
    if (closed) return;
    closed = true;
    try { await database.close(); await admin.pool.query(`DROP SCHEMA "${schemaName}" CASCADE`); }
    finally { await admin.close(); }
  } };
}
