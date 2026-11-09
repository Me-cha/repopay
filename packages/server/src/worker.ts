import { checkMigrations } from './db/compatibility.js';
import { createScheduler } from './jobs/scheduler.js';
import { createPhase8 } from './cancellation/runtime.js';
import { createPhase6 } from './settlement/service.js';
import { createFunding } from './settlement/funding.js';
import { createOrders } from './paypal/orders.js';
import { parseFundingEnv } from './env.js';
import { createDatabase } from './db/client.js';
import { createLogger } from './log.js';
import { createGitHub } from './github/app.js';
import { startWorker } from './jobs/runner.js';
import { createAuth } from './github/oauth.js';
import { createPhase5 } from './verifier/service.js';
import { configureReviews,pauseReviews } from './reviews/store.js';
import { startReviewDispatcher } from './reviews/dispatcher.js';
let startupDatabase:ReturnType<typeof createDatabase>|undefined;
try {
 const env=parseFundingEnv(process.env);const logger=createLogger(env);const database=createDatabase(env.DATABASE_URL);startupDatabase=database;const github=createGitHub(env);const auth=createAuth(database,env);
 await database.health();await checkMigrations(database);
 await configureReviews(database,env.REVIEW_BACKEND,env.REVIEW_GENERATION);if(env.RECOVERY_MODE==='hold')await pauseReviews(database);
 const worker=startWorker(database,github,env,()=> { logger.error({event:'worker_poll_failed'}); },createFunding(database,env,createOrders(env)),createPhase5(database,github,env,auth),createPhase6(database,github,env),createPhase8(database,github,env).refunds,env.RECONCILIATION_DISCOVERY_ENABLED?createScheduler(database,env):undefined);
 const dispatcher=env.RECOVERY_MODE!=='hold'&&env.REVIEW_BACKEND!=='shared'?startReviewDispatcher(database,env,()=> { logger.error({event:'review_dispatch_failed'}); }):undefined;
 const close=()=>{void (async()=>{await dispatcher?.close();await worker.close();await database.close();})().catch(()=>{logger.error({event:'worker_shutdown_failed'});process.exitCode=1;});};
 process.once('SIGTERM',close);process.once('SIGINT',close);logger.info({event:env.RECOVERY_MODE==='hold'?'worker_recovery_hold':'worker_started'});
 if(env.RECOVERY_MODE==='hold'){const timer=setInterval(()=>{},env.POLL_INTERVAL_MS);process.once('SIGTERM',()=> { clearInterval(timer); });process.once('SIGINT',()=> { clearInterval(timer); });}
} catch {await startupDatabase?.close();console.error('Worker startup failed; check GitHub and database configuration');process.exitCode=1;}
