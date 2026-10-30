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
try {
 const env=parseFundingEnv(process.env);const logger=createLogger(env);const database=createDatabase(env.DATABASE_URL);const github=createGitHub(env);const auth=createAuth(database,env);
 await database.health();const worker=startWorker(database,github,env,()=> { logger.error({event:'worker_poll_failed'}); },createFunding(database,env,createOrders(env)),createPhase5(database,github,env,auth),createPhase6(database,github,env),createPhase8(database,github,env).refunds,env.RECONCILIATION_DISCOVERY_ENABLED?createScheduler(database,env):undefined);
 const close=()=>{void worker.close().then(()=>database.close()).catch(()=>{logger.error({event:'worker_shutdown_failed'});process.exitCode=1;});};
 process.once('SIGTERM',close);process.once('SIGINT',close);logger.info({event:'worker_started'});
} catch {console.error('Worker startup failed; check GitHub and database configuration');process.exitCode=1;}
