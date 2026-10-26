import { createDatabase } from '../src/db/client.js';
import { migrateDatabase } from '../src/db/migrate.js';
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is required'); process.exitCode = 1; }
else {
  const database = createDatabase(url);
  try { await migrateDatabase(database); console.log('Migrations applied'); }
  catch { console.error('Migration failed; check database connectivity and migration state'); process.exitCode = 1; }
  finally { await database.close(); }
}
