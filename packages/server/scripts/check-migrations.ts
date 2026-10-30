import { createDatabase } from '../src/db/client.js';
import { checkMigrations } from '../src/db/compatibility.js';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const db=createDatabase(process.env.DATABASE_URL);
try{await checkMigrations(db);console.log('Migration history matches this artifact');}catch{console.error('Migration compatibility check failed; keep services stopped and inspect the release');process.exitCode=1;}finally{await db.close();}
