# Phase 5 — local implementation evidence and open gates

**Current amendment, October 30, 2026:** ADR 0007 and the user's current request retain Copilot Auto. Fixed-model requirements below describe the historical October 29 implementation and are superseded for new v4 terms. The historical pilot was not a pass; the current v2 application-adapter evaluation passed 18/18 (see the latest amendment below). The live workflow gate remains open. See the [implementation review and fixes](00-05-review.md); the evaluator now accepts Auto reports with concrete serving models, current prompt/SDK and complete metrics.

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


## October 30, 2026 — connected demo sponsor and evidence correction

The owner connected the separate sponsor grant for `deepakA18/gitpay-demo-http` (repository 1435468752, installation 175753017). Fresh authenticated reads confirm the demo App and repository binding; the saved sponsor is `deepakA18`, profile `auto`, not revoked. Setup required replacing the old App credentials, registering the callback, correcting the OAuth client secret and restarting the server. Secrets were not printed or retained in evidence. Workers remain disabled during setup.

Read-only GitHub inspection showed the App and installation still had only Issues write/Metadata read permissions and Issues/Issue comment events at the time of inspection. Pull requests read and Checks write plus PR/check events are still needed for the live walkthrough; the user was given the setup steps. The current demo bounty 1 is OPEN and has no captured funding. No funding was fabricated or copied from another environment.

A regression exposed silently omitted filtered-file changes. The collector now marks any such omission as truncated/insufficient, requiring review; it does not infer irrelevance from a filename. The regression failed before the change and passed afterward. `pnpm typecheck`, `pnpm lint`, `pnpm build` and the full isolated-database suite passed: **44 files / 254 tests**. This conservative fix does not alter the model prompt or synthetic evaluation inputs.


The first connected-sponsor evaluation completed 18/18 requests with complete serving-model and usage evidence; 17 verdicts matched. One insufficient-evidence case returned DOES_NOT_RESOLVE instead of PARTIAL and was non-payable. The gate failed. See [full evaluation evidence](05-verifier.md) and [redacted v1 observations](05-auto-v1-20261030.json). Prompt v2 explicitly distinguishes incomplete evidence (PARTIAL) from sufficient evidence that does not resolve the criteria; expected fixtures and deterministic financial guards were not weakened. Local checks passed again: 254 tests, typecheck, lint and build. A separately approved second 18-request run is in progress.


After the owner approved the installation update, a fresh GitHub read verified installation 175753017 now has Checks write, Pull requests read, Issues write and Metadata read, with pull_request/check_run/check_suite/issues/issue_comment events. A paginated PR inventory succeeded and returned no PRs. Demo issue 1 has an OPEN $50 sandbox bounty and no capture. The live competing-PR/retry walkthrough therefore still needs sandbox checkout and contributor participation; permission configuration itself is verified. No Check Run was fabricated as a substitute for that walkthrough.


The separately authorized v2 repeat **passed 18/18** with complete model/usage evidence; see [observations](05-auto-v2-20261030.json). Total evaluation requests in this continuation: 36, within two separately approved 18-request budgets. No extra evaluation request was made.

The user authorized proceeding with the $50 sandbox demo and named `Me-cha` (127575583). That account differs from bounty creator `deepakA18` (96007304), but currently has only read access; same-repository PR creation needs collaborator access or another approved setup. There are no existing PRs. Issue #1 was updated before funding to concrete form-field-name encoding criteria and regressions, replacing its historical Phase 1 test description. The user was sent the funding review URL; no checkout approval is assumed.

For the authorized walkthrough, a private development backup was saved to `.local/backups/gitpay-before-phase6-live-20261030.dump`, migrations through 0012 applied successfully, and a separate worker started. This supersedes the earlier Phase 6 note that migrations had only run in tests. Automatic award selection remains closed; no award or payout was created by this setup.

Prepared [owner/contributor walkthrough instructions](05-demo-walkthrough.md); these are pending actions, not completion evidence.


### Sandbox funding confirmed — October 30, 2026

After the owner completed the existing checkout, a fresh read of that PayPal sandbox order returned COMPLETED with one COMPLETED capture for 5,000 USD cents. The local database independently records bounty 1 as FUNDED, funded_at present, funding_hold=false and needs_attention=false; funding attempt 1 is COMPLETED. No replacement order or manual capture was submitted during verification. Me-cha's repository write access was previously verified. There are still no submission records, so live PR/check/retry acceptance remains pending.


### Webhook delivery repaired — October 30, 2026

Me-cha's `/bounty status` comment was not received because the demo App's webhook URL still targeted an obsolete Cloudflare tunnel, returning HTTP 502. The App webhook was updated to the configured stable ngrok `/webhooks/github` endpoint with JSON, TLS verification and the current local signing secret. Only the specific failed status-comment delivery was redelivered through GitHub's API. GitPay processed run_command job 22, funding reconciliation job 23 and projection job 24 successfully, each in one attempt. The [new bot reply](https://github.com/deepakA18/gitpay-demo-http/issues/1#issuecomment-6520723048) reports $50.00 USD · FUNDED. Credentials and raw webhook payloads were not retained.

The existing `bounty-open` badge represents an unfunded draft and is intentionally removed after capture. Missing that label does not mean the funded bounty disappeared; the authoritative status comment remains FUNDED. No label policy was changed in this repair.


### Open-bounty label semantics — October 30, 2026

At the user's request, `bounty-open` now describes open participation rather than unfunded status. The projection retains it for OPEN, CAPTURING, FUNDED and NEEDS_REVIEW and removes it after an award or cancellation. Existing App-owned label descriptions are updated to direct users to the bot comment for funding status. This supersedes the draft-only label explanation above; no payment or eligibility policy changed.


### First live funded PR review — October 30, 2026

Me-cha linked [PR #3](https://github.com/deepakA18/gitpay-demo-http/pull/3) through the issue command. Submission 1 records head `8209ca6e447504d3579f1fb4574e0174fa50ff07`. Job 32 completed on its first attempt. Verification 1 is DONE, Auto serving model `gpt-6-luna`, verdict PARTIAL, confidence 0.94. A real completed neutral GitPay solution review Check Run (124021720746) is present at that exact SHA alongside successful external test checks.

The review recognizes the serializer fix and regression tests, but its sole unmet requirement is the literal `Fixes #1` text required by the frozen issue description: manual linking did not add that text to PR metadata. This is a workflow-criteria ambiguity, not an absent submission or failed model call. The saved review was not overwritten or relabeled. The contributor should add the reference to the PR description; the funded terms remain immutable. New-revision/retry, second-contributor and live revocation acceptance are still open. No award or payout was created.


### PR metadata refresh regression — October 30, 2026

The contributor added `fixes #1` to PR #3's description at the same head SHA. GitHub delivered the edit, but the original sync path scheduled only changes in persisted revision/status fields; job 33 finished without a new review. Fixed syncPullRequest to include a title/body hash in the verification job identity and schedule evidence collection for metadata-only updates. Repeated identical metadata deduplicates at enqueue, and unchanged evidence is still deduplicated before inference. Manual links and monetary policy remain unchanged.

The new regression failed before the fix and passed afterward. Full verification: 44 files / 255 tests, typecheck, lint and build passed. PR #3's edit was queued through normal reconciliation after the fix; existing review history is retained.

The replay completed: verification 2 is DONE, Auto served `gpt-6-luna`, verdict RESOLVES with no unmet requirements. Check Run 124024067200 records the second review at the unchanged head SHA; verification 1's PARTIAL remains preserved. This establishes live metadata-update review, not a new-code-commit walkthrough, manual failed-attempt retry, second-contributor acceptance or payout. Automatic awards remain disabled.
