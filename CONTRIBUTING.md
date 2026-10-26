# Contributing to GitPay

GitPay is currently a documented design and repository foundation. Read [README.md](README.md), [AGENTS.md](AGENTS.md) and the relevant phase of [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) and its [numbered phase file](docs/phases/README.md) before starting implementation. The phase plan is currently a review draft; execution begins after the user reviews the scope and proposed refinements.

## Workflow

1. Keep changes focused on the requested issue or implementation phase. Explain the problem and intended behavior before changing product policy.
2. Inspect existing work before editing. Use a focused branch for your contribution and preserve unrelated changes.
3. Keep business logic separate from HTTP/webhook transport; implement the plan's authorization and monetary invariants together with each feature.
4. Update documentation in the same change. Folder or entrypoint changes require an updated `AGENTS.md` map, relevant README links and plan layout. Configuration changes require an updated `.env.example` and validation.
5. Describe what changed, why, the verification performed and any remaining limitations in your PR. Use the repository PR template.

## Checks

There are no application scripts or dependencies yet. For the current documentation foundation, check relative links, file paths, whitespace and agreement between the README, plan and agent instructions. Run `git diff --check` for tracked edits, and inspect new files too.

Phase 0 must add reproducible dependency installation with a committed lockfile, linting, strict TypeScript checking and tests. After that, the phase gates are `pnpm typecheck`, `pnpm lint` and `pnpm test`; use the package manifest for actual available commands. Provider integration evidence must distinguish mocks from PayPal sandbox/GitHub calls.

Financial changes must cover repeated events, unauthorized actors, stale confirmations, provider timeouts, concurrent allocation and cancellation abuse. Never claim a sandbox payout was verified based on a mocked test.

## Configuration and secrets

`.env.example` is a template for the planned runtime, including a separate `TEST_DATABASE_URL`, payment-data encryption key and bounded provider/reconciliation settings. Copy it to `.env` only when setting up implementation, then populate credentials locally. `.env` files and private keys are ignored; examples remain tracked. Do not include credentials, contributor payment addresses or unredacted provider payloads in PRs.

Keep PayPal sandbox-only. Phase 08 first enables cancellation only in the explicitly authorized isolated test deployment after local safety checks; wider enablement waits for real notice/refund evidence. Connecting a real repository, sending bot comments, creating payment operations, publishing or deploying requires the relevant task authorization; adding documentation does not perform those actions.

## Decisions

The [decision records](docs/decisions/) explain policy choices. Keep historical decisions, mark them superseded when appropriate, and link their replacements. Runtime provider changes and changes to cancellation or reward-selection policy need explicit reasoning; they are not incidental refactors.
