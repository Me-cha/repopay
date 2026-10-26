import express, { type Express } from 'express';
import type { Database } from '../db/client.js';
export interface AppDependencies { database: Pick<Database, 'health'>; version: string }
export function buildApp(deps: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.get('/healthz', async (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    try { await deps.database.health(); response.json({ status: 'ready', version: deps.version }); }
    catch { response.status(503).json({ status: 'unavailable', version: deps.version }); }
  });
  return app;
}
