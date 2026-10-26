import nock from 'nock';
import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { parseNvidiaEnv } from '../../src/env.js';
import { completeNvidia, probeNvidiaModels, requestNvidia } from '../../src/models/nvidia.js';
const config = {
  NVIDIA_API_KEY: 'synthetic-nvidia-secret', NVIDIA_BASE: 'https://integrate.api.nvidia.com/v1',
  NVIDIA_MODEL: 'nvidia/nemotron-3-ultra-550b-a55b',
  NVIDIA_MAX_TOKENS: '2048', NVIDIA_TIMEOUT_MS: '1000', PROVIDER_RESPONSE_MAX_BYTES: '1048576',
};
const output = z.object({ confirmed: z.literal(true) }).strict();
function response(model: string, content = '{"confirmed":true}', finishReason = 'stop') {
  return { id: 'completion-test', model, choices: [{ index: 0, finish_reason: finishReason, message: { role: 'assistant', content, reasoning_content: 'must not escape' } }] };
}
function mock() { return nock('https://integrate.api.nvidia.com', { reqheaders: { authorization: 'Bearer synthetic-nvidia-secret' } }).post('/v1/chat/completions', (body: { model: string }) => body.model === config.NVIDIA_MODEL); }
it('accepts Nemotron only and refuses other model or credential destinations', () => {
  expect(parseNvidiaEnv(config).NVIDIA_MODEL).toBe(config.NVIDIA_MODEL);
  expect(() => parseNvidiaEnv({ ...config, NVIDIA_MODEL: 'deepseek-ai/deepseek-v4.1-flash' })).toThrow();
  expect(() => parseNvidiaEnv({ ...config, NVIDIA_BASE: 'https://attacker.example/v1' })).toThrow();
  expect(() => parseNvidiaEnv({ ...config, NVIDIA_TIMEOUT_MS: '0' })).toThrow();
  expect(() => parseNvidiaEnv({ ...config, NVIDIA_MAX_TOKENS: '262144' })).toThrow();
});
it('calls Nemotron directly with bounded schema and thinking parameters, hiding reasoning', async () => {
  nock('https://integrate.api.nvidia.com').post('/v1/chat/completions', body => {
    expect(body).toMatchObject({ model: config.NVIDIA_MODEL, stream: false, temperature: 1, top_p: 0.95, max_tokens: 2048, chat_template_kwargs: { enable_thinking: true }, response_format: { type: 'json_schema', json_schema: { strict: true } } });
    return true;
  }).reply(200, response(config.NVIDIA_MODEL));
  const result = await completeNvidia(parseNvidiaEnv(config), 'Synthetic probe', output);
  expect(result.value).toEqual({ confirmed: true });
  expect(result.model).toBe(config.NVIDIA_MODEL);
  expect(result.attempts).toEqual([{ model: config.NVIDIA_MODEL, outcome: 'validated' }]);
  expect(JSON.stringify(result)).not.toContain('must not escape');
});
it('refuses a different model before sending a request', async () => {
  await expect(requestNvidia(parseNvidiaEnv(config), 'deepseek-ai/deepseek-v4.1-flash', 'probe', output)).rejects.toThrow(/model/);
});
it.each([400, 401, 402, 403, 404, 422, 429, 500, 503])('returns HTTP %s failure after exactly one attempt', async status => {
  mock().reply(status, { error: { message: 'private provider details' } });
  const transport = vi.spyOn(globalThis, 'fetch');
  try {
    await expect(completeNvidia(parseNvidiaEnv(config), 'probe', output)).rejects.toThrow(`HTTP ${String(status)}`);
    expect(transport).toHaveBeenCalledTimes(1);
  } finally { transport.mockRestore(); }
});
it('returns transport failure without trying another model', async () => {
  mock().replyWithError('lost connection');
  await expect(completeNvidia(parseNvidiaEnv(config), 'probe', output)).rejects.toThrow(/failed or timed out/);
});
it.each([
  response(config.NVIDIA_MODEL, '{"confirmed":false}'),
  response(config.NVIDIA_MODEL, 'not JSON'),
  response(config.NVIDIA_MODEL, '{"confirmed":true}', 'length'),
  response(config.NVIDIA_MODEL, '{"confirmed":true,"extra":1}'),
  response('unexpected-model'),
])('rejects malformed, truncated or mismatched output', async body => {
  mock().reply(200, body);
  await expect(completeNvidia(parseNvidiaEnv(config), 'probe', output)).rejects.toThrow();
});
it('accepts a valid negative verdict without seeking a different answer', async () => {
  mock().reply(200, response(config.NVIDIA_MODEL, '{"verdict":"DOES_NOT_RESOLVE"}'));
  const result = await completeNvidia(parseNvidiaEnv(config), 'probe', z.object({ verdict: z.enum(['RESOLVES', 'DOES_NOT_RESOLVE']) }).strict());
  expect(result.value.verdict).toBe('DOES_NOT_RESOLVE');
  expect(result.attempts).toHaveLength(1);
});
it.each([200, 503])('probes only the active model and reports HTTP %s honestly', async status => {
  mock().reply(status, status === 200 ? response(config.NVIDIA_MODEL) : {});
  const results = await probeNvidiaModels(parseNvidiaEnv(config));
  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({ model: config.NVIDIA_MODEL, status: status === 200 ? 'validated' : 'failed' });
});
it('rejects an HTML service failure and an oversized successful response', async () => {
  mock().reply(503, '<html>unavailable</html>');
  await expect(completeNvidia(parseNvidiaEnv(config), 'probe', output)).rejects.toThrow(/503/);
  mock().reply(200, response(config.NVIDIA_MODEL));
  await expect(completeNvidia(parseNvidiaEnv({ ...config, PROVIDER_RESPONSE_MAX_BYTES: '16' }), 'probe', output)).rejects.toThrow(/limit/);
});
it('aborts a slow model at the configured timeout without another attempt', async () => {
  // Isolate the transport: Nock delayed-body abort triggers an Undici assertion.
  // The real timeout signal and adapter failure path still execute.
  let aborted = false;
  const transport = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) { reject(new Error('Missing request timeout signal')); return; }
    signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Timed out', 'TimeoutError')); }, { once: true });
  }));
  try {
    await expect(completeNvidia(parseNvidiaEnv(config), 'probe', output)).rejects.toThrow(/failed or timed out/);
    expect(aborted).toBe(true);
    expect(transport).toHaveBeenCalledTimes(1);
  } finally { transport.mockRestore(); }
});
it.each([401, 402, 403, 422])('preserves HTTP %s when reading its response body fails', async status => {
  const transport = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(new ReadableStream({
    start(controller) { controller.error(new Error('body connection lost')); },
  }), { status }));
  try {
    await expect(completeNvidia(parseNvidiaEnv(config), 'probe', output)).rejects.toThrow(`HTTP ${String(status)}`);
    expect(transport).toHaveBeenCalledTimes(1);
  } finally { transport.mockRestore(); }
});
