# ADR 0023: PayPal crypto funding with USD PayPal payouts

Date: 2026-11-10

Status: PayPal-specific decision retained; wallet-payout exclusion superseded by [ADR 0024](0024-pyusd-devnet-route.md). Local crypto-funding implementation; provider acceptance and activation pending. The user confirmed crypto funding with USD PayPal payouts; Hyperwallet is excluded.

## Decision

Offer PayPal's Pay with crypto as an optional sandbox funding method. Store a payment-method snapshot on the funding attempt, with USD amount and existing immutable funded terms. Existing attempts default to PayPal; their terms/hashes do not change. Contributor payouts use the existing USD PayPal path. Crypto wallet delivery is not part of this feature.

`PP_CRYPTO_ENABLED=false` is the default. Enable only after the sandbox merchant completes PayPal crypto onboarding. The documented API requires USD, buyer names and country US; this first integration explicitly restricts buyer selection to US and collects the buyer's own sandbox details. Never infer names from GitHub or invent buyer details. Encrypt names with `PAYMENT_DATA_ENC_KEY`, binding action-token and attempt ciphertext to their respective identities. Do not include names in activity or bot output.

Crypto orders use provider auto-capture. The durable order-submission boundary therefore also reserves the bounty against draft cancellation before calling PayPal. The worker never calls capture for crypto attempts. A lost response reuses the original request key within its safe retry window. Disabling new crypto checkout does not prevent reconciling a previously submitted order. A verified void with no capture releases that reservation. Pending, unknown and mismatched outcomes remain reserved; they cannot start another payment.

Only normalized provider capture evidence with the saved order, reference, terms hash, merchant, USD and exact amount can mark funding complete. Verified webhook links supply an order-ID hint for an authoritative read, never an arbitrary fetch or direct funding decision. Browser return/cancel remains informational. Existing payout idempotency and award-selection guards still apply.

PayPal documents PYUSD refunds for crypto funding. Do not silently apply existing funded-cancellation guarantees: crypto checkout rejects terms with funded cancellation enabled, and the confirmation discloses the provider refund denomination. No automatic crypto refund or new refund entitlement is introduced.

## Scope clarification

The initial proposal for Hyperwallet PYUSD wallet payouts was withdrawn by the user on November 10. That decision applied to the PayPal crypto checkout route; the later direct PYUSD route is recorded separately in ADR 0024. No Hyperwallet code or account integration was added. Existing USD allocation, recipient connection and payout safeguards continue to apply.

See [setup and acceptance checklist](../crypto-payments.md). No live credentials, payment operations, production enablement or deployment are authorized by this local change.

## Sources checked

- [PayPal crypto overview](https://developer.paypal.com/crypto/)
- [Orders crypto integration](https://developer.paypal.com/api/orders-v2/crypto/)
