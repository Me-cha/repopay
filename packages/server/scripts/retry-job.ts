import { parseFundingEnv } from '../src/env.js';
import { createDatabase } from '../src/db/client.js';
import { bountyAttention,retrySafeJob } from '../src/operations/attention.js';
const id=process.argv[2];if(!id||!/^\d+$/.test(id)||process.argv.length>4||(process.argv[3]!==undefined&&process.argv[3]!=='--inspect-bounty'))throw new Error('Usage: pnpm ops:retry-job <failed-job-id>');
const env=parseFundingEnv(process.env),db=createDatabase(env.DATABASE_URL);
try{console.log(JSON.stringify(process.argv[3]==='--inspect-bounty'?await bountyAttention(db,id):await retrySafeJob(db,id,env.RECONCILIATION_MAX_ATTEMPTS)));}catch{console.error('Safe retry unavailable. Inspect the existing job and intent; no replacement operation was created.');process.exitCode=1;}finally{await db.close();}
