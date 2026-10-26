import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/env.js';
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
    { RECONCILIATION_PAGE_LIMIT: '10000000' }, { NVIDIA_PRIMARY_MODEL: '' },
    { TEST_DATABASE_URL: 'postgresql://gitpay:gitpay@127.0.0.1:5433/gitpay' },
  ])('rejects invalid configuration %j', (change) => {
    expect(() => parseEnv({ ...syntheticEnv(), ...change })).toThrow();
  });
  it('requires fields without printing secret values', () => {
    expect(() => parseEnv({ ...syntheticEnv(), PP_BASE: 'secret-value' })).toThrow(/PP_BASE/);
    expect(() => parseEnv({ ...syntheticEnv(), PP_BASE: 'secret-value' })).not.toThrow(/secret-value/);
  });
});
