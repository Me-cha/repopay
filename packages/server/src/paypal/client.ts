import { z } from 'zod';
import type { PreflightEnv } from '../env.js';
import { ProbeError, requestJson } from '../preflight/http.js';
import { saveState, withProbeState, type ProbeState } from '../preflight/state.js';
const batchId = z.string().regex(/^[A-Za-z0-9]+$/).max(256);
type PayPalEnv = Pick<PreflightEnv, 'PP_BASE' | 'PP_CLIENT_ID' | 'PP_SECRET' | 'PROVIDER_TIMEOUT_MS' | 'PROVIDER_RESPONSE_MAX_BYTES'>;
const batchSchema = z.object({ batch_header: z.object({ payout_batch_id: batchId, batch_status: z.enum(['DENIED', 'PENDING', 'PROCESSING', 'SUCCESS', 'CANCELED']) }) });
const snapshotSchema = batchSchema.extend({ items: z.array(z.object({ payout_item_id: batchId, transaction_status: z.enum(['SUCCESS', 'FAILED', 'PENDING', 'UNCLAIMED', 'RETURNED', 'ONHOLD', 'BLOCKED', 'REFUNDED', 'REVERSED']) })).min(1).max(1) });
const duplicateSchema = z.object({
  name: z.string(), details: z.array(z.object({ field: z.string().optional(), issue: z.string() })).optional(),
  links: z.array(z.object({ rel: z.string(), href: z.string() })).optional(),
}).refine(value => value.name === 'DUPLICATE_BATCH_ID' || value.details?.some(detail =>
  detail.issue === 'DUPLICATE_BATCH_ID' || (
    // Observed sandbox format: no recovery link; a saved batch is still required below.
    value.name === 'USER_BUSINESS_ERROR' && detail.field === 'SENDER_BATCH_ID' &&
    detail.issue === 'Batch with given sender_batch_id already exists'
  ),
));
export function assertSandbox(env: { PP_BASE: string }): void { if (env.PP_BASE !== 'https://api-m.sandbox.paypal.com') throw new ProbeError('PayPal sandbox is required'); }
export async function paypalToken(env: PayPalEnv): Promise<string> {
  assertSandbox(env);
  const result = await requestJson(env, env.PP_BASE + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(env.PP_CLIENT_ID + ':' + env.PP_SECRET).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  if (result.status !== 200) throw new ProbeError(`PayPal authentication HTTP ${String(result.status)}`);
  return z.object({ access_token: z.string().min(1), token_type: z.literal('Bearer') }).parse(result.body).access_token;
}
export interface PayoutProbeOptions { recipient: string; stateFile: string; now?: Date }
export async function probePayout(input: Omit<PayPalEnv, 'PP_BASE'> & { PP_BASE: string }, options: PayoutProbeOptions) {
  assertSandbox(input);
  const env: PayPalEnv = { ...input, PP_BASE: 'https://api-m.sandbox.paypal.com' };
  const recipient = z.email().parse(options.recipient);
  return withProbeState(options.stateFile, recipient, env.PP_CLIENT_ID, options.now ?? new Date(), async state => {
    const token = await paypalToken(env);
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    const body = JSON.stringify({ sender_batch_header: { sender_batch_id: state.senderBatchId, email_subject: 'GitPay sandbox feasibility probe' }, items: [{ recipient_type: 'EMAIL', amount: { value: '1.00', currency: 'USD' }, receiver: recipient, sender_item_id: state.senderItemId }] });
    async function submit() {
      const result = await requestJson(env, env.PP_BASE + '/v1/payments/payouts', { method: 'POST', headers, body });
      let id: string;
      if (result.status === 201) id = batchSchema.parse(result.body).batch_header.payout_batch_id;
      else if (result.status === 400) {
        const duplicate = duplicateSchema.safeParse(result.body);
        if (!duplicate.success) throw new ProbeError('PayPal refused payout; inspect sandbox account configuration');
        const link = duplicate.data.links?.find(item => item.rel === 'duplicate_batch')?.href;
        const match = link?.match(/^https:\/\/api-m\.sandbox\.paypal\.com\/v1\/payments\/payouts\/([A-Za-z0-9]+)$/);
        if (link && !match) throw new ProbeError('Invalid duplicate recovery link');
        const recovered = match?.[1] ?? state.batchId;
        if (!recovered) throw new ProbeError('Duplicate payout requires manual recovery lookup');
        id = recovered;
      } else throw new ProbeError(`Payout HTTP ${String(result.status)}; identity retained for reconciliation`);
      if (state.batchId && state.batchId !== id) throw new ProbeError('Provider batch identity changed; reconcile manually');
      const next: ProbeState = { ...state, batchId: id };
      await saveState(options.stateFile, next); state = next;
      return result;
    }
    const first = await submit();
    const duplicate = first.status === 201 ? await submit() : first;
    if (!state.batchId) throw new ProbeError('Missing payout batch ID');
    const lookup = await requestJson(env, env.PP_BASE + '/v1/payments/payouts/' + state.batchId, { headers });
    if (lookup.status !== 200) throw new ProbeError('Payout recovery lookup failed; identity retained');
    const snapshot = snapshotSchema.parse(lookup.body);
    if (snapshot.batch_header.payout_batch_id !== state.batchId) throw new ProbeError('Payout recovery returned a different batch');
    return { batchId: state.batchId, senderBatchId: state.senderBatchId, batchStatus: snapshot.batch_header.batch_status, itemStatuses: snapshot.items.map(item => item.transaction_status), duplicateHttpStatus: duplicate.status, requestId: lookup.requestId };
  });
}
