# Phase 03 — local funding implementation, live gate pending

Date: October 28, 2026. Branch: `feat/phase-03-funding`; base HEAD `c07e62d39dfe95b601d328672839f693daceb15c`. Phase 2 changes remain uncommitted and preserved. No commit, push, deployment or real sandbox checkout has been performed for this phase. Migration 0004 was applied to the local development database; the development server was restarted and `/healthz` returned ready.

The user authorized proceeding and deferred Phase 2's live revoked-write test. That check remains unverified; automated permission revocation coverage remains in the suite. The subsequent Copilot feasibility request is research only and does not replace the Nemotron runtime decision.

## Implemented locally

- Migration 0004 adds historical funding attempts, one active attempt per bounty, separate request keys/boundaries/deadlines, observation versions, immutable terms and funding holds.
- Funding review reads current issue criteria outside transactions, compares the displayed terms hash and consumes a bound single-use confirmation under the bounty lock. Funding actor is persisted.
- Checkout uses sandbox Orders v2, exact USD cents and explicit receiver/reference validation. Saved request payloads retain their original origin across restarts/tunnel changes.
- Durable due-time polling and verified-event jobs reconcile the existing attempt. No return/cancel GET or GitHub comment captures money. Capture reserves the bounty before the external call, and confirmed results commit with observation fencing.
- Only one full final completed capture funds a bounty. Unknown/pending results retain identity and reservation; mismatches/refunds/reversals freeze disbursement. Later award/payout modules do not yet exist; preservation currently means funding/activity history and immutable terms.
- PayPal verification uses bounded calls and original event content. Only SUCCESS permits an atomic deduplicated receipt/job. Intake never performs capture.
- `/bounty fund` offers a confirmation link; `/bounty status` requests reconciliation. Funded activity is durable for future Phase 5 catch-up, and GitHub projection preserves financial holds.

## Verification observed

Node 22.23.4 selected from the ignored `.local/tooling/node_modules/node/bin` path. Tests use `TEST_DATABASE_URL=postgresql://repopay:repopay@127.0.0.1:5433/repopay_test` and isolated temporary schemas; unmatched provider calls are denied.

- Baseline before Phase 3: `pnpm test` — 148/148 tests passed.
- `pnpm test` — 183/183 tests across 26 files passed after final review fixes.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm build` — passed.

Relevant RED→GREEN records are retained locally in `.superpowers/sdd/03/`: intent, checkout, orders, capture, webhook, recovery, unknown capture, provider economics and saved-payload regressions. Additional tests prove stale-observation fencing, restart recovery and revoked permission at funding submission. These are local database/HTTP tests with mocked providers, not evidence of actual PayPal capture or merchant balances.

A fresh whole-change reviewer identified two Important issues. Both were reproduced with failing tests and fixed: malformed/conflicting capture evidence after funding now sets a persistent funding hold, and read-only contributors can follow the published link to frozen criteria while funding POSTs remain writer-only. The full 183-test suite passed afterward. Browser and real sandbox walkthroughs remain pending.

Deferred minor findings: a recovered provider read can leave a stale bounty attention warning, and the `/bounty status` reply still uses reconciliation wording for FUNDED (the main bounty projection correctly shows confirmed funding). These are presentation/recovery-attention limitations, not authorization to retry payments.

## Outstanding external gate

The existing `.env` has PayPal client credentials, but `PP_WEBHOOK_ID`, `PP_MERCHANT_ID` and `POLICY_CI_CONTEXTS` were absent/blank when checked (values were not printed). The real sandbox walkthrough requires the receiving merchant, a registered webhook and an authorized test issue with real trusted CI configured. No fake identifiers were inserted.

Still required: one real $50 sandbox checkout/capture and payer/receiver receipt/balance evidence, abandoned checkout and replay/restart walkthrough, current permission/App access validation. Provider gross/fee/net and available payout balance must be distinguished; no solvency claim is made from mocks. No live funding attempt has yet been made. The test target is now confirmed.

## Recovery limitations

Expired unknown create responses without a known order ID require manual investigation. Declined/failed captures remain reserved conservatively rather than automatically allowing another charge. Polling limits are per worker; aggregate multi-worker quotas are not coordinated. The original tunnel must remain available for existing checkout returns. See [ADR 0004](../decisions/0004-funding-recovery.md) and [setup](../setup.md).

Phase 03 is **not complete** until its external exit gate is evidenced. Phase 04 is not authorized by this work.


## October 29, 2026 — resumed live-test preparation

Created the user-authorized sandbox test fixture [Me-cha/repopay-test#3](https://github.com/Me-cha/repopay-test/issues/3) in the signed-in Brave session. It states this is a PayPal sandbox test, not a real-money reward, and records the synthetic addition task and Phase 3 acceptance checks. No Repopay command or payment was submitted to the issue.

The local server answers `/healthz` with HTTP 200. The configured public tunnel is unavailable. A redacted local configuration check found merchant ID, PayPal webhook ID, trusted CI contexts and Copilot fixed model unset. `pnpm preflight --model-only` exits 1 because the authenticated sponsor has no fixed models listed; the production adapter still requires a fixed model. The full five Phase 3 integration files passed locally (30 tests) against local PostgreSQL and mocked external services; these do not evidence a real PayPal capture. No Phase 3 payment has been made.

## October 29, 2026 — why funding never ran, and a fixed connection bug

Funding reaches checkout only after, in order: a connected repository sponsor with the fixed model, `PP_MERCHANT_ID`, trusted CI contexts when `POLICY_CI_REQUIRED=true`, and non-empty issue criteria (`http/fund.ts`, `domain/funded-terms.ts`).

- **Code bug, fixed:** the sponsor page's Connect button could never reach GitHub. Mutation forms submit through same-origin `fetch`; the server answered with a 303 to `github.com/login/oauth/authorize`, which `fetch` cannot follow cross-origin, so the browser showed "The response was interrupted". The endpoint now returns the validated authorize URL as JSON and `actions.js` navigates to it only if it is GitHub's authorize endpoint. Regression `test/integration/sponsor.test.ts` failed (HTTP 303) before the fix; full suite 37 files / 198 tests passed after.
- **Account blocker:** Me-cha is on Copilot Free, which offers Auto only; the sponsor callback rejects an account without `gpt-6-luna`.
- **Configuration blockers:** `PP_MERCHANT_ID`, `PP_WEBHOOK_ID` and `POLICY_CI_CONTEXTS` are unset while `POLICY_CI_REQUIRED` is set. Values were not printed.

No browser sponsor connection or live funding was attempted at that point.

## October 29, 2026 — first live sandbox capture

After the Auto decision ([ADR 0007](../decisions/0007-copilot-auto-model.md)) the user set `PP_MERCHANT_ID`, `PP_WEBHOOK_ID` (all Checkout and Payment events subscribed), `COPILOT_MODEL=auto` and `POLICY_CI_REQUIRED=false`. The server was restarted on Node 22.23.4 behind the stable ngrok domain.

- The user connected Me-cha as the repository sponsor through the fixed sponsor flow and funded bounty 5 ([Me-cha/repopay-test#5](https://github.com/Me-cha/repopay-test/issues/5), $40.00) with **version 4 (Auto) terms**.
- The first approval attempt did not complete: a read-only PayPal order read returned `PAYER_ACTION_REQUIRED` with the merchant and amount matching. Paying requires a Personal sandbox buyer; the Business account is the receiving merchant and cannot pay itself. The retry in a private window succeeded.
- Local database after capture: bounty `FUNDED`; funding attempt 1 `COMPLETED` (order `…7935`, capture `…3228`); a `funded` activity recorded gross 4000, fee 249, net 3751 cents. Two PayPal webhook deliveries (`…047334`, `…839604`) passed signature verification. The GitHub projection job completed.
- Fixed with regression: `/bounty status` replied "Funding state requires reconciliation" for FUNDED bounties; it now reports confirmed funding (or a frozen hold). Full suite 37 files / 204 tests.

Still open for the Phase 3 gate: payer/receiver balance or receipt check in the sandbox UI, the abandoned-checkout walkthrough, and a restart/replay observation during a live checkout. CI-required funding was not exercised (CI disabled by the user for this demo).

After the user directed a fixed lower-cost model approach, [ADR 0006](../decisions/0006-fixed-lightweight-copilot-and-sponsorship.md) proposes `gpt-6-luna` for a controlled pilot and per-repository owner/organization sponsorship. It clarifies that provider/configuration errors make a result unavailable for settlement; they do not constitute a negative judgment of the contributor’s work. It does not alter v1/v2 terms or application behavior. Current Phase 3 capture remains blocked by explicit model access and missing PayPal/CI/tunnel configuration.
