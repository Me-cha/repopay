import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { ProbeError } from './http.js';
const stateSchema = z.object({ version: z.literal(1), senderBatchId: z.uuid(), senderItemId: z.uuid(),
  recipientHash: z.string().regex(/^[a-f0-9]{64}$/), accountHash: z.string().regex(/^[a-f0-9]{64}$/), amountCents: z.literal(100),
  createdAt: z.iso.datetime(), batchId: z.string().regex(/^[A-Za-z0-9]+$/).optional(),
}).strict();
export type ProbeState = z.infer<typeof stateSchema>;
export const identityHash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function saveState(path: string, state: ProbeState): Promise<void> {
  const temporary = path + '.' + randomUUID() + '.tmp';
  const file = await open(temporary, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(state) + '\n'); await file.sync(); }
  finally { await file.close(); }
  await rename(temporary, path);
  const directory = await open(dirname(path), 'r');
  try { await directory.sync(); } finally { await directory.close(); }
}
export async function withProbeState<T>(path: string, recipient: string, clientId: string, now: Date, fn: (state: ProbeState) => Promise<T>): Promise<T> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  let lock;
  try { lock = await open(path + '.lock', 'wx', 0o600); }
  catch { throw new ProbeError('Probe lock exists or cannot be created; inspect the previous process before recovery'); }
  try {
    let state: ProbeState;
    let raw: string | undefined;
    try { raw = await readFile(path, 'utf8'); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
    if (raw !== undefined) state = stateSchema.parse(JSON.parse(raw));
    else {
      state = { version: 1, senderBatchId: randomUUID(), senderItemId: randomUUID(), recipientHash: identityHash(recipient), accountHash: identityHash(clientId), amountCents: 100, createdAt: now.toISOString() };
      await saveState(path, state);
    }
    if (state.recipientHash !== identityHash(recipient) || state.accountHash !== identityHash(clientId)) throw new ProbeError('Probe identity does not match recipient or sandbox account');
    const age = now.getTime() - Date.parse(state.createdAt);
    // Stop one day before the provider's 30-day window, allowing for clock skew.
    if (age < 0 || age >= 29 * 86400000) throw new ProbeError('Probe dedupe window expired or clock moved backwards; reconcile manually without sending');
    return await fn(state);
  } finally { await lock.close(); await unlink(path + '.lock'); }
}
