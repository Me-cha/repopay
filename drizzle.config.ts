import { defineConfig } from 'drizzle-kit';
export default defineConfig({ dialect: 'postgresql', schema: './packages/server/src/db/schema.ts', out: './packages/server/src/db/migrations' });
