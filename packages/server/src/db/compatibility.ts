import { readMigrationFiles } from 'drizzle-orm/migrator';
import { fileURLToPath } from 'node:url';
import type { Database } from './client.js';
const expected=readMigrationFiles({migrationsFolder:fileURLToPath(new URL('./migrations/',import.meta.url))});
// Exact artifact match deliberately refuses older binaries against newer schemas.
// A rollback requires an explicitly tested compatibility release, not erased rows.
export async function checkMigrations(db:Database):Promise<void>{
 const {rows}=await db.pool.query<{hash:string;created_at:string}>('SELECT hash,created_at FROM __drizzle_migrations ORDER BY created_at,id');
 if(rows.length!==expected.length||rows.some((r,i)=>r.hash!==expected[i]?.hash||Number(r.created_at)!==expected[i].folderMillis))throw new Error('Database schema is incompatible with this artifact');
}
