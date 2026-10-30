# Contributing to GitPay

GitPay has completed Phases 0 and 1; Phases 2–3 are implemented locally with outstanding live gates. Phases 4–5 were authorized on October 29, 2026; consult their evidence for local coverage and remaining browser/Copilot acceptance. Read [README.md](README.md), [AGENTS.md](AGENTS.md) and the relevant phase of [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) and its [numbered phase file](docs/phases/README.md) before starting implementation. Later phases require explicit scope authorization and prerequisite gates.

## Workflow

1. Keep changes focused on the requested issue or implementation phase. Explain the problem and intended behavior before changing product policy.
2. Inspect existing work before editing. Use a focused branch for your contribution and preserve unrelated changes.
3. Keep business logic separate from HTTP/webhook transport; implement the plan's authorization and monetary invariants together with each feature.
4. Update documentation in the same change. Folder or entrypoint changes require an updated `AGENTS.md` map, relevant README links and plan layout. Configuration changes require an updated `.env.example` and validation.
5. Describe what changed, why, the verification performed and any remaining limitations in your PR. Use the repository PR template.

## Checks

Use Node from `.node-version` and pnpm from `package.json`. Follow [setup](docs/setup.md), run `pnpm install --frozen-lockfile`, then `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build`. `pnpm test` requires an explicitly exported local `TEST_DATABASE_URL` ending in `_test`; it never loads `.env`. Tests create unique schemas and drop only their own fixtures. Missing Postgres/configuration fails the suite rather than silently skipping tests. Unmatched external HTTP calls are blocked by Nock.

Check relative documentation links, actual paths, whitespace and agreement between the README, plan and agent instructions. Run `git diff --check` and inspect untracked files too. Provider integration evidence must distinguish mocks from actual PayPal sandbox/GitHub/Copilot calls.

Financial changes must cover repeated events, unauthorized actors, stale confirmations, provider timeouts, concurrent allocation and cancellation abuse. Never claim a sandbox payout or capture was verified based on a mocked test. Funding tests cover persisted request keys, no POST after retry expiry, exact terms/merchant/amount binding, capture/cancellation races and read-only return routes.

## Configuration and secrets

`.env.example` is a template for the runtime, including a separate `TEST_DATABASE_URL`, payment-data encryption key and bounded provider/reconciliation settings. Copy it to `.env` and populate credentials locally. `.env` files and private keys are ignored; examples remain tracked. Do not include credentials, contributor payment addresses or unredacted provider payloads in PRs.

Keep PayPal sandbox-only. Phase 08 first enables cancellation only in the explicitly authorized isolated test deployment after local safety checks; wider enablement waits for real notice/refund evidence. Connecting a real repository, sending bot comments, creating payment operations, publishing or deploying requires the relevant task authorization; adding documentation does not perform those actions.

## Decisions

The [decision records](docs/decisions/) explain policy choices. Keep historical decisions, mark them superseded when appropriate, and link their replacements. Runtime provider changes and changes to cancellation or reward-selection policy need explicit reasoning; they are not incidental refactors.

Provider feasibility uses `pnpm preflight` (read-only), `--model-only` for Copilot model listing, `--model-probe` for an explicit sponsored Copilot generation, and explicit `--sandbox-payment` for the persisted sandbox payout identity. Preflight validates only consumed provider settings; HTTP and worker startup validate GitHub/database/session and Phase 3 sandbox funding settings using `parseFundingEnv`. Full `parseEnv` remains strict for later capabilities. See [setup](docs/setup.md) and [ADR 0005](docs/decisions/0005-copilot-verifier.md).

Phase 1 worker commands: `pnpm dev:worker` and `pnpm start:worker` (after build). Set `WORKER_MODE=separate` on the HTTP server when using them. See [setup](docs/setup.md#phase-1-demo-and-workers).

For stable local GitHub OAuth and webhook callbacks, set the account-assigned `NGROK_DOMAIN` and matching HTTPS `PUBLIC_URL`, then run `pnpm tunnel` beside `pnpm dev`. See [stable local tunnel setup](docs/setup.md#stable-local-tunnel).

Copilot tests inject a fake runtime; they do not spend credits. Live SDK generation needs an explicitly consenting sponsor credential and selected model. Keep prior provider evidence historical, and never rewrite saved funded terms when changing providers.

`pnpm eval:verifier` is report-only by default. The opt-in `--live --repo-id <id> --output <new-file> --allow-18-requests` mode uses the stored repository sponsor and consumes up to 18 requests only after explicit budget approval. It runs synthetic evidence through the application adapter and does not publish or pay. See [bounded live evaluation](docs/setup.md#bounded-live-auto-evaluation). Never count fixture catalog readiness as a live evaluation pass.

Phase 6 local implementation is authorized; automatic selection remains gated by Phase 5 acceptance. Apply the new migrations with workers stopped as described in [setup](docs/setup.md#phase-6-local-awards-and-payouts). Award/payout tests cover concurrent reservation, immutable destinations/account identity, expired retries, delayed multi-author claims and returns after payment. Run the integration suites against an isolated `TEST_DATABASE_URL`; mocked results do not satisfy the live payout walkthrough.

Phase 6 activation is default-off and scope-bound; see [scoped sandbox activation](docs/setup.md#scoped-phase-6-sandbox-activation). Changes to its boundaries need negative tests for wrong bounty/repository/amount/terms, revoked sponsorship and unaccepted serving models. Never activate a scope to silently waive a documented acceptance gate.

Phase 7 review regression coverage is in `packages/server/test/integration/review-approve.test.ts` (preview, approval, rejection and HTTP boundaries), alongside award-selection and command tests. Migration 0013 is required for review history. See `docs/setup.md` for review commands; provider calls in the local tests are mocked.

## Phase 8 local cancellation/refund verification

Apply migration 0014 after backing up Postgres and stopping workers, then restart. Keep `FUNDED_CANCELLATION_ENABLED=false`; no live refund exercise is authorized now. Future explicitly authorized isolated activation also requires `CANCELLATION_SANDBOX_REPO_ID` and independent `CANCELLATION_OPERATOR_GH_IDS`. Only new version 5 Auto terms disclose cancellation; existing terms/hashes stay intact. The notice is always 72 hours from confirmed publication. Local tests inject time and mock providers; they do not satisfy live notice/refund acceptance.

Run `pnpm typecheck`, `pnpm lint`, `TEST_DATABASE_URL=postgresql://gitpay:gitpay@127.0.0.1:5433/gitpay_test pnpm test`, and `pnpm build` using the pinned Node version. Follow the cancellation operations guide for state inspection; never reset an uncertain refund or create a replacement key.

## Phase 9 dashboard verification

`pnpm typecheck`, `pnpm test` and `pnpm build` now cover server and web. Run `pnpm exec playwright install chromium` once, then `TEST_DATABASE_URL=postgresql://gitpay:gitpay@127.0.0.1:5433/gitpay_test pnpm test:e2e` for isolated browser journeys on port 4317. Provider boundaries are mocked; no `.env`, live model request or payment is used. Test-only login routes must remain outside production `src/`. Rebuild web assets to preview changes on the server's `/dashboard/` route. See [dashboard setup](docs/setup.md#phase-9-dashboard-and-local-browser-verification).
