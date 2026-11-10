# Crypto funding verification — November 10, 2026

Scope: optional PayPal sandbox crypto funding. The user confirmed existing USD PayPal payouts; Hyperwallet and wallet delivery are excluded. Nothing was committed, pushed, deployed or enabled on a hosted service in this task.

## Implemented locally

- Default-off `PP_CRYPTO_ENABLED`, separate crypto checkout form, explicit US buyer details and payment/refund disclosure before confirmation.
- Migration 0023: legacy attempts default to PayPal; new method/buyer identity is immutable. Buyer names are encrypted and excluded from activity records.
- PayPal crypto request with auto-completion on approval; manual capture is never invoked for crypto attempts.
- Cancellation reservation saved before external order creation; lost-response retries preserve the same identity and encrypted buyer snapshot. Disabling new checkout still permits submitted-order reconciliation.
- Signed crypto webhook order-link hints schedule authoritative reads. Exact order/amount/merchant/reference/terms/capture checks still govern funding. A browser return/cancel cannot prove payment.
- Existing funded terms, USD award allocation and PayPal payout route are preserved. Funded-cancellation-enabled terms reject crypto checkout.

## Verification

- A new adapter regression failed first: the old implementation sent a PayPal payment source without crypto auto-completion. It passed after the change.
- Focused funding/orders/webhook suite: **60 passed**; one additional cancellation/retry test was subsequently added and included in the full suite.
- `pnpm test` with `TEST_DATABASE_URL` pointing to the local isolated test database: **451 server tests + 8 web tests passed**.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed (existing dependency directive warnings from the frontend build).
- `git diff --check`: passed.

Tests use mocked PayPal and temporary PostgreSQL schemas. No PayPal order, capture, refund, payout or Copilot request was made. Tests cover duplicate confirmation, encrypted identity, immutable method, disabled checkout, cancellation fencing, concurrent reconciliation, response loss, retry expiry, capture mismatch/pending/decline/unknown, return-token binding, input validation and verified webhook hints.

## Remaining acceptance

### Local sandbox preparation — November 10

The user chose local testing before publishing. Existing local migration hashes were verified (19 applied), then the five pending migrations through 0023 were applied and the compatibility check passed. The local server and existing HTTPS tunnel returned healthy status. Crypto checkout is enabled only in this server process; the general worker and settlement scope are disabled. PayPal sandbox OAuth authentication passed, which does not prove crypto entitlement. No new order or payment has been created. The hosted app and `.env` were not changed.

The user subsequently approved one fresh $1 sandbox funding-only test. [Demo issue #17](https://github.com/deepakA18/gitpay-demo-http/issues/17) maps to local bounty 5, prepared through the draft domain action after installation/repository/maintainer checks, with an operator audit entry. The saved personal repository sponsor was checked without a model call. A bounded local poller processes only this bounty's crypto attempt, stops on attention or FUNDED, and refuses manual capture. Checkout confirmation and provider acceptance remain pending; no Copilot, merge or contributor payout is authorized for this case. The checkout link is shared privately in chat; automatic approval review blocked publishing it in an issue comment, so no such comment was posted.

- [x] User supplied the sandbox onboarding completion screen on November 10: “You’re set to receive crypto payments.” The screen also identifies sandbox mode; this is UI evidence, not proof of API entitlement or a successful payment.
- [ ] Configured merchant API access and exact sandbox approval-link/return contract validated.
- [ ] Actual sandbox crypto funding/capture and checkout recovery verified.
- [ ] Crypto-funded bounty completes a qualifying merge and the existing USD PayPal payout, with recipient receipt confirmed.

The current approval URL allowlist remains intentionally narrow; a new provider redirect shape must be verified before adding it. These local tests do not establish provider or production acceptance. Wallet payouts are out of scope. See [setup/access steps](../crypto-payments.md) and [ADR 0023](../decisions/0023-paypal-crypto-funding.md).

Scope clarification: documentation was reconciled with the final USD-payout decision. Runtime code already implements that scope; no code or configuration changed for this clarification. Local documentation links and `git diff --check` were checked.

## Saved payout destination UX follow-up

Payout settings now reuse the saved connection without presenting a blank edit form by default. The contributor explicitly chooses Change payout destination; cancel clears the unsaved input, and successful saving closes the editor. The legacy `/connect` page likewise collapses editing for a connected account. A missing dashboard connection-status response displays an unavailable state with retry, not an instruction to connect again. This does not implement wallet payouts or change payment policy. Three added DOM regressions cover saved-state reuse, explicit editing/cancellation, initial connection and unavailable status. The full local suite, typecheck, lint and build passed; provider acceptance remains separate. Changes are local and unpublished.
