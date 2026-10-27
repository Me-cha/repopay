import { cents } from '../domain/types.js';
export type Command = { kind: 'create'; amount: string } | { kind: 'status' } | { kind: 'unavailable' } | { kind: 'invalid' };
export function parseCommand(body: string): Command | null {
  let fence: string | undefined;
  for (const raw of body.split(/\r?\n/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(raw)?.[1];
    if (marker) { if (!fence) fence = marker; else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined; continue; }
    if (fence || /^ {4}|^\t/.test(raw)) continue;
    const line = raw.trim(); if (!line || line.startsWith('>')) continue;
    const create = /^\/bounty create ([^\s]+)$/i.exec(line);
    if (create?.[1]) return /^\d{1,9}(?:\.\d{1,2})?$/.test(create[1]) ? { kind: 'create', amount: create[1] } : { kind: 'invalid' };
    if (/^\/bounty status$/i.test(line)) return { kind: 'status' };
    if (/^\/bounty (fund|approve|reject|cancel|link|retry)(?:\s|$)/i.test(line)) return { kind: 'unavailable' };
    return /^\/bounty(?:\s|$)/i.test(line) ? { kind: 'invalid' } : null;
  }
  return null;
}
export function parseLabel(value: string): string | null { return /^bounty:\$(\d{1,6}(?:\.\d{2})?)$/i.exec(value)?.[1] ?? null; }
export function parseUsd(value: string, cap: number) {
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(value)) throw new Error('Invalid amount');
  const [whole = '', fraction = ''] = value.split('.');
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (amount <= 0n || amount > BigInt(cap)) throw new Error('Invalid amount');
  return cents(Number(amount));
}
