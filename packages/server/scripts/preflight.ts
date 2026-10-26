import { parseArgs } from 'node:util';
import { parseEnv, parseNvidiaEnv } from '../src/env.js';
import { createLogger } from '../src/log.js';
import { runPreflight, type PreflightOptions } from '../src/preflight/run.js';
import { listNvidiaModels, probeNvidiaModels } from '../src/models/nvidia.js';
import { ProbeError } from '../src/preflight/http.js';
try {
  const { values } = parseArgs({ options: { 'sandbox-payment': { type: 'boolean' }, 'model-probe': { type: 'boolean' }, 'model-only': { type: 'boolean' } }, strict: true });
  if (values['model-only']) {
    if (values['sandbox-payment']) throw new ProbeError('model-only cannot be combined with sandbox-payment');
    const env = parseNvidiaEnv(process.env);
    const report = values['model-probe'] ? await probeNvidiaModels(env) : await listNvidiaModels(env);
    // This report contains only validated model IDs, safe error categories and timing/IDs.
    console.log(JSON.stringify({ provider: 'nvidia', report }));
    if (report.some(item => ('status' in item && item.status === 'failed') || ('listed' in item && !item.listed))) process.exitCode = 1;
  } else {
    const env = parseEnv(process.env);
    const options: PreflightOptions = { modelProbe: values['model-probe'] ?? false };
    if (values['sandbox-payment']) {
      const recipient = process.env.PREFLIGHT_SANDBOX_RECIPIENT;
      if (!recipient) throw new ProbeError('PREFLIGHT_SANDBOX_RECIPIENT must explicitly identify a sandbox recipient');
      options.payout = { recipient, stateFile: '.data/preflight/payout.json' };
    }
    const report = await runPreflight(env, options);
    createLogger(env).info({ event: 'preflight_result', report });
    if (report.nvidia.models.some(item => !item.listed) || (Array.isArray(report.nvidia.structuredOutput) && report.nvidia.structuredOutput.some(item => item.status === 'failed'))) process.exitCode = 1;
  }
} catch (error) {
  const safe = error instanceof ProbeError || (error instanceof Error && error.message.startsWith('Invalid configuration:')) ? error.message : 'Preflight failed: check configuration, credentials and validated provider response shape';
  console.error(safe); process.exitCode = 1;
}
