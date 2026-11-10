# Crypto payments — implementation and account setup

Two independent routes are implemented locally behind default-off flags. Direct PYUSD funding, qualifying merge, automatic 1-PYUSD wallet payout and recipient receipt passed locally on devnet (bounty 9 / issue 21 / PR23). Hosted chain acceptance remains pending. The optional PayPal crypto checkout remains unverified. Existing PayPal USD payments stay available.

| Funding option | Where funds are held | Contributor receives |
| --- | --- | --- |
| PayPal USD | Configured sandbox Business PayPal account | USD through PayPal Payouts |
| Direct PYUSD on Solana devnet | Repopay's custodial devnet treasury | PYUSD in the contributor's saved wallet |
| Optional PayPal Pay with crypto | PayPal converts/settles the funding in USD | USD through PayPal Payouts |

The user's selected crypto-to-crypto route is **direct PYUSD on Solana devnet**. No Hyperwallet or mainnet is involved. See [ADR 0024](decisions/0024-pyusd-devnet-route.md).

## Direct PYUSD: local setup

1. Use the pinned Node/pnpm versions and `pnpm install --frozen-lockfile`. Apply migrations through `pnpm db:migrate`; migration 0024 follows 0023. Keep existing database records and keys.
2. Run `pnpm pyusd:wallet` once to create an ignored test treasury key at `.local/pyusd/treasury.json`. It prints only the public address and file path, refuses to overwrite existing keys and makes no network call. Keep this key available across restarts; do not paste it into GitHub, logs or chat.
3. In the local environment, set `PYUSD_TREASURY_KEY_FILE` to that file's absolute path and `PYUSD_DEVNET_ENABLED=true` for the web and settlement worker. Keep `PP_BASE` sandbox and other existing auth/sponsor settings. There is no supported mainnet URL override.
4. Obtain **devnet SOL** for the maintainer and treasury and test PYUSD for the maintainer through the [Paxos test faucet](https://faucet.paxos.com/). The pinned devnet mint is `CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM`. Do not use real funds. Treasury SOL covers outgoing fees and token-account creation.
5. Use the same local HTTPS origin for the app, GitHub OAuth callback and browser. A hosted callback does not authenticate the local app. Keep web and worker on the same database/configuration and run the existing worker mode appropriate to that environment.
6. Sign into GitHub through Repopay and open `/dashboard/wallet` (linked from payout settings). Select an installed Solana Wallet Standard wallet (for example Phantom, Solflare or Backpack) that exposes devnet and message signing, then sign the ownership message. Funding additionally requires legacy transaction signing with explicit devnet context. The saved wallet is reused; returning users are not prompted again unless they choose to change it. Contributors perform this step in their own GitHub sessions.
7. In a separately authorized fresh demo issue, follow the bot's funding link and choose the PYUSD option. Review the denomination/criteria/cancellation policy, confirm terms, then sign the prepared transaction in the funding wallet. Refresh status until finalized funding shows FUNDED. Do not send manually to the treasury or create a second intent while the first is pending.
8. After the authorized PR review/merge walkthrough, the existing qualifying-award process reserves delivery to the saved recipient(s). A missing wallet yields AWAITING_CLAIM; connecting it resumes polling. Preserve the exact settlement scope and normal review guards. No additional Copilot allowance is implied by setup.
9. Confirm on-chain finalized delivery, application PAID and recipient receipt. The local bounty-9 walkthrough established these live results; hosted chain acceptance remains separate.

Funded PYUSD cancellation is **off by default**. To test it, explicitly enable both `FUNDED_CANCELLATION_ENABLED=true` and `PYUSD_REFUNDS_ENABLED=true` before funding, configure the existing independent operator identities and follow the existing notice/evidence/review procedure. Those terms freeze a 72-hour notice. Refunds go only to the original funding wallet; changing a saved payout wallet cannot redirect them. Existing nonrefundable terms cannot be upgraded by changing flags.

### Flow coverage and limits

| Case | Local behavior |
| --- | --- |
| Wallet already saved | Reused for future rewards; no signature prompt on page load |
| Duplicate funding/cross-provider race | One reservation under the shared bounty lock |
| Wallet rejects signing | No transaction broadcast; existing reservation remains |
| Browser closes / RPC response lost | Exact reference/transaction reconciliation; no new payment identity |
| Qualifying merge | Existing review/CI/authorization guards commit one award |
| Recipient not connected | Award retained; AWAITING_CLAIM until all allocated wallets are saved |
| Two confirmed contributors | Immutable exact-sum split, same award rules as USD |
| Failed/unknown transfer | HOLD and operator investigation; original award/transaction retained |
| Late success | Read-only reconciliation can complete the original held transfer |
| Unfunded cancellation | Existing draft cancellation, blocked once funding is reserved |
| Funded cancellation | Separately enabled notice/independent review; original-wallet refund |
| Wrong mint/network/amount or receipt | Fail closed; no funding/payout success claimed |

Expired unsigned funding can recover on the same bounty after finalized absence checks under ADR 0025. Signed or uncertain transfers stay held for operator reconciliation; migration 0026 permits only the one explicitly approved historical bounty-9 recovery. A stale refund reservation likewise remains held. Do not edit immutable rows or send a replacement manually. This is a local devnet implementation, not production-ready custody or an on-chain escrow contract.

### Direct PYUSD acceptance

- [x] Local wallet, funding, award, payout, cancellation/refund and recovery tests with mocked providers.
- [ ] Local browser wallet signing with actual devnet test tokens.
- [ ] Finalized devnet funding and callback-loss recovery.
- [x] Qualifying merge, automatic wallet payout and recipient receipt (PR23 → 1 PYUSD to 0xdeepak18, finalized and user-confirmed).
- [ ] Devnet funded-refund walkthrough under the existing notice/review policy.
- [ ] Hosted deployment with protected treasury key and operational recovery review.

See [verification evidence](evidence/pyusd-devnet.md). No new deployment or live chain exercise was performed during implementation.

## PayPal crypto funding

1. Use an eligible sandbox US Business merchant. In its PayPal account, open **Account Settings → Products & Services → Payment Methods → Pay with crypto → Get Started**. If unavailable, use [sandbox crypto onboarding](https://www.sandbox.paypal.com/bizsignup/add-product?product=CRYPTO_PYMTS). Wait for eligibility/activation; ordinary Orders access does not establish crypto access.
2. Keep `PP_BASE=https://api-m.sandbox.paypal.com`. Use the same merchant-bound sandbox credentials and merchant ID already configured for funding.
3. Subscribe to capture completion/denial and order-decline events, retaining existing funding events. The app also reconciles saved order identities if an event is missing.
4. Deploy migration `0023_crypto_funding` with the matching server artifact using the existing migration/release process. This change does not alter old funding terms.
5. After onboarding, set `PP_CRYPTO_ENABLED=true` for web and worker. This exposes **Continue with crypto** alongside regular PayPal on the authenticated funding page. No production endpoint is supported.
6. In a separately authorized sandbox case, enter the buyer's sandbox name and select US, review the crypto disclosure, confirm, and follow PayPal's approval link. Use only the test wallet/exchange flow supplied by PayPal; do not connect a real funded wallet for an unverified sandbox exercise.
7. Verify provider capture, exact USD amount, merchant/reference, saved FUNDED state and eventual delivery. A browser return is not payment evidence. Do not start another checkout while the existing attempt is unresolved.

PayPal automatically captures crypto approval, unlike our ordinary PayPal checkout. Disabling the flag blocks new crypto checkout; already submitted orders continue reconciliation. Funded cancellation is unavailable for crypto checkout. PayPal's provider refunds are denominated in PYUSD, as disclosed before checkout. Current principal and rewards remain USD.

The approval URL allowlist is retained. If the sandbox supplies an unsupported approval URL, keep the attempt held and inspect only a redacted host/path and saved order ID; do not broaden the allowlist speculatively or create a replacement payment.

## Contributor payouts for the PayPal crypto option

The bounty stays denominated in USD. PayPal converts the funding payment to USD, and the existing qualifying-merge workflow pays contributors through PayPal Payouts in USD. Contributors use their existing PayPal connection; no wallet address, Hyperwallet account or new payout route is needed.

## PayPal crypto acceptance checklist

- [x] Sandbox onboarding completion screen observed (user screenshot, November 10, 2026).
- [ ] Crypto API access verified for the configured merchant through the first sandbox checkout.
- [ ] Crypto checkout completes with a verified USD capture; missing return/webhook still reconciles.
- [ ] No server capture POST occurs for a crypto order.
- [ ] A crypto-funded sandbox bounty completes the existing qualifying-merge USD PayPal payout, with recipient receipt confirmed.

Local automated coverage is recorded in [crypto funding evidence](evidence/crypto-funding.md). Unchecked provider steps are not passing acceptance results.

Sources: [PayPal crypto integration](https://developer.paypal.com/api/orders-v2/crypto/), [overview and eligibility](https://developer.paypal.com/crypto/).

For direct devnet checkout, review the terms and click **Confirm terms and fund with wallet**. Connection, reservation, preparation and the signing prompt run in that order within one action. Approve the devnet transaction promptly. A resumed unsigned checkout uses **Continue funding in wallet**; expired messages remain preserved and cannot be silently refreshed.

### Expired unsigned devnet checkout

Use the same bounty link and select the signing wallet containing the original funding address. **Continue funding in wallet** checks the expired attempt on devnet. Only an unsigned, unheld attempt with finalized expiry and no reference activity can be replaced. History stays preserved; uncertain or already signed transfers require reconciliation. Approve the new transaction promptly and keep the page open. Errors identify the failing stage beside the button. See [ADR 0025](decisions/0025-expired-pyusd-funding-recovery.md).

Solflare compatibility: new devnet preparations include a 100,000-micro-lamport compute-unit price and a 200,000-unit limit (0.00002 test SOL priority fee, plus base fee and any account creation). A real Solflare response was observed replacing a zero price with that value. The app prepares it explicitly instead of accepting wallet-modified transactions. The full signed message must still match exactly.

November 10 follow-up: approved devnet funding submissions reconcile immediately after durable signed-byte persistence. A separately approved, audited one-off expiry exception for bounty 9 is documented in ADR 0025; it does not enable automatic signed/held replacement. Live finalized 1-PYUSD funding and contributor delivery subsequently passed, with recipient receipt confirmed.

### Wallet compatibility

The wallet selector discovers capabilities through [Wallet Standard](https://github.com/anza-xyz/wallet-standard), without a wallet-name allowlist or a Phantom/Solflare injected-provider preference. It updates on registration/removal and applies the user's selected wallet to both ownership proof and funding. Ownership uses `solana:signMessage`; funding uses `solana:signTransaction` with `solana:devnet` and legacy transaction support. Wrong accounts/networks, altered messages and altered transaction bytes are rejected. Saved destinations remain reusable without reconnecting on page load.

This supports compatible registered browser wallets; it does not promise every wallet/version, mobile deep links, hardware setup or unsupported signing mode. Solflare funding has real devnet evidence; other brands currently have simulated adapter coverage only. No new chain transfer is needed to install this UI change.
