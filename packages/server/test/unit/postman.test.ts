import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { z } from 'zod';

const collection = z.object({ item: z.array(z.object({
  event: z.array(z.object({ script: z.object({ exec: z.array(z.string()) }) })).optional(),
  request: z.object({ method: z.string(), body: z.object({ raw: z.string() }).optional() }),
})) }).parse(JSON.parse(readFileSync(new URL('../../../../postman/gitpay.postman_collection.json', import.meta.url), 'utf8')));
const ping = collection.item.find((item) => item.request.method === 'POST');

it('synthetic Postman intake skips without opt-in and refuses non-loopback destinations', () => {
  const source = ping?.event?.[0]?.script.exec.join('\n');
  expect(source).toBeDefined();
  for (const base of ['https://example.com', 'http://localhost.evil.test', 'http://127.0.0.1@evil.test', 'http://localhost:3000/path', 'http://127.0.0.1:3000']) {
    for (const enabled of ['false', 'true']) {
      const state = { skipped: false };
      const values = new Map<string, string>();
      try {
        runInNewContext(source ?? '', { pm: {
          variables: { get: () => base, set: (key: string, value: string) => values.set(key, value), replaceIn: () => 'synthetic-delivery' },
          environment: { get: (key: string) => key === 'allowSyntheticWebhooks' ? enabled : 'sha256=' + 'a'.repeat(64) },
          execution: { skipRequest: () => { state.skipped = true; throw new Error('skipped'); } },
        } });
      } catch (error) { if (!state.skipped) throw error; }
      const allowed = base === 'http://127.0.0.1:3000' && enabled === 'true';
      expect(state.skipped).toBe(!allowed);
      expect(values.has('localSignature')).toBe(allowed);
    }
  }
  expect(ping?.request.body?.raw).toBe('{"zen":"GitPay synthetic local ping"}');
  expect(collection.item.filter((item) => item.request.method !== 'GET')).toHaveLength(1);
});
