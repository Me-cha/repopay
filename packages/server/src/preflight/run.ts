import { sign } from 'node:crypto';
import { z } from 'zod';
import type { Env } from '../env.js';
import { paypalToken, probePayout, type PayoutProbeOptions } from '../paypal/client.js';
import { ProbeError, requestJson } from './http.js';
import { listNvidiaModels, probeNvidiaModels } from '../models/nvidia.js';
export interface PreflightOptions { modelProbe?: boolean; payout?: PayoutProbeOptions }
export async function runPreflight(env: Env, options: PreflightOptions) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iat: now - 60, exp: now + 540, iss: env.GH_CLIENT_ID })).toString('base64url');
  const unsigned = header + '.' + payload;
  const jwt = unsigned + '.' + sign('RSA-SHA256', Buffer.from(unsigned), env.GH_PRIVATE_KEY.replaceAll('\\n', '\n')).toString('base64url');
  const github = await requestJson(env, 'https://api.github.com/app', { headers: { Authorization: 'Bearer ' + jwt, Accept: 'application/vnd.github+json', 'User-Agent': 'GitPay-Phase00', 'X-GitHub-Api-Version': '2026-03-10' } });
  if (github.status !== 200 || z.object({ slug: z.string() }).parse(github.body).slug !== env.GH_APP_SLUG) throw new ProbeError('GitHub App authentication or slug check failed');
  const nvidia = { models: await listNvidiaModels(env), structuredOutput: options.modelProbe ? await probeNvidiaModels(env) : 'not_probed' };
  let paypal;
  if (options.payout) paypal = { authentication: 'ok', payouts: await probePayout(env, options.payout) };
  else { await paypalToken(env); paypal = { authentication: 'ok', payouts: 'not_probed' }; }
  return { github: { authentication: 'ok', requestId: github.requestId }, nvidia, paypal };
}
