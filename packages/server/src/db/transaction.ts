import type { Database } from './client.js';
export type Transaction = Parameters<Parameters<Database['withTransaction']>[0]>[0];
// database.withTransaction(fn) owns BEGIN/COMMIT/ROLLBACK on its existing pool.
// Resolve all external provider calls before entering the callback.
