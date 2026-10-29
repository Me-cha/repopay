# Phase 5 — local implementation evidence and open gates

Date: October 29, 2026. Base commit: `c07e62d39dfe95b601d328672839f693daceb15c`. The worktree already contained uncommitted Phase 2/3 and Copilot migration work when this scope began; no existing changes were discarded. Phase 5 was authorized by the user's request to complete Phases 4 and 5.

## Implemented locally

- Durable same-repository PR linking from issue references and `/bounty link <PR>`, with open participation and persistent candidate rows.
- Immutable, bounded evidence snapshots for the exact PR head/base revision, including paginated diffs/commits/check runs, completeness flags, trusted CI provenance and a re-read to detect revision changes.
- Pull-request descriptions are capped at 8,000 characters; truncation makes evidence insufficient instead of silently discarding content.
- Eligibility uses the server-fetched PR author. Additional commit authors are retained as unverified and make evidence insufficient; commit trailers do not become payment identities.
- A strict structured Copilot verdict schema, injection-aware prompt, fixed funded-model/sponsor binding and isolated tool-free SDK call. The verdict and Check Run are advisory; no Phase 5 code awards or pays.
- Neutral GitHub Check Runs, completion-event re-evaluation, a writer-authorized CSRF retry page, duplicate completed-evidence suppression, explicit retry attempts, and a generic attention state after verifier jobs fail.
- Six evaluation fixtures and a report validator that preserves duplicate/misclassified rows, rejects Auto as fixed-model evidence and rejects payable insufficient evidence.
- Per-repository UTC-day and per-PR-SHA attempt caps. The check serializes per-repository/day admissions and blocks over-limit attempts before calling the model; configured limits are GitPay request controls, not guaranteed dollar caps.
- The Copilot SDK usage fields (token/cache counts, total nano-AIU, premium-request cost units, API duration and request count) are validated, returned by the adapter, and persisted on successful verification records through migration `0008`. These fields describe Copilot billing units, not USD. Failed provider attempts may still need usage reconciliation if the SDK returns usage with an error.

## Local verification

Executed with the repository-pinned Node 22.23.4 and pnpm 10.29.3:

- `pnpm test` — 36 files, 194 tests passed, including unit coverage for CI/evidence/verdict/evaluation reports and an integration test for neutral Check Runs, duplicate suppression, explicit retry attempts, and unchanged bounty state.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm build` — passed.
- `pnpm eval:verifier` — fixture catalog validates and prints the required 18 runs (3 per case); it explicitly reports `fixed_model_live_evaluation_not_run`. The separate Auto prototype is recorded below and in [verifier evidence](05-verifier.md).
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm eval:verifier` — rerun after attempt-cap and usage-metric implementation; all pass, 36 test files / 194 tests.
- `git diff --check` — passed.

The database and GitHub integrations in automated tests are local/mocked. No real GitHub Check Run or fixed-model Copilot request was made in this phase work.

The user later authorized a non-payment Auto prototype using the Free sponsor's remaining usage. It completed 18 fixture requests with 14 expected verdict matches; the full-fix and insufficient-evidence cases were inconsistent. This Auto run is recorded in [verifier evaluation evidence](05-verifier.md), does not pass the fixed-model gate, and did not use the application adapter.

## Blocking acceptance gates

1. The repository-owner sponsor must demonstrate access to the fixed funded model. The earlier Auto experiment is not fixed-model evidence.
2. The Copilot SDK adapter now records token/cache counts, nano-AIU, premium-request cost units and latency, and successful verification rows persist those metrics. These are provider usage units, not USD. Failed provider calls may also incur usage; the current persistence path still needs explicit reconciliation for any usage returned only on an error. No local code establishes a hard per-customer spend cap; GitHub account/organization billing settings remain authoritative.
3. Organization-sponsored installation-token onboarding and sponsor-revocation handling are not implemented. Per-repository UTC-day/per-SHA attempt caps and per-verification SDK usage telemetry are implemented locally, but they are not a monetary budget or a customer billing ledger.
4. Run three real requests per fixture under an explicitly approved eligible sponsor; retain model, prompt, SDK, result, latency and SDK-reported usage units. All cases must pass before any verifier output can participate in settlement.
5. Update and approve the live GitHub App's Pull requests and Checks permissions/events, then verify a real PR update, external CI completion, neutral Check Run, retry and access-loss behavior.

**Phase 5 is not complete.** The code establishes the local review pipeline, attempt caps and usage telemetry, but live sponsor access and quality gates remain open. Verifier output must remain informational until these gates and the later deterministic award policy are implemented and verified.
