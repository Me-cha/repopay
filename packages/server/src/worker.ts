import { parseGitHubRuntimeEnv } from './env.js';
import { createDatabase } from './db/client.js';
import { createLogger } from './log.js';
import { createGitHub } from './github/app.js';
import { startWorker } from './jobs/runner.js';
try {
 const env=parseGitHubRuntimeEnv(process.env);const logger=createLogger(env);const database=createDatabase(env.DATABASE_URL);
 await database.health();const worker=startWorker(database,createGitHub(env),env,()=> { logger.error({event:'worker_poll_failed'}); });
 const close=()=>{void worker.close().then(()=>database.close()).catch(()=>{logger.error({event:'worker_shutdown_failed'});process.exitCode=1;});};
 process.once('SIGTERM',close);process.once('SIGINT',close);logger.info({event:'worker_started'});
} catch {console.error('Worker startup failed; check GitHub and database configuration');process.exitCode=1;}
