# Contributing to GitPay

GitPay has a Phase 0 local foundation; product workflows and external feasibility remain pending. Read [README.md](README.md), [AGENTS.md](AGENTS.md) and the relevant phase of [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) and its [numbered phase file](docs/phases/README.md) before starting implementation. Phase 0 is authorized. Later phases require explicit scope authorization and their prerequisite gates.

## Workflow

1. Keep changes focused on the requested issue or implementation phase. Explain the problem and intended behavior before changing product policy.
2. Inspect existing work before editing. Use a focused branch for your contribution and preserve unrelated changes.
3. Keep business logic separate from HTTP/webhook transport; implement the plan's authorization and monetary invariants together with each feature.
4. Update documentation in the same change. Folder or entrypoint changes require an updated `AGENTS.md` map, relevant README links and plan layout. Configuration changes require an updated `.env.example` and validation.
5. Describe what changed, why, the verification performed and any remaining limitations in your PR. Use the repository PR template.

## Checks

Use Node from `.node-version` and pnpm from `package.json`. Follow [setup](docs/setup.md), run `pnpm install --frozen-lockfile`, then `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build`. `pnpm test` requires an explicitly exported local `TEST_DATABASE_URL` ending in `_test`; it never loads `.env`. Tests create unique schemas and drop only their own fixtures. Missing Postgres/configuration fails the suite rather than silently skipping tests. Unmatched external HTTP calls are blocked by Nock.

Check relative documentation links, actual paths, whitespace and agreement between the README, plan and agent instructions. Run `git diff --check` and inspect untracked files too. Provider integration evidence must distinguish mocks from actual PayPal sandbox/GitHub/NVIDIA calls.

Financial changes must cover repeated events, unauthorized actors, stale confirmations, provider timeouts, concurrent allocation and cancellation abuse. Never claim a sandbox payout was verified based on a mocked test.

## Configuration and secrets

`.env.example` is a template for the runtime, including a separate `TEST_DATABASE_URL`, payment-data encryption key and bounded provider/reconciliation settings. Copy it to `.env` and populate credentials locally. `.env` files and private keys are ignored; examples remain tracked. Do not include credentials, contributor payment addresses or unredacted provider payloads in PRs.

Keep PayPal sandbox-only. Connecting a real repository, sending bot comments, creating payment operations, publishing or deploying requires the relevant task authorization; adding documentation does not perform those actions.

## Decisions

The [decision records](docs/decisions/) explain policy choices. Keep historical decisions, mark them superseded when appropriate, and link their replacements. Runtime provider changes and changes to cancellation or reward-selection policy need explicit reasoning; they are not incidental refactors.
