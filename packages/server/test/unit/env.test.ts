import { describe, expect, it } from 'vitest';
import { parseEnv, parsePreflightEnv } from '../../src/env.js';
import { syntheticEnv } from '../helpers/env.js';
describe('configuration boundary', () => {
  it('preserves large IDs and parses explicit flags', () => {
    const env = parseEnv(syntheticEnv());
    expect(env.GH_APP_ID).toBe('9007199254740993');
    expect(env.FUNDED_CANCELLATION_ENABLED).toBe(false);
    expect(env.CANCELLATION_OPERATOR_GH_IDS).toEqual([]);
  });
  it.each([
    { PP_BASE: 'https://api-m.paypal.com' },
    { FUNDED_CANCELLATION_ENABLED: 'true', CANCELLATION_OPERATOR_GH_IDS: '' },
    { CANCELLATION_OPERATOR_GH_IDS: '123,abc' },
    { TOKEN_ENC_KEY: 'not-base64' },
    { PAYMENT_DATA_ENC_KEY: Buffer.alloc(32, 1).toString('base64') },
    { PORT: '0' }, { PORT: '3000.5' }, { JOB_LEASE_SEC: '-1' },
    { PROVIDER_TIMEOUT_MS: 'Infinity' }, { POLICY_CI_REQUIRED: 'yes' },
    { RECONCILIATION_PAGE_LIMIT: '10000000' },
    { TEST_DATABASE_URL: 'postgresql://repopay:repopay@127.0.0.1:5433/repopay' },
  ])('rejects invalid configuration %j', (change) => {
    expect(() => parseEnv({ ...syntheticEnv(), ...change })).toThrow();
  });
  it('requires fields without printing secret values', () => {
    expect(() => parseEnv({ ...syntheticEnv(), PP_BASE: 'secret-value' })).toThrow(/PP_BASE/);
    expect(() => parseEnv({ ...syntheticEnv(), PP_BASE: 'secret-value' })).not.toThrow(/secret-value/);
  });
});

it('validates preflight scope without webhook, OAuth, database or application secrets', () => {
  const unrelated = new Set(['COPILOT_GITHUB_TOKEN', 'COPILOT_MODEL', 'COPILOT_BILLING_OWNER_ID', 'PP_WEBHOOK_ID', 'GH_WEBHOOK_SECRET', 'GH_CLIENT_SECRET', 'DATABASE_URL', 'TEST_DATABASE_URL', 'SESSION_SECRET', 'TOKEN_ENC_KEY', 'PAYMENT_DATA_ENC_KEY']);
  const input = Object.fromEntries(Object.entries(syntheticEnv()).filter(([key]) => !unrelated.has(key)));
  expect(parsePreflightEnv(input).PP_BASE).toBe('https://api-m.sandbox.paypal.com');
  expect(parsePreflightEnv(input)).not.toHaveProperty('PP_WEBHOOK_ID');
  expect(() => parseEnv(input)).toThrow();
});
it.each([
  { PP_BASE: 'https://api-m.paypal.com' }, { PP_SECRET: '' }, { GH_PRIVATE_KEY: '' },
  { GH_CLIENT_ID: '' }, { PROVIDER_TIMEOUT_MS: '0' },
])('preflight still validates every consumed credential and boundary: %j', change => {
  expect(() => parsePreflightEnv({ ...syntheticEnv(), ...change })).toThrow();
});
it('full application still requires registered webhook identity', () => {
  expect(() => parseEnv({ ...syntheticEnv(), PP_WEBHOOK_ID: '' })).toThrow(/PP_WEBHOOK_ID/);
});
