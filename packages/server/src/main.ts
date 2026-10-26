import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { parseEnv, type Env } from './env.js';
import { createLogger } from './log.js';
import { createDatabase, type Database } from './db/client.js';
import { buildApp } from './http/routes.js';
const { version } = z.object({ version: z.string() }).parse(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')));
export async function startServer(env: Env, database: Database, port = env.PORT) {
  const app = buildApp({ database, version });
  const server = app.listen(port);
  try {
    await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  } catch (error) { await database.close(); throw error; }
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No listening address');
  let closing: Promise<void> | undefined;
  return { url: `http://127.0.0.1:${String(address.port)}`, close(): Promise<void> {
    closing ??= (async () => {
      try { await new Promise<void>((resolve, reject) => { server.close(error => { if (error) reject(error); else resolve(); }); }); }
      finally { await database.close(); }
    })();
    return closing;
  } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const env = parseEnv(process.env);
    const logger = createLogger(env);
    const runtime = await startServer(env, createDatabase(env.DATABASE_URL));
    logger.info({ event: 'server_listening', port: env.PORT });
    const shutdown = () => { void runtime.close().catch(() => { logger.error({ event: 'shutdown_failed' }); process.exitCode = 1; }); };
    process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
  } catch { console.error('Startup failed: check required configuration and local port availability'); process.exitCode = 1; }
}
