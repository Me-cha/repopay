export class ProbeError extends Error {
  constructor(message: string, readonly retryable = false) { super(message); }
}
interface RequestLimits { PROVIDER_TIMEOUT_MS: number; PROVIDER_RESPONSE_MAX_BYTES: number }
export async function requestJson(env: RequestLimits, url: string, init: RequestInit = {}) {
  let response: Response;
  let raw: string;
  try {
    response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(env.PROVIDER_TIMEOUT_MS) });
  } catch { throw new ProbeError('Provider request failed or timed out; outcome may be unknown', true); }
  const requestId = response.headers.get('paypal-debug-id') ?? response.headers.get('x-github-request-id') ?? response.headers.get('x-request-id') ?? response.headers.get('request-id');
  try {
    const reader = response.body?.getReader();
    if (!reader) throw new ProbeError('Provider returned an empty response');
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > env.PROVIDER_RESPONSE_MAX_BYTES) { await reader.cancel(); throw new ProbeError('Provider response exceeded configured limit'); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    raw = Buffer.concat(chunks).toString('utf8');
  } catch (error) {
    // Once a non-200 status is known, callers must classify that status even
    // if its error body is missing, oversized or interrupted.
    if (response.status !== 200) return { status: response.status, body: undefined, requestId };
    if (error instanceof ProbeError) throw error;
    throw new ProbeError('Provider request failed or timed out; outcome may be unknown', true);
  }
  let body: unknown;
  try { body = JSON.parse(raw); }
  catch { if (response.ok) throw new ProbeError('Provider returned invalid JSON'); }
  return { status: response.status, body, requestId };
}
