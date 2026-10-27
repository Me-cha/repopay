import { pino, type DestinationStream, type Logger } from 'pino';
import type { Env, PreflightEnv, GitHubRuntimeEnv } from './env.js';
const sensitiveKey = /api[_-]?key|token|secret|password|cookie|authorization|email|private.?key|receiver|destination|payload|body|database_url|enc_key/i;
export function createLogger(env: Env | PreflightEnv | GitHubRuntimeEnv, destination?: DestinationStream): Logger {
  const secrets = Object.entries(env).filter(([name, value]) => sensitiveKey.test(name) && typeof value === 'string').map(([, value]) => String(value));
  function clean(value: unknown, seen = new WeakSet<object>()): unknown {
    if (value instanceof Error) return { type: 'Error', message: '[REDACTED]' };
    if (typeof value === 'string') {
      let safe = value.replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, '[REDACTED]').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[REDACTED]').replace(/Bearer\s+\S+/gi, '[REDACTED]');
      for (const secret of secrets) if (secret) safe = safe.split(secret).join('[REDACTED]');
      return safe;
    }
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    if (Array.isArray(value)) return value.map(item => clean(item, seen));
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, sensitiveKey.test(name) ? '[REDACTED]' : clean(item, seen)]));
  }
  const options = { base: null, hooks: {
    // Pino resets binding formatters on children. Sanitize the final serialized
    // record as well, so child()/setBindings() cannot bypass redaction.
    streamWrite(line: string): string {
      try { return JSON.stringify(clean(JSON.parse(line))) + '\n'; }
      catch { return '{"level":50,"msg":"Log record redacted"}\n'; }
    },
    logMethod(args: Parameters<Logger['info']>, method: Logger['info']) {
    const cleaned = args.map(arg => clean(arg)) as Parameters<Logger['info']>;
    method.apply(this, cleaned);
  } } };
  return destination ? pino(options, destination) : pino(options);
}
