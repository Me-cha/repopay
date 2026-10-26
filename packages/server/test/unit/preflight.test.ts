import { readFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import nock from 'nock';
import { afterEach, expect, it } from 'vitest';
import { parseEnv, parsePreflightEnv } from '../../src/env.js';
import { runPreflight } from '../../src/preflight/run.js';
import { probePayout } from '../../src/paypal/client.js';
import { syntheticEnv } from '../helpers/env.js';
const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const env = parseEnv({ ...syntheticEnv(), GH_PRIVATE_KEY: privateKey });
const directories: string[] = [];
afterEach(async () => { for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true }); });
async function stateFile() { const dir = await mkdtemp(join(tmpdir(), 'gitpay-probe-')); directories.push(dir); return join(dir, 'probe.json'); }
function token() { nock(env.PP_BASE).post('/v1/oauth2/token').reply(200, { access_token: 'test-token', token_type: 'Bearer' }); }
const batch = { batch_header: { payout_batch_id: 'BATCH123', batch_status: 'PENDING' } };
const snapshot = { batch_header: { payout_batch_id: 'BATCH123', batch_status: 'SUCCESS' }, items: [{ payout_item_id: 'ITEM123', transaction_status: 'SUCCESS' }] };
it('probe_default_does_not_pay or generate model output', async () => {
  token();
  nock('https://api.github.com').get('/app').reply(200, { slug: env.GH_APP_SLUG });
  nock('https://integrate.api.nvidia.com').get('/v1/models').reply(200, { data: [{ id: env.NVIDIA_MODEL }] });
  const providerEnv = parsePreflightEnv({ ...syntheticEnv(), GH_PRIVATE_KEY: privateKey, PP_WEBHOOK_ID: '', GH_WEBHOOK_SECRET: '', GH_CLIENT_SECRET: '' });
  const report = await runPreflight(providerEnv, {});
  expect(report.paypal).toEqual({ authentication: 'ok', payouts: 'not_probed' });
  expect(report.nvidia.structuredOutput).toBe('not_probed');
  expect(report.github.authentication).toBe('ok');
});
it('probe_reuses_identity persisted before sending and recovers duplicate', async () => {
  const file = await stateFile();
  token();
  const sent: unknown[] = [];
  nock(env.PP_BASE).post('/v1/payments/payouts', (body: unknown) => {
    const state: unknown = JSON.parse(readFileSync(file, 'utf8'));
    expect(state).toMatchObject({ amountCents: 100 });
    expect(JSON.stringify(state)).not.toContain('recipient@example.com');
    sent.push(body);
    return true;
  }).reply(201, batch);
  nock(env.PP_BASE).post('/v1/payments/payouts', (body: unknown) => { sent.push(body); return true; }).reply(400, { name: 'DUPLICATE_BATCH_ID', links: [{ rel: 'duplicate_batch', href: env.PP_BASE + '/v1/payments/payouts/BATCH123' }] });
  nock(env.PP_BASE).get('/v1/payments/payouts/BATCH123').reply(200, snapshot);
  const result = await probePayout(env, { recipient: 'recipient@example.com', stateFile: file });
  expect(sent).toHaveLength(2);
  expect(sent[0]).toEqual(sent[1]);
  expect(sent[0]).toMatchObject({ items: [{ amount: { value: '1.00', currency: 'USD' } }] });
  expect(result.itemStatuses).toEqual(['SUCCESS']);
  expect(result.duplicateHttpStatus).toBe(400);
  // A subsequent explicit probe sends only the same persisted operation identity.
  token();
  nock(env.PP_BASE).post('/v1/payments/payouts', (body: unknown) => { expect(body).toEqual(sent[0]); return true; }).reply(400, { name: 'VALIDATION_ERROR', details: [{ issue: 'DUPLICATE_BATCH_ID' }] });
  nock(env.PP_BASE).get('/v1/payments/payouts/BATCH123').reply(200, snapshot);
  expect((await probePayout(env, { recipient: 'recipient@example.com', stateFile: file })).batchId).toBe('BATCH123');
});
it('unknown outcomes keep identity and refuse changed recipient', async () => {
  const file = await stateFile(); token();
  nock(env.PP_BASE).post('/v1/payments/payouts').replyWithError('connection lost');
  await expect(probePayout(env, { recipient: 'recipient@example.com', stateFile: file })).rejects.toThrow();
  const first = await readFile(file, 'utf8');
  await expect(probePayout(env, { recipient: 'other@example.com', stateFile: file })).rejects.toThrow(/identity/);
  expect(await readFile(file, 'utf8')).toBe(first);
});
it('refuses retry outside dedupe window and concurrent probe', async () => {
  const file = await stateFile(); token();
  nock(env.PP_BASE).post('/v1/payments/payouts').replyWithError('connection lost');
  const now = new Date('2026-01-01T00:00:00Z');
  await expect(probePayout(env, { recipient: 'recipient@example.com', stateFile: file, now })).rejects.toThrow();
  await expect(probePayout(env, { recipient: 'recipient@example.com', stateFile: file, now: new Date('2026-02-01T00:00:00Z') })).rejects.toThrow(/window/);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(file + '.lock', 'locked');
  await expect(probePayout(env, { recipient: 'recipient@example.com', stateFile: file, now })).rejects.toThrow(/lock/);
});
it('rejects non-sandbox base before any provider request', async () => {
  const file = await stateFile();
  await expect(probePayout(Object.assign({}, env, { PP_BASE: 'https://api-m.paypal.com' }), { recipient: 'recipient@example.com', stateFile: file })).rejects.toThrow(/sandbox/);
});
it('rejects hostile duplicate recovery links', async () => {
  const file = await stateFile(); token();
  nock(env.PP_BASE).post('/v1/payments/payouts').reply(400, { name: 'DUPLICATE_BATCH_ID', links: [{ rel: 'duplicate_batch', href: 'https://attacker.example/BATCH123' }] });
  await expect(probePayout(env, { recipient: 'recipient@example.com', stateFile: file })).rejects.toThrow(/recovery/);
});
const observedDuplicate = {
  name: 'USER_BUSINESS_ERROR', message: 'User business error.',
  details: [{ field: 'SENDER_BATCH_ID', issue: 'Batch with given sender_batch_id already exists' }], links: [],
};
it('recovers the observed sandbox duplicate response using the persisted accepted batch', async () => {
  const file = await stateFile(); token();
  nock(env.PP_BASE).post('/v1/payments/payouts').reply(201, batch);
  nock(env.PP_BASE).post('/v1/payments/payouts').reply(400, observedDuplicate);
  nock(env.PP_BASE).get('/v1/payments/payouts/BATCH123').reply(200, snapshot);
  const result = await probePayout(env, { recipient: 'recipient@example.com', stateFile: file });
  expect(result).toMatchObject({ batchId: 'BATCH123', duplicateHttpStatus: 400, itemStatuses: ['SUCCESS'] });
  expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ batchId: 'BATCH123', amountCents: 100 });
});
it('requires manual recovery when the observed duplicate has no link or saved batch', async () => {
  const file = await stateFile(); token();
  nock(env.PP_BASE).post('/v1/payments/payouts').reply(400, observedDuplicate);
  await expect(probePayout(env, { recipient: 'recipient@example.com', stateFile: file })).rejects.toThrow(/manual recovery/);
  expect(JSON.parse(await readFile(file, 'utf8'))).not.toHaveProperty('batchId');
});
it.each([
  { ...observedDuplicate, name: 'VALIDATION_ERROR' },
  { ...observedDuplicate, details: [{ field: 'RECEIVER', issue: 'Batch with given sender_batch_id already exists' }] },
  { ...observedDuplicate, details: [{ field: 'SENDER_BATCH_ID', issue: 'Invalid sender batch ID' }] },
])('does not treat unrelated business errors as a duplicate: %j', async response => {
  const file = await stateFile(); token();
  nock(env.PP_BASE).post('/v1/payments/payouts').reply(201, batch);
  nock(env.PP_BASE).post('/v1/payments/payouts').reply(400, response);
  await expect(probePayout(env, { recipient: 'recipient@example.com', stateFile: file })).rejects.toThrow(/refused payout/);
  expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ batchId: 'BATCH123' });
});
