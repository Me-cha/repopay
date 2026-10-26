import { expect, it } from 'vitest';
it('unmatched external requests fail offline', async () => {
  await expect(fetch('https://api-m.sandbox.paypal.com/v1/payments/payouts')).rejects.toThrow();
});
