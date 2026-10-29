import { readFileSync } from 'node:fs';
import { parseEnv as parseDotEnv } from 'node:util';
export function syntheticEnv(): Record<string, string> {
  return { ...parseDotEnv(readFileSync('.env.example', 'utf8')),
    DATABASE_URL: 'postgresql://gitpay:gitpay@127.0.0.1:5433/gitpay',
    TEST_DATABASE_URL: 'postgresql://gitpay:gitpay@127.0.0.1:5433/gitpay_test',
    SESSION_SECRET: 's'.repeat(32), TOKEN_ENC_KEY: Buffer.alloc(32, 1).toString('base64'),
    PAYMENT_DATA_ENC_KEY: Buffer.alloc(32, 2).toString('base64'),
    GH_APP_ID: '9007199254740993', GH_APP_SLUG: 'gitpay-test', GH_PRIVATE_KEY: 'test-private-key',
    GH_WEBHOOK_SECRET: 'w'.repeat(32), GH_CLIENT_ID: 'test-client', GH_CLIENT_SECRET: 'test-client-secret',
    PP_CLIENT_ID: 'test-paypal-client', PP_SECRET: 'test-paypal-secret', PP_WEBHOOK_ID: 'test-webhook',
    COPILOT_GITHUB_TOKEN: 'ghu_synthetic', COPILOT_BILLING_OWNER_ID: '4', COPILOT_MODEL: 'test-model',
  };
}
