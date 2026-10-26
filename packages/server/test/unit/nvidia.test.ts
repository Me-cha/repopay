import nock from 'nock';
import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { parseNvidiaEnv } from '../../src/env.js';
import { completeNvidia, probeNvidiaModels } from '../../src/models/nvidia.js';
const config = {
  NVIDIA_API_KEY: 'synthetic-nvidia-secret', NVIDIA_BASE: 'https://integrate.api.nvidia.com/v1',
  NVIDIA_PRIMARY_MODEL: 'deepseek-ai/deepseek-v4.1-flash', NVIDIA_FALLBACK_MODEL: 'nvidia/nemotron-3-ultra-550b-a55b',
  NVIDIA_MAX_TOKENS: '2048', NVIDIA_TIMEOUT_MS: '1000', PROVIDER_RESPONSE_MAX_BYTES: '1048576',
};
const output = z.object({ confirmed: z.literal(true) }).strict();
function response(model: string, content = '{"confirmed":true}', finishReason = 'stop') {
  return { id: 'completion-test', model, choices: [{ index: 0, finish_reason: finishReason, message: { role: 'assistant', content, reasoning_content: 'must not escape' } }] };
}
function mock(model: string) { return nock('https://integrate.api.nvidia.com', { reqheaders: { authorization: 'Bearer synthetic-nvidia-secret' } }).post('/v1/chat/completions', (body: { model: string }) => body.model === model); }
it('parses NVIDIA configuration without unrelated provider credentials and refuses credential exfiltration URLs', () => {
  expect(parseNvidiaEnv(config).NVIDIA_PRIMARY_MODEL).toBe(config.NVIDIA_PRIMARY_MODEL);
  expect(() => parseNvidiaEnv({ ...config, NVIDIA_BASE: 'https://attacker.example/v1' })).toThrow();
  expect(() => parseNvidiaEnv({ ...config, NVIDIA_TIMEOUT_MS: '0' })).toThrow();
  expect(() => parseNvidiaEnv({ ...config, NVIDIA_MAX_TOKENS: '262144' })).toThrow();
});
it('uses primary first, validates JSON, and excludes reasoning from returned result', async () => {
  mock(config.NVIDIA_PRIMARY_MODEL).reply(200, response(config.NVIDIA_PRIMARY_MODEL));
  const result = await completeNvidia(parseNvidiaEnv(config), 'Synthetic probe', output);
  expect(result.value).toEqual({ confirmed: true });
  expect(result.model).toBe(config.NVIDIA_PRIMARY_MODEL);
  expect(result.usedFallback).toBe(false);
  expect(JSON.stringify(result)).not.toContain('must not escape');
});
it.each([429, 500, 503])('falls back once on HTTP %s using Nemotron-specific thinking config', async status => {
  mock(config.NVIDIA_PRIMARY_MODEL).reply(status, { error: { message: 'private provider details' } });
  nock('https://integrate.api.nvidia.com').post('/v1/chat/completions', body => {
    expect(body).toMatchObject({ model: config.NVIDIA_FALLBACK_MODEL, stream: false, temperature: 1, top_p: 0.95, max_tokens: 2048, chat_template_kwargs: { enable_thinking: true }, response_format: { type: 'json_schema' } });
    return true;
  }).reply(200, response(config.NVIDIA_FALLBACK_MODEL));
  const result = await completeNvidia(parseNvidiaEnv(config), 'Synthetic probe', output);
  expect(result.usedFallback).toBe(true);
  expect(result.model).toBe(config.NVIDIA_FALLBACK_MODEL);
  expect(result.attempts).toHaveLength(2);
});
it('falls back on transport failure but bounds total attempts to two', async () => {
  mock(config.NVIDIA_PRIMARY_MODEL).replyWithError('lost connection');
  mock(config.NVIDIA_FALLBACK_MODEL).reply(503, {});
  await expect(completeNvidia(parseNvidiaEnv(config), 'probe', output)).rejects.toThrow(/503/);
});
it.each([400, 401, 402, 403, 404, 422])('does not hide configuration or authorization error HTTP %s with fallback', async status => {
  mock(config.NVIDIA_PRIMARY_MODEL).reply(status, { error: { message: 'private provider details' } });
  await expect(completeNvidia(parseNvidiaEnv(config), 'probe', output)).rejects.toThrow(`HTTP ${String(status)}`);
});
it.each([
  response(config.NVIDIA_PRIMARY_MODEL, '{"confirmed":false}'),
  response(config.NVIDIA_PRIMARY_MODEL, 'not JSON'),
  response(config.NVIDIA_PRIMARY_MODEL, '{"confirmed":true}', 'length'),
  response(config.NVIDIA_PRIMARY_MODEL, '{"confirmed":true,"extra":1}'),
  response('unexpected-model'),
])('does not retry malformed, truncated or mismatched output', async body => {
  mock(config.NVIDIA_PRIMARY_MODEL).reply(200, body);
  await expect(completeNvidia(parseNvidiaEnv(config), 'probe', output)).rejects.toThrow();
});
it('accepts a valid negative verdict without seeking a different answer', async () => {
  mock(config.NVIDIA_PRIMARY_MODEL).reply(200, response(config.NVIDIA_PRIMARY_MODEL, '{"verdict":"DOES_NOT_RESOLVE"}'));
  const result = await completeNvidia(parseNvidiaEnv(config), 'probe', z.object({ verdict: z.enum(['RESOLVES', 'DOES_NOT_RESOLVE']) }).strict());
  expect(result.value.verdict).toBe('DOES_NOT_RESOLVE');
  expect(result.usedFallback).toBe(false);
});
it('probes each model independently so fallback cannot hide a broken primary', async () => {
  mock(config.NVIDIA_PRIMARY_MODEL).reply(503, {});
  mock(config.NVIDIA_FALLBACK_MODEL).reply(200, response(config.NVIDIA_FALLBACK_MODEL));
  const results = await probeNvidiaModels(parseNvidiaEnv(config));
  expect(results.map(item => item.status)).toEqual(['failed', 'validated']);
});
it('falls back on an HTML service failure but not an oversized successful response', async () => {
  mock(config.NVIDIA_PRIMARY_MODEL).reply(503, '<html>unavailable</html>');
  mock(config.NVIDIA_FALLBACK_MODEL).reply(200, response(config.NVIDIA_FALLBACK_MODEL));
  expect((await completeNvidia(parseNvidiaEnv(config), 'probe', output)).usedFallback).toBe(true);
  mock(config.NVIDIA_PRIMARY_MODEL).reply(200, response(config.NVIDIA_PRIMARY_MODEL));
  await expect(completeNvidia(parseNvidiaEnv({ ...config, PROVIDER_RESPONSE_MAX_BYTES: '16' }), 'probe', output)).rejects.toThrow(/limit/);
});
it('times out a slow primary and reaches fallback', async () => {
  // Simulate a transport that never responds. Nock's delayed-body abort path
  // triggers an Undici assertion in this Node/Nock version, so isolate the
  // transport only; real request timeout/fallback/validation still execute.
  let aborted = false;
  const transport = vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) { reject(new Error('Missing request timeout signal')); return; }
    signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Timed out', 'TimeoutError')); }, { once: true });
  }));
  mock(config.NVIDIA_FALLBACK_MODEL).reply(200, response(config.NVIDIA_FALLBACK_MODEL));
  try {
    expect((await completeNvidia(parseNvidiaEnv(config), 'probe', output)).usedFallback).toBe(true);
    expect(aborted).toBe(true);
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
