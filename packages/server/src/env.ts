import { z } from 'zod';
const text = z.string().trim().min(1);
const integer = (min: number, max: number) => z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(min).max(max));
const fraction = z.string().regex(/^(0(\.\d+)?|1(\.0+)?)$/).transform(Number);
const flag = z.enum(['true', 'false']).transform(value => value === 'true');
const key = z.string().refine(value => /^[A-Za-z0-9+/]{43}=$/.test(value) && Buffer.from(value, 'base64').length === 32, 'must be a 32-byte base64 key');
const database = z.url().refine(value => ['postgres:', 'postgresql:'].includes(new URL(value).protocol));
const nvidiaSchema = z.object({
  NVIDIA_API_KEY: text, NVIDIA_BASE: z.literal('https://integrate.api.nvidia.com/v1'),
  NVIDIA_MODEL: z.literal('nvidia/nemotron-3-ultra-550b-a55b'),
  NVIDIA_MAX_TOKENS: integer(128, 16384), NVIDIA_TIMEOUT_MS: integer(1000, 120000),
  PROVIDER_RESPONSE_MAX_BYTES: integer(1, 10485760),
});
export type NvidiaEnv = z.infer<typeof nvidiaSchema>;
export function parseNvidiaEnv(input: Record<string, string | undefined>): NvidiaEnv {
  const result = nvidiaSchema.safeParse(input);
  if (!result.success) throw new Error('Invalid configuration: ' + [...new Set(result.error.issues.map(issue => issue.path.join('.')))].join(', '));
  return result.data;
}
const preflightSchema = z.object({
  ...nvidiaSchema.shape,
  GH_APP_ID: z.string().regex(/^[1-9]\d*$/), GH_APP_SLUG: text, GH_PRIVATE_KEY: text, GH_CLIENT_ID: text,
  PP_BASE: z.literal('https://api-m.sandbox.paypal.com'), PP_CLIENT_ID: text, PP_SECRET: text,
  PROVIDER_TIMEOUT_MS: integer(100, 120000),
});
export type PreflightEnv = z.infer<typeof preflightSchema>;
export function parsePreflightEnv(input: Record<string, string | undefined>): PreflightEnv {
  const result = preflightSchema.safeParse(input);
  if (!result.success) throw new Error('Invalid configuration: ' + [...new Set(result.error.issues.map(issue => issue.path.join('.')))].join(', '));
  return result.data;
}
const schema = z.object({
  ...preflightSchema.shape,
  NODE_ENV: z.enum(['development', 'test', 'production']), PORT: integer(1, 65535),
  PUBLIC_URL: z.url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol)),
  DATABASE_URL: database, TEST_DATABASE_URL: database,
  WORKER_MODE: z.enum(['inline', 'separate']), SESSION_SECRET: z.string().min(32),
  TOKEN_ENC_KEY: key, PAYMENT_DATA_ENC_KEY: key, ACTION_TOKEN_TTL_SEC: integer(1, 3600),
  GH_WEBHOOK_SECRET: z.string().min(32), GH_CLIENT_SECRET: text, PP_WEBHOOK_ID: text,
  POLICY_MIN_CONFIDENCE: fraction, POLICY_CI_REQUIRED: flag, POLICY_MIN_SHARE: fraction,
  MAX_BOUNTY_CENTS: integer(1, 2147483647), MAX_DIFF_CHARS: integer(1, 1000000),
  POLL_INTERVAL_MS: integer(100, 3600000), JOB_LEASE_SEC: integer(1, 3600),
  WEBHOOK_BODY_MAX_BYTES: integer(1, 10485760),
  RECONCILIATION_INTERVAL_SEC: integer(1, 86400), RECONCILIATION_PAGE_LIMIT: integer(1, 1000),
  RECONCILIATION_RATE_PER_MIN: integer(1, 1000), RECONCILIATION_MAX_ATTEMPTS: integer(1, 100),
  SSE_HEARTBEAT_SEC: integer(1, 300), FUNDED_CANCELLATION_ENABLED: flag,
  CANCELLATION_OPERATOR_GH_IDS: z.string().transform(value => value.trim() ? value.split(',').map(id => id.trim()) : []).pipe(z.array(z.string().regex(/^[1-9]\d*$/))),
  CANCELLATION_NOTICE_HOURS: z.literal('72').transform(Number),
}).superRefine((env, ctx) => {
  if (env.TOKEN_ENC_KEY === env.PAYMENT_DATA_ENC_KEY) ctx.addIssue({ code: 'custom', path: ['PAYMENT_DATA_ENC_KEY'], message: 'keys must differ' });
  if (env.FUNDED_CANCELLATION_ENABLED && !env.CANCELLATION_OPERATOR_GH_IDS.length) ctx.addIssue({ code: 'custom', path: ['CANCELLATION_OPERATOR_GH_IDS'], message: 'operator required' });
  const primary = new URL(env.DATABASE_URL), test = new URL(env.TEST_DATABASE_URL);
  if (primary.hostname === test.hostname && primary.port === test.port && primary.pathname === test.pathname) ctx.addIssue({ code: 'custom', path: ['TEST_DATABASE_URL'], message: 'test database must differ' });
});
export type Env = z.infer<typeof schema>;
export function parseEnv(input: Record<string, string | undefined>): Env {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error('Invalid configuration: ' + [...new Set(result.error.issues.map(issue => issue.path.join('.')))].join(', '));
  return result.data;
}
