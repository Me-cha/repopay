import { expect, it } from 'vitest';
import { cents, githubId, providerId } from '../../src/domain/types.js';
it('large_id_roundtrip_preserves_value', () => {
  const value = githubId('900719925474099312345');
  expect(JSON.parse(JSON.stringify({ value }))).toEqual({ value: '900719925474099312345' });
  expect(providerId('PAY-abc123')).toBe('PAY-abc123');
  expect(() => githubId(9007199254740992)).toThrow();
});
it.each([-1, 1.1, NaN, Infinity, 2147483648, '100'])('cents_reject_fraction_or_overflow %s', value => {
  expect(() => cents(value)).toThrow();
});
it('allows zero and exact SQL integer cents', () => {
  expect(cents(0)).toBe(0);
  expect(cents(2147483647)).toBe(2147483647);
});
