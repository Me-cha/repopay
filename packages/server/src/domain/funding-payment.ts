import { z } from 'zod';
import type { FundingEnv } from '../env.js';
import type { FundedTerms } from './funded-terms.js';
import { AuthError } from '../github/oauth.js';
import { encrypt,decrypt } from '../util/crypto.js';
// Names are supplied by the buyer, never inferred from GitHub or fabricated.
const name=z.string().trim().min(1).max(140).refine(value=>!/[\p{Cc}\p{Cf}]/u.test(value));
export const cryptoBuyerSchema=z.object({givenName:name,surname:name,countryCode:z.literal('US')}).strict();
export type CryptoBuyer=z.infer<typeof cryptoBuyerSchema>;
export const fundingPaymentSchema=z.discriminatedUnion('method',[
 z.object({method:z.literal('paypal')}).strict(),
 z.object({method:z.literal('crypto'),buyer:cryptoBuyerSchema}).strict(),
]);
export type FundingPayment=z.infer<typeof fundingPaymentSchema>;
export function assertPaymentEnabled(env:FundingEnv,terms:FundedTerms,payment:FundingPayment) {
 if(payment.method==='crypto') {
  if(!env.PP_CRYPTO_ENABLED)throw new AuthError(409,'Crypto funding is not enabled for this sandbox merchant.');
  if(terms.policy.fundedCancellationEnabled)throw new AuthError(409,'Crypto funding is unavailable with funded-cancellation terms.');
 }
}
export const sealCryptoBuyer=(buyer:CryptoBuyer,env:FundingEnv,identity:string)=>encrypt(JSON.stringify(cryptoBuyerSchema.parse(buyer)),env.PAYMENT_DATA_ENC_KEY,'crypto-buyer:'+identity);
export const openCryptoBuyer=(value:string,env:FundingEnv,identity:string)=>cryptoBuyerSchema.parse(JSON.parse(decrypt(value,env.PAYMENT_DATA_ENC_KEY,'crypto-buyer:'+identity)) as unknown);
export const cryptoFundingNotice='Pay with crypto through PayPal sandbox. PayPal converts the payment to USD; bounty awards and contributor payouts remain in USD. PayPal handles any provider refund in PYUSD. Repopay funded cancellation is unavailable for this checkout.';
