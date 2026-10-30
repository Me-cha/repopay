import { parseArgs } from 'node:util';
import { parsePreflightEnv, parseCopilotEnv } from '../src/env.js';
import { createLogger } from '../src/log.js';
import { runPreflight, type PreflightOptions } from '../src/preflight/run.js';
import { listCopilotModels, probeCopilotModels } from '../src/models/copilot.js';
import { ProbeError } from '../src/preflight/http.js';
try {
  const { values } = parseArgs({ options: { 'sandbox-payment': { type: 'boolean' }, 'model-probe': { type: 'boolean' }, 'model-only': { type: 'boolean' } }, strict: true });
  if (values['model-only']) {
    if (values['sandbox-payment']) throw new ProbeError('model-only cannot be combined with sandbox-payment');
    const env = parseCopilotEnv(process.env);
    const report = values['model-probe'] ? await probeCopilotModels(env) : await listCopilotModels(env);
    // This report contains only validated model IDs, safe error categories and timing/IDs.
    console.log(JSON.stringify({ provider: 'copilot', report }));
    if (report.some(item => ('status' in item && item.status === 'failed') || ('listed' in item && !item.listed))) process.exitCode = 1;
  } else {
    const env = parsePreflightEnv(process.env);
    const options: PreflightOptions = {};
    if (values['model-probe']) options.copilot = parseCopilotEnv(process.env);
    if (values['sandbox-payment']) {
      const recipient = process.env.PREFLIGHT_SANDBOX_RECIPIENT;
      if (!recipient) throw new ProbeError('PREFLIGHT_SANDBOX_RECIPIENT must explicitly identify a sandbox recipient');
      options.payout = { recipient, stateFile: '.data/preflight/payout.json' };
    }
    const report = await runPreflight(env, options);
    createLogger(env).info({ event: 'preflight_result', report });
    if (Array.isArray(report.copilot.structuredOutput) && report.copilot.structuredOutput.some(item => item.status === 'failed')) process.exitCode = 1;
  }
} catch (error) {
  const safe = error instanceof ProbeError || (error instanceof Error && error.message.startsWith('Invalid configuration:')) ? error.message : 'Preflight failed: check configuration, credentials and validated provider response shape';
  console.error(safe); process.exitCode = 1;
}
