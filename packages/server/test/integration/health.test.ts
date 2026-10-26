import { expect, it } from 'vitest';
import { startServer } from '../../src/main.js';
import { parseEnv } from '../../src/env.js';
import { syntheticEnv } from '../helpers/env.js';
import { createTestDatabase } from '../helpers/database.js';
it('health_reports_ready, health_reports_unavailable, shutdown_closes_pool', async () => {
  const fixture = await createTestDatabase();
  const runtime = await startServer(parseEnv(syntheticEnv()), fixture.database, 0);
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
  const fixture = await createTestDatabase();
  const runtime = await startServer(parseEnv(syntheticEnv()), fixture.database, 0);
  await runtime.close();
  await runtime.close();
  await expect(fixture.database.health()).rejects.toThrow();
  await fixture.close();
});
