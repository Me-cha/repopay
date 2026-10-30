import { createFunding } from './settlement/funding.js';
import { createOrders,type Orders } from './paypal/orders.js';
import { createPayPalIntake } from './paypal/webhooks.js';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { parseFundingEnv, type AuthEnv,type FundingEnv } from './env.js';
import { createLogger } from './log.js';
import { createDatabase, type Database } from './db/client.js';
import { createGitHub, type GitHub } from './github/app.js';
import { ingestGitHub } from './github/handlers.js';
import { startWorker } from './jobs/runner.js';
import { buildApp } from './http/routes.js';
import { createAuth,type OAuthProvider } from './github/oauth.js';
import { createPhase5 } from './verifier/service.js';
const { version } = z.object({ version: z.string() }).parse(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')));
export async function startServer(env: AuthEnv|FundingEnv, database: Database, port = env.PORT, options: {runWorker?:boolean;github?:GitHub;oauth?:OAuthProvider;orders?:Orders} = {}) {
  const github=options.github??createGitHub(env);
  const fundingEnv='PP_BASE' in env?env:undefined;
  const funding=fundingEnv?createFunding(database,fundingEnv,options.orders??createOrders(fundingEnv)):undefined;
  const auth=createAuth(database,env,options.oauth);
  const phase5=fundingEnv?createPhase5(database,github,fundingEnv,auth):undefined;
  const app = buildApp({ database, version,...(fundingEnv?{funding:{env:fundingEnv,ingest:createPayPalIntake(database,fundingEnv)}}:{}), authentication:{database,env,auth,github}, webhook: {maxBytes:env.WEBHOOK_BODY_MAX_BYTES,ingest:(body,headers)=>ingestGitHub(database,env.GH_WEBHOOK_SECRET,env.RECONCILIATION_MAX_ATTEMPTS,body,headers,env.GH_APP_ID)} });
  const server = app.listen(port);
  try {
    await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  } catch (error) { await database.close(); throw error; }
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No listening address');
  const worker=options.runWorker!==false && env.WORKER_MODE==='inline'?startWorker(database,github,env,()=> { createLogger(env).error({event:'worker_poll_failed'}); },funding,phase5):undefined;
  let closing: Promise<void> | undefined;
  return { url: `http://127.0.0.1:${String(address.port)}`, close(): Promise<void> {
    closing ??= (async () => {
      await worker?.close();
      try { await new Promise<void>((resolve, reject) => { server.close(error => { if (error) reject(error); else resolve(); }); }); }
      finally { await database.close(); }
    })();
    return closing;
  } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const env = parseFundingEnv(process.env);
    const logger = createLogger(env);
    const runtime = await startServer(env, createDatabase(env.DATABASE_URL));
    logger.info({ event: 'server_listening', port: env.PORT });
    const shutdown = () => { void runtime.close().catch(() => { logger.error({ event: 'shutdown_failed' }); process.exitCode = 1; }); };
    process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
  } catch { console.error('Startup failed: check required configuration and local port availability'); process.exitCode = 1; }
}
