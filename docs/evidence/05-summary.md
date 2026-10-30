# Phase 5 — local implementation evidence and open gates

**Current amendment, October 30, 2026:** ADR 0007 and the user's current request retain Copilot Auto. Fixed-model requirements below describe the historical October 29 implementation and are superseded for new v4 terms. The quality gate remains open: the 14/18 pilot is not a pass. See the [implementation review and fixes](00-05-review.md); the evaluator now accepts Auto reports with concrete serving models, current prompt/SDK and complete metrics.

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

## October 29–30, 2026 — first live review run and fixes

The user switched new funding to Copilot Auto ([ADR 0007](../decisions/0007-copilot-auto-model.md)) and funded bounty 5 ([Me-cha/gitpay-test#5](https://github.com/Me-cha/gitpay-test/issues/5)); see [Phase 3 evidence](03-summary.md). PR #4 was then linked to that bounty.

- The first review job failed all five attempts. A read-only replay of the verifier's GitHub calls showed every read succeeding except `GET …/check-runs`, which returned 403. The App's **Checks** permission had been saved but not accepted on the installation. After the user accepted it and the server restarted (clearing the cached installation token), the same reads succeeded.
- The retry page produced a real neutral Check Run on PR #4 and an evidence snapshot. The verdict was `INSUFFICIENT_EVIDENCE` with **no Copilot request**: PR #4's author is the bounty creator, who is excluded from payment by policy. No live Copilot verdict has been produced yet; that needs a PR from a different GitHub account.
- Fixed with regressions in `verification-checks.test.ts`: the Check Run now lists specific reasons (bounty creator's own PR, unverified commit authors, truncation, empty diff, required CI) instead of "authorship is ambiguous"; and a review that reaches an outcome clears a stale "Solution review service unavailable" warning while leaving funding holds untouched. Full suite 37 files / 206 tests, lint and build passed.

Still observed but not yet fixed: worker job failures are not logged with a cause; a retried review that fails before saving a verification row reuses the same retry key; the review-unavailable warning is set on the first failed attempt rather than on exhaustion.

## October 30, 2026 — Phase 5 continuation

The user authorized completing Phase 5 and subsequent phases, approved up to 18 Auto evaluation requests, and explicitly kept organization sponsorship blocked for now. No live evaluation requests have been made in this continuation: the `.env`-selected local database had only Phase 1 tables and no sponsor grant. It was backed up to ignored private `.local/backups/gitpay-before-phase5-20261030.dump`, then the existing migrations through 0009 were applied successfully. Existing data was retained. The current demo bounty is `deepakA18/gitpay-demo-http`, local bounty 1. No funded record from the mate's historical environment was invented or imported.

Implemented and tested:

- Bounded `verifier/evaluate.ts` harness and opt-in CLI mode: 18 sequential application-adapter calls using only a revalidated stored owner sponsor; no payments/publications, no automatic request retry, private checkpointed observations, concrete Auto provenance and policy evaluation for insufficient evidence.
- Transactional retry requests now bind the last queued job generation, deduplicate concurrent POSTs, validate session/bounty/submission state under locks, and recover after a job fails before an attempt row exists.
- Verifier jobs receive lease tokens and fence evidence/attempt/attention writes. External calls remain outside SQL transactions.
- An attempt whose Check Run create response was lost is reconciled by exact SHA, App identity and persisted external attempt ID. Complete paginated reads use `filter=all`; capped or conflicting scans stop recovery. This is advisory publication recovery, not a claim of atomic GitHub writes.
- Review-unavailable attention is set at exhaustion and cannot replace a funding hold or a newer revision's warning. Worker logs now include safe failure category/status/job identifiers without raw provider errors.
- Signed `github_app_authorization` revocation immediately invalidates the user's sessions and sponsor grants with the delivery receipt; generation fencing protects refresh/reconnection, duplicate delivery cannot revoke renewed consent, and in-flight reviews recheck sponsorship before storing a verdict.
- Sponsor UI describes Auto correctly.

Verification: `pnpm typecheck`, `pnpm lint`, `pnpm build` passed. Full `pnpm test` against isolated local test schemas: **41 files / 230 tests passed**. New live-harness tests use a fake adapter and do not establish semantic quality. The configured local sponsor table still had **zero rows** at the last check. No paid model request or sandbox payment was performed. The user approved the configured ngrok tunnel after automatic review initially blocked exposure; the local app runs with `WORKER_MODE=separate`, so background jobs are not running during setup.

Remaining: owner sponsor connection, approved live evaluation (18-request cap), live competing-PR/check/retry/access-loss acceptance, and remaining evidence/provenance cases. Organization support remains explicitly blocked. Phase 5 is not complete and later phase acceptance is not claimed.

Provider contracts checked: [GitHub authorization-revocation webhook](https://docs.github.com/en/webhooks/webhook-events-and-payloads#github_app_authorization), [Check Runs API](https://docs.github.com/en/rest/checks/runs), and [organization server-to-server authentication](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/server-to-server-tokens). No organization billing capability was tested.
