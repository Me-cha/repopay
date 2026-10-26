import { z } from 'zod';
import type { NvidiaEnv } from '../env.js';
import { ProbeError, requestJson } from '../preflight/http.js';
const envelope = z.object({
  id: z.string().min(1), model: z.string().min(1),
  choices: z.array(z.object({ finish_reason: z.literal('stop'), message: z.object({
    content: z.string().min(1), refusal: z.null().optional(),
  }) })).length(1),
});
function assertEndpoint(base: string): void { if (base !== 'https://integrate.api.nvidia.com/v1') throw new ProbeError('Unapproved NVIDIA endpoint'); }
export interface ModelAttempt { model: string; outcome: 'validated' }
export async function requestNvidia<T>(env: NvidiaEnv, model: string, prompt: string, output: z.ZodType<T>) {
  assertEndpoint(env.NVIDIA_BASE);
  if (model !== env.NVIDIA_MODEL) throw new ProbeError('Unapproved NVIDIA endpoint or model');
  const started = Date.now();
  const result = await requestJson({ PROVIDER_TIMEOUT_MS: env.NVIDIA_TIMEOUT_MS, PROVIDER_RESPONSE_MAX_BYTES: env.PROVIDER_RESPONSE_MAX_BYTES }, env.NVIDIA_BASE + '/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + env.NVIDIA_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: false, temperature: 1, top_p: 0.95, max_tokens: env.NVIDIA_MAX_TOKENS,
      chat_template_kwargs: { enable_thinking: true },
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_schema', json_schema: { name: 'gitpay_result', strict: true, schema: z.toJSONSchema(output, { target: 'draft-7' }) } },
    }),
  });
  if (result.status !== 200) throw new ProbeError(`NVIDIA HTTP ${String(result.status)}`, result.status === 429 || result.status >= 500);
  try {
    const completion = envelope.parse(result.body);
    if (completion.model !== model) throw new Error('Model mismatch');
    const choice = completion.choices[0];
    if (!choice) throw new Error('Missing choice');
    const value = output.parse(JSON.parse(choice.message.content));
    // Never expose reasoning_content or raw provider payloads to logging/callers.
    return { value, model, completionId: completion.id, requestId: result.requestId, elapsedMs: Date.now() - started };
  } catch { throw new ProbeError('NVIDIA response failed model, completion or output-schema validation'); }
}
export async function completeNvidia<T>(env: NvidiaEnv, prompt: string, output: z.ZodType<T>) {
  const result = await requestNvidia(env, env.NVIDIA_MODEL, prompt, output);
  const attempts: ModelAttempt[] = [{ model: env.NVIDIA_MODEL, outcome: 'validated' }];
  return { ...result, attempts };
}
export async function listNvidiaModels(env: NvidiaEnv) {
  assertEndpoint(env.NVIDIA_BASE);
  const result = await requestJson({ PROVIDER_TIMEOUT_MS: env.NVIDIA_TIMEOUT_MS, PROVIDER_RESPONSE_MAX_BYTES: env.PROVIDER_RESPONSE_MAX_BYTES }, env.NVIDIA_BASE + '/models', { headers: { Authorization: 'Bearer ' + env.NVIDIA_API_KEY } });
  if (result.status !== 200) throw new ProbeError(`NVIDIA model list HTTP ${String(result.status)}`);
  const available = z.object({ data: z.array(z.object({ id: z.string() })) }).parse(result.body).data;
  return [{ model: env.NVIDIA_MODEL, listed: available.some(item => item.id === env.NVIDIA_MODEL) }];
}
export async function probeNvidiaModels(env: NvidiaEnv) {
  const results = [];
  for (const model of [env.NVIDIA_MODEL]) {
    try {
      const result = await requestNvidia(env, model, 'Return JSON with confirmed set to true. This is only a schema capability test.', z.object({ confirmed: z.literal(true) }).strict());
      results.push({ model, status: 'validated' as const, elapsedMs: result.elapsedMs, completionId: result.completionId, requestId: result.requestId });
    } catch (error) {
      results.push({ model, status: 'failed' as const, error: error instanceof ProbeError ? error.message : 'NVIDIA probe failed' });
    }
  }
  return results;
}
