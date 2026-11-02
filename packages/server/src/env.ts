import { z } from 'zod';
const text = z.string().trim().min(1);
const integer = (min: number, max: number) => z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(min).max(max));
const fraction = z.string().regex(/^(0(\.\d+)?|1(\.0+)?)$/).transform(Number);
const flag = z.enum(['true', 'false']).transform(value => value === 'true');
const key = z.string().refine(value => /^[A-Za-z0-9+/]{43}=$/.test(value) && Buffer.from(value, 'base64').length === 32, 'must be a 32-byte base64 key');
const database = z.url().refine(value => ['postgres:', 'postgresql:'].includes(new URL(value).protocol));
// `auto` lets GitHub choose the serving model; each review records the model it reports.
const copilotModel = z.string().trim().max(200).regex(/^[a-zA-Z0-9._:/-]*$/).transform(value => value.toLowerCase() === 'auto' ? 'auto' : value);
const copilotSchema = z.object({
  COPILOT_GITHUB_TOKEN: text,
  COPILOT_BILLING_OWNER_ID: z.string().regex(/^[1-9]\d*$/),
  COPILOT_AUTH_KIND: z.enum(['user', 'organization']), COPILOT_MODEL: copilotModel.default(''),
  COPILOT_TIMEOUT_MS: integer(1000, 120000).default(120000),
  COPILOT_SHUTDOWN_TIMEOUT_MS: integer(100, 10000).default(5000),
  COPILOT_MAX_INPUT_BYTES: integer(1, 1048576).default(200000),
  PROVIDER_RESPONSE_MAX_BYTES: integer(1, 10485760),
}).superRefine((env, ctx) => {
  const valid = env.COPILOT_AUTH_KIND === 'organization' ? /^ghs_/.test(env.COPILOT_GITHUB_TOKEN) : /^(ghu_|gho_|github_pat_)/.test(env.COPILOT_GITHUB_TOKEN);
  if (!valid) ctx.addIssue({code:'custom',path:['COPILOT_GITHUB_TOKEN'],message:'Token type must match the explicit sponsor authorization kind'});
});
export type CopilotEnv = z.infer<typeof copilotSchema>;
export function parseCopilotEnv(input: Record<string, string | undefined>): CopilotEnv {
  const result = copilotSchema.safeParse(input);
  if (!result.success) throw new Error('Invalid configuration: ' + [...new Set(result.error.issues.map(issue => issue.path.join('.')))].join(', '));
  return result.data;
}
const preflightSchema = z.object({
  PROVIDER_RESPONSE_MAX_BYTES: integer(1, 10485760),
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
  WORKER_MODE: z.enum(['inline', 'separate']), RECOVERY_MODE:z.enum(['normal','hold']).default('normal'), SESSION_SECRET: z.string().min(32),
  TOKEN_ENC_KEY: key, PAYMENT_DATA_ENC_KEY: key, ACTION_TOKEN_TTL_SEC: integer(1, 3600),
  SESSION_TTL_SEC: integer(300,2592000), OAUTH_STATE_TTL_SEC: integer(60,900),
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

// Phase 01 consumes GitHub and database settings only. Full payment/application
// validation above remains mandatory when those capabilities are introduced.
const githubRuntimeSchema = z.object({
 NODE_ENV: schema.shape.NODE_ENV, PORT: schema.shape.PORT, PUBLIC_URL: schema.shape.PUBLIC_URL,
 DATABASE_URL: schema.shape.DATABASE_URL, WORKER_MODE: schema.shape.WORKER_MODE,
 RECOVERY_MODE:z.enum(['normal','hold']).default('normal'),
 GH_APP_ID: schema.shape.GH_APP_ID, GH_APP_SLUG: schema.shape.GH_APP_SLUG,
 GH_PRIVATE_KEY: schema.shape.GH_PRIVATE_KEY, GH_CLIENT_ID: schema.shape.GH_CLIENT_ID,
 GH_WEBHOOK_SECRET: schema.shape.GH_WEBHOOK_SECRET, WEBHOOK_BODY_MAX_BYTES: schema.shape.WEBHOOK_BODY_MAX_BYTES,
 PROVIDER_TIMEOUT_MS: schema.shape.PROVIDER_TIMEOUT_MS, PROVIDER_RESPONSE_MAX_BYTES: schema.shape.PROVIDER_RESPONSE_MAX_BYTES,
 MAX_BOUNTY_CENTS: schema.shape.MAX_BOUNTY_CENTS, JOB_LEASE_SEC: schema.shape.JOB_LEASE_SEC,
 POLL_INTERVAL_MS: schema.shape.POLL_INTERVAL_MS, RECONCILIATION_MAX_ATTEMPTS: schema.shape.RECONCILIATION_MAX_ATTEMPTS,
 RECONCILIATION_PAGE_LIMIT: schema.shape.RECONCILIATION_PAGE_LIMIT,
 RECONCILIATION_INTERVAL_SEC: schema.shape.RECONCILIATION_INTERVAL_SEC,
});
export type GitHubRuntimeEnv = z.infer<typeof githubRuntimeSchema>;
export function parseGitHubRuntimeEnv(input:Record<string,string|undefined>):GitHubRuntimeEnv {
 const result=githubRuntimeSchema.safeParse(input);
 if(!result.success)throw new Error('Invalid configuration: '+[...new Set(result.error.issues.map(issue=>issue.path.join('.')))].join(', '));
 return result.data;
}

const authSchema = githubRuntimeSchema.extend({
 SSE_HEARTBEAT_SEC:integer(1,300).default(30),
 GH_CLIENT_SECRET: text, SESSION_SECRET: schema.shape.SESSION_SECRET,
 TOKEN_ENC_KEY: key, PAYMENT_DATA_ENC_KEY:key, ACTION_TOKEN_TTL_SEC: schema.shape.ACTION_TOKEN_TTL_SEC,
 SESSION_TTL_SEC: integer(300, 2592000), OAUTH_STATE_TTL_SEC: integer(60, 900),
}).superRefine((env, ctx) => {
 const url = new URL(env.PUBLIC_URL);
 if (url.pathname !== '/' || url.search || url.hash || url.username || url.password ||
     (url.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(url.hostname))) {
  ctx.addIssue({code:'custom',path:['PUBLIC_URL'],message:'Use an HTTPS origin or loopback HTTP origin'});
 }
});
export type AuthEnv = z.infer<typeof authSchema>;
export function parseAuthEnv(input:Record<string,string|undefined>):AuthEnv {
 const result=authSchema.safeParse(input);
 if(!result.success)throw new Error('Invalid configuration: '+[...new Set(result.error.issues.map(issue=>issue.path.join('.')))].join(', '));
 return result.data;
}

const settlementScope=z.object({bountyId:z.string().regex(/^[1-9]\d*$/),repoId:z.string().regex(/^[1-9]\d*$/),amountCents:z.number().int().positive().max(2147483647),termsHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
const fundingSettings = z.object({
 FUNDED_CANCELLATION_ENABLED:flag.default(false),
 CANCELLATION_OPERATOR_GH_IDS:schema.shape.CANCELLATION_OPERATOR_GH_IDS.default([]),
 CANCELLATION_SANDBOX_REPO_ID:z.string().regex(/^[1-9]\d*$|^$/).default(''),
 SETTLEMENT_DEMO_SCOPE:z.string().default('').transform((value,ctx)=>{if(!value.trim())return null;try{return JSON.parse(value) as unknown;}catch{ctx.addIssue({code:'custom',message:'Invalid settlement scope'});return z.NEVER;}}).pipe(settlementScope.nullable()),
 PP_BASE:preflightSchema.shape.PP_BASE,PP_CLIENT_ID:text,PP_SECRET:text,
 PP_WEBHOOK_ID:z.string().trim().default(''),PP_MERCHANT_ID:z.string().regex(/^[A-Z0-9]{1,32}$|^$/).default(''),
 COPILOT_MODEL:copilotModel.default('auto'),
 POLICY_VERSION:text.default('repopay-v2-copilot'),POLICY_MIN_CONFIDENCE:fraction,POLICY_MIN_SHARE:fraction,
 POLICY_CI_REQUIRED:flag,MAX_DIFF_CHARS:schema.shape.MAX_DIFF_CHARS,CANCELLATION_NOTICE_HOURS:schema.shape.CANCELLATION_NOTICE_HOURS,
 POLICY_CI_CONTEXTS:z.string().default('{}').transform((value,ctx)=>{try{return JSON.parse(value) as unknown;}catch{ctx.addIssue({code:'custom',message:'Invalid JSON'});return z.NEVER;}}).pipe(z.record(z.string().regex(/^[1-9]\d*$/),z.array(z.object({name:text.max(200),appId:z.string().regex(/^[1-9]\d*$/)}).strict()).min(1).max(50))),
 PP_SAFE_RETRY_SEC:integer(60,18000).default(18000),
 RECONCILIATION_DISCOVERY_ENABLED:z.enum(['true','false']).default('false').transform(v=>v==='true'),
 RECONCILIATION_INTERVAL_SEC:schema.shape.RECONCILIATION_INTERVAL_SEC,
 RECONCILIATION_RATE_PER_MIN:schema.shape.RECONCILIATION_RATE_PER_MIN,
 PP_VERIFY_CONCURRENCY:integer(1,16).default(2),
 VERIFIER_DAILY_ATTEMPT_LIMIT:integer(1,1000).default(25),
 VERIFIER_MAX_ATTEMPTS_PER_SHA:integer(1,10).default(3),
});
export type FundingEnv=AuthEnv & z.infer<typeof fundingSettings>;
export function parseFundingEnv(input:Record<string,string|undefined>):FundingEnv {
 const auth=parseAuthEnv(input),result=fundingSettings.safeParse(input);
 if(!result.success)throw new Error('Invalid configuration: '+[...new Set(result.error.issues.map(issue=>issue.path.join('.')))].join(', '));
 if(result.data.FUNDED_CANCELLATION_ENABLED&&(!result.data.CANCELLATION_OPERATOR_GH_IDS.length||!result.data.CANCELLATION_SANDBOX_REPO_ID))throw new Error('Cancellation requires operators and an isolated sandbox repository');
 if(auth.NODE_ENV==='production'&&new URL(auth.PUBLIC_URL).protocol!=='https:')throw new Error('Production PUBLIC_URL requires HTTPS');
 return {...auth,...result.data};
}
