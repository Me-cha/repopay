import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: ['packages/server/test/{unit,integration}/**/*.test.ts'],
  setupFiles: ['packages/server/test/helpers/network.ts'],
  testTimeout: 15000,
  hookTimeout: 30000,
} });
