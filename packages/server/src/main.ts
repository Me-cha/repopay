import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { parseGitHubRuntimeEnv, type GitHubRuntimeEnv } from './env.js';
import { createLogger } from './log.js';
import { createDatabase, type Database } from './db/client.js';
import { createGitHub, type GitHub } from './github/app.js';
import { ingestGitHub } from './github/handlers.js';
import { startWorker } from './jobs/runner.js';
import { buildApp } from './http/routes.js';
const { version } = z.object({ version: z.string() }).parse(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')));
export async function startServer(env: GitHubRuntimeEnv, database: Database, port = env.PORT, options: {runWorker?:boolean;github?:GitHub} = {}) {
  const app = buildApp({ database, version, webhook: {maxBytes:env.WEBHOOK_BODY_MAX_BYTES,ingest:(body,headers)=>ingestGitHub(database,env.GH_WEBHOOK_SECRET,env.RECONCILIATION_MAX_ATTEMPTS,body,headers)} });
  const server = app.listen(port);
  try {
    await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  } catch (error) { await database.close(); throw error; }
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No listening address');
  const worker=options.runWorker!==false && env.WORKER_MODE==='inline'?startWorker(database,options.github??createGitHub(env),env,()=> { createLogger(env).error({event:'worker_poll_failed'}); }):undefined;
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
    const env = parseGitHubRuntimeEnv(process.env);
    const logger = createLogger(env);
    const runtime = await startServer(env, createDatabase(env.DATABASE_URL));
    logger.info({ event: 'server_listening', port: env.PORT });
    const shutdown = () => { void runtime.close().catch(() => { logger.error({ event: 'shutdown_failed' }); process.exitCode = 1; }); };
    process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
  } catch { console.error('Startup failed: check required configuration and local port availability'); process.exitCode = 1; }
}
