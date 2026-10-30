import { migrateDatabase } from '../../src/db/migrate.js';
import { expect, it } from 'vitest';
import { startServer } from '../../src/main.js';
import { parseEnv } from '../../src/env.js';
import { syntheticEnv } from '../helpers/env.js';
import { createTestDatabase } from '../helpers/database.js';
it('health_reports_ready, health_reports_unavailable, shutdown_closes_pool', async () => {
  const fixture = await createTestDatabase();await migrateDatabase(fixture.database);
  const runtime = await startServer(parseEnv(syntheticEnv()), fixture.database, 0, {runWorker:false});
  try {
    const response = await fetch(runtime.url + '/healthz');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ready', version: '0.0.0' });
    expect(response.headers.get('x-powered-by')).toBeNull();
    await fixture.database.close();
    const unavailable = await fetch(runtime.url + '/healthz');
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({ status: 'unavailable', version: '0.0.0' });
  } finally { await runtime.close(); await fixture.close(); }
  await expect(fixture.database.health()).rejects.toThrow();
});
it('shutdown closes an open pool and is safe to repeat', async () => {
  const fixture = await createTestDatabase();await migrateDatabase(fixture.database);
  const runtime = await startServer(parseEnv(syntheticEnv()), fixture.database, 0, {runWorker:false});
  await runtime.close();
  await runtime.close();
  await expect(fixture.database.health()).rejects.toThrow();
  await fixture.close();
});
it('unmigrated startup fails closed and changed migration history makes health unavailable',async()=>{const empty=await createTestDatabase();try{await expect(startServer(parseEnv(syntheticEnv()),empty.database,0,{runWorker:false})).rejects.toThrow();}finally{await empty.close();}const f=await createTestDatabase();await migrateDatabase(f.database);const runtime=await startServer(parseEnv(syntheticEnv()),f.database,0,{runWorker:false});try{await f.database.pool.query("UPDATE __drizzle_migrations SET hash='tampered' WHERE id=(SELECT max(id) FROM __drizzle_migrations)");expect((await fetch(runtime.url+'/healthz')).status).toBe(503);}finally{await runtime.close();await f.close();}});
