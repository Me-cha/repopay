# ADR 0024: Separate PYUSD funding and wallet delivery on Solana devnet

Date: 2026-11-10

Status: Unsigned funding recovery is partially superseded by [ADR 0025](0025-expired-pyusd-funding-recovery.md). Implemented locally; network and wallet acceptance pending. Supersedes ADR 0023's statement that all wallet payouts are out of scope. Its PayPal crypto-to-USD route remains a separate optional feature. Hyperwallet remains excluded.

## Decision

Keep the PayPal USD route and add a default-off PYUSD-only route on Solana devnet. A maintainer explicitly selects the denomination and frozen terms before funding. A draft's numeric amount becomes PYUSD, not an exchange quote; existing funded USD terms cannot change denomination. Contributors receive PYUSD in their saved, ownership-proven wallet after the existing qualifying-merge award decision.

The first implementation uses a custodial devnet treasury, not an escrow smart contract. Repopay controls its signing key. No mainnet RPC, mint override, bridge, swap, exchange withdrawal, Hyperwallet or arbitrary token is supported. This is test-token software, not production custody acceptance.

## Financial boundaries

- Version 6 terms freeze the devnet network, official PYUSD mint, six token decimals, treasury, original refund wallet, denomination and existing review/CI/sponsor policy. Legacy terms/hashes stay intact.
- Store amounts as integer hundredths in existing amount/allocation columns. Convert exactly to token atomic units by multiplying by 10,000. Reject fractional hundredths; allocation sums must equal the committed award. UI labels PYUSD separately; USD aggregate charts exclude PYUSD.
- `solana/wallet.ts` binds a five-minute, single-use Ed25519 proof to the GitHub ID, current session, origin and wallet. Saved wallets survive logout. Session deletion cascades ephemeral challenges. Wallet changes affect future payout reservations only.
- Wallet connection completes before reservation; confirmation and signing run as one browser action. Reservation alone creates no short-lived transaction. The prepare endpoint creates and returns the first immutable message immediately before the wallet signature request; revisits validate the existing message rather than replacing it.
- Funding and PayPal reservations share the bounty row lock. Persist a unique transfer and immutable terms before exposing a transaction for signature. Persist signed bytes before broadcasting; browser callbacks alone never prove funding.
- The adapter pins the devnet genesis, Token-2022 program, mint and decimals. It refuses configured nonzero transfer fees or active transfer hooks when preparing a transfer. Only an exact finalized transaction with the expected signature, message, owners, mint and debit/credit can mark funding or delivery successful.
- A qualifying award still requires the existing candidate ordering, exact revision/evidence, mandatory CI, sponsor and scoped settlement guards. Neither a wallet connection nor a payment transaction selects a winner. Wait for all allocated recipients' saved wallets before reserving the immutable split. Preserve an award while awaiting claim or recovering delivery.
- Persist each outgoing signature and exact signed transaction before any send. Concurrent retries can broadcast only those same bytes. Expired/failed/ambiguous outcomes are held; no automatic replacement transaction is created. Held signed transfers continue read-only reconciliation so late success is discoverable.
- Funding transactions carry a bounded reference account on TransferChecked and a memo immediately before it. A bounded finalized reference lookup can recover an exact prepared message after a lost browser callback. Unrelated incoming transfers never fund a bounty automatically.
- Maintainers pay funding SOL transaction/account-creation costs. The treasury pays outgoing SOL costs separately; reward principal is not reduced for fees.
- Browser transaction signing uses Wallet Standard with explicit `chain: solana:devnet`, checks the authorized account, and refuses a legacy transaction-signing fallback without network context. Before prompting, the server checks the original blockhash on the pinned devnet RPC; expired preparations are retained for reconciliation, never replaced in place.
- Devnet transactions explicitly include a 200,000 compute-unit limit and 100,000 micro-lamports per unit priority fee before signing. This matches the observed Solflare devnet fee (0.00002 test SOL maximum priority fee); added or altered instructions are still rejected. The real devnet funding simulation used 45,392 units.

## Cancellation and recovery

Unfunded drafts retain existing cancellation behavior. Once a chain funding intent is reserved, draft cancellation cannot claim that no funds moved. Funded refunds require both `FUNDED_CANCELLATION_ENABLED` and `PYUSD_REFUNDS_ENABLED` at funding time and at execution, plus the existing 72-hour notice, complete evidence, separate authorized reviewer, no committed award and final transactional guard. Send only to the original proven funding wallet. Recheck provider funding and cancellation evidence before signing/sending; preserve the reservation when evidence changes. A rejection/closed PR does not trigger a refund.

`PYUSD_DEVNET_ENABLED=false` stops all chain processing, including delivery/reconciliation; do not disable it casually while intents remain unresolved. `PYUSD_REFUNDS_ENABLED=false` blocks new refund reservations/sends; previously signed refunds can still be observed when chain processing is on. Recovery mode also holds HTTP mutations and workers. Before restoring a backup, reconcile chain effects missing from that backup independently, as for PayPal.

There is intentionally no automatic blockhash replacement, emergency withdrawal or generic resend button. An abandoned/expired funding transaction or irrecoverable outgoing transaction can require operator reconciliation. Refund evidence changing after reservation also requires investigation. These limitations must be resolved through a separate recovery design before production use, not by editing immutable rows or signing replacements casually.

## Ownership and verification

Migration 0024 owns wallet proofs and immutable funding/payout/refund transfer identities. `solana/config.ts` pins devnet; `provider.ts` owns chain transport/receipt checks; `service.ts` owns reservations and polling. Existing settlement and cancellation services retain award/refund authority. `http/pyusd.ts` is authenticated/CSRF-protected transport; `WalletPage.tsx` handles user wallet interaction. These financial and connection pages are consistent with the existing exception to GitHub-native work actions.

Public wallet addresses and signed transaction bytes are stored for reconciliation and are never treated as secrets or ownership proof by themselves. API access remains account/repository scoped. Private treasury keys are file-based, ignored, never returned or logged. `pnpm pyusd:wallet` creates only a new local test key with exclusive creation and restrictive permissions; it cannot overwrite one or broadcast.

See [setup and pending acceptance](../crypto-payments.md) and [local evidence](../evidence/pyusd-devnet.md).

## Provider references

- [Solana PYUSD mint and extension information](https://solana.com/pyusd)
- [Solana Pay reference account convention](https://docs.solanapay.com/spec)
- [Memo signer requirements](https://www.solana-program.com/docs/memo)
- [Token-2022 incoming memo requirements](https://solana.com/docs/tokens/extensions/memo-transfer)

## Wallet discovery follow-up (November 10)

The user requested wallet-independent support. `WalletPage.tsx` now discovers registered wallets by devnet/signing capabilities, not brand, for both ownership messages and funding transactions. The shared selector handles dynamic registration/removal. Legacy brand-specific injected APIs are removed; no fallback silently drops the explicit transaction network context. Wallet Standard adapters for Phantom, Solflare, Backpack and an arbitrary name are covered with mocks; actual extension acceptance is recorded separately in devnet evidence. No payment policy, recipient binding or server verification changes.
