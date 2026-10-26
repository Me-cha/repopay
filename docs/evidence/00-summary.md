# Phase 00 — local foundation evidence

**Status: Phase 00 COMPLETE — October 27, 2026.** Local checks, scoped live provider gates and final review passed. See the closeout section below and [provider evidence](00-preflight.md). Phase 01 has not started.

**Historical starting point (October 26):** branch `feat/phase-00-foundation`, base `1b2998b39f7739c1b2e57227a9d6387d5947827a`; the worktree was clean before initial implementation. At that initial checkpoint the external gate was blocked and changes were uncommitted. The foundation now exists in commit `eb05795`; the current closeout changes remain uncommitted. This closeout did not commit, push or deploy.

## Delivered

- Exact pnpm/dependency pins, Node 22 requirement, strict TypeScript, ESLint, Vitest and a lockfile.
- Explicit Zod configuration, bounded inputs, separate encryption keys, sandbox enforcement and redacted Pino logs.
- Stable string IDs and validated SQL-integer cents; shared action/transaction contracts.
- PostgreSQL 16 Compose service; Drizzle deliveries/jobs schema, lease constraints, versioned migrations and transaction wrapper on one pool.
- Express health endpoint with safe ready/unavailable responses and pool shutdown.
- Independent test schemas, destructive-target validation, denied unmatched provider HTTP calls and a CI workflow with no provider secrets.
- Read-only default preflight, optional NVIDIA schema probes and explicit persistent-identity 100-cent sandbox payout probe.

No product bounty tables, worker runner, authentication flow, funding, settlement, dashboard or deployment is claimed.

## Verification record

Commands below used Node 22.23.4. The machine's global Node was 24; a repo-local ignored `.local/tooling/` Node installation was used by prepending `.local/tooling/node_modules/node/bin` to PATH. It is not a required tracked dependency; clean setups should use `.node-version` with their own version manager.

| Command/scenario | Observed result |
| --- | --- |
| `pnpm install --frozen-lockfile` repeated | Passed; lockfile SHA-1 unchanged: `1ba4143a1d78854ab5e4316bbee4a439485d1369` |
| Clean source copy without node_modules/.env: frozen install, typecheck, lint, test, build | All passed; 43 tests across 7 files |
| Empty test selection / missing TEST_DATABASE_URL | Both exit 1; no silent success or skipped DB suite |
| Tool versions | pnpm 10.29.3, TypeScript 5.9.3, Vitest 5.0.5, ESLint 10.13.0 |
| Temporary invalid TypeScript assignment | Typecheck failed with TS2322; fixture removed |
| Temporary explicit `any` | Lint failed with `no-explicit-any`; fixture removed |
| `docker compose up -d` | PostgreSQL 16.13 running, localhost port 5433 |
| `pnpm db:migrate` twice | Both passed on the local primary database |
| `pnpm test` with explicit local TEST_DATABASE_URL | 43 tests passed across 7 files; real PostgreSQL integration tests, mocked external providers |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | Passed |
| `pnpm dev`, HTTP health | 200 with `{status:"ready",version:"0.0.0"}` |
| Stop real Compose Postgres, then restart | HTTP 503 unavailable; restored to HTTP 200 after restart |
| `pnpm start` compiled artifact | HTTP 200 ready |
| Direct compiled process SIGTERM smoke | Health 200, then clean exit code 0 within 5 seconds |
| Relative file links, new/tracked source whitespace, `git diff --check` | Passed |
| Shutdown tests | Open pool closes, repeat close safe, subsequent DB query rejected |
| `pnpm preflight` with blank local credentials | Expected exit 1 with missing field names only; no provider request |

The first clean-source test run failed with connection refused after the Docker daemon stopped. Restarting Docker/Compose and rerunning the entire clean-source install/typecheck/lint/test/build sequence passed.

Behavior tests were run failing before implementation: configuration/logging, cents/IDs, absent migration tables, health/shutdown and provider probes. A fresh reviewer found two important logging gaps (child/setBindings and API-key names). Both were reproduced with failing regression tests and fixed; all 43 tests passed afterward. No minor findings were deferred.

The first smoke invocation exposed incorrect `tsx watch` flag ordering; the public dev script was corrected and re-run. A smoke harness used a Compose `start --wait` option unsupported by the installed CLI; the harness was corrected to start and observe readiness. Development watcher/process-group termination emitted wrapper messages; the application shutdown contract is covered by the integration tests. No wrapper warning is counted as a graceful-process-exit proof; a separate direct compiled-process smoke subsequently verified SIGTERM exit 0.

## Test scope

Unit cases cover invalid/live configuration, empty operator allowlist when enabled, key separation, limits, string IDs, invalid cents, nested secret redaction, child logger bindings and API-key values. Integration cases use actual PostgreSQL to prove migration reruns, rollback, persisted normalized payloads, lease-state constraints, isolated schemas, health and pool closure.

Provider tests intercept HTTP with Nock. They cover no payment/model generation by default, disk identity before first payout request, identical repeat bodies, recovery lookup, preserved identity after unknown outcomes, recipient mismatch, exclusive lock, expired deduplication window, live-base refusal, hostile recovery URLs and validated NVIDIA JSON-schema output. These do not establish provider account capability.

## Remaining gates and review boundaries

At initial setup, the owner confirmed accounts and credentials existed but were unavailable locally. They subsequently configured the NVIDIA key and supplied the GitHub App private key; GitHub App authentication passed on October 27, 2026. PayPal sandbox authentication and the $1 payout/duplicate/recovery checks now pass; the recipient-side $1 receipt is also independently confirmed in sandbox Activity. [Provider evidence](00-preflight.md) records every unavailable external check. The local `.env` is ignored and now contains the owner-provided NVIDIA credential; complete the remaining setup using [setup](../setup.md).

GitHub App authentication is now verified. DeepSeek inference was never verified and was removed from scope by the user on October 27. The recipient-side $1 sandbox receipt is independently confirmed. PayPal Payouts access, immediate duplicate rejection and saved-batch recovery are now verified. NVIDIA credentials are now available locally and Nemotron passed a live structured-output probe; see the provider evidence record. The combined Phase 00 gate subsequently passed as recorded below; Phase 01 remains not started and unauthorized. Hosted GitHub Actions has not run; local checks exercise its commands. No browser validation is needed for this JSON-only health scaffold; no UI is claimed.

Reviewer boundaries: provider capabilities require real credentials; final docs and smoke checks are verified by the implementer; financial workflows, authorization enforcement and worker behavior belong to later phases. Their absence is not evidence that the full product is ready.

Dependency installation reports two deprecated transitive packages under drizzle-kit (`@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader`). These did not prevent install/checks; no claim of a comprehensive dependency security audit is made.

## NVIDIA provider migration — October 26, 2026

At this historical checkpoint, the user's instruction and [ADR 0002](../decisions/0002-nvidia-runtime-models.md) replaced Anthropic with NVIDIA, using DeepSeek primary and Nemotron fallback. That selection is superseded by ADR 0003 below. Added independent model-only probes and separate inference timeout/output limits. Existing local secret values were preserved; only missing non-secret NVIDIA settings were added. No key was printed or tracked.

After this change, `pnpm test` passed **67 tests across 8 files**, and `pnpm typecheck`, `pnpm lint`, `pnpm build` passed. Earlier 43-test/fresh-source entries above describe the initial foundation before this migration. Added cases cover transient fallback, non-retryable HTTP errors, negative verdict preservation, malformed/truncated/schema-invalid/model-mismatched output, response limits, transport timeout and independent capability results. The timeout case simulates only the fetch transport: Nock's delayed-response abort caused a native Undici assertion with the installed versions; real timeout signaling, fallback request and validation still run.

`pnpm preflight --model-only` passed with both exact model IDs listed. `pnpm preflight --model-only --model-probe` exited 1: Nemotron validated, DeepSeek timed out. No GitHub or PayPal calls were made in these model-only checks. Live results are recorded separately in [00-preflight.md](00-preflight.md).

Independent review found that interrupted error bodies could misclassify known authentication/quota errors as retryable. Four regression cases (401/402/403/422) failed before the fix and pass afterward; observed HTTP status is now preserved. Final suite: 67/67; typecheck, lint and build passed. No remaining material review findings.

## Phase 0 closeout — October 27, 2026

The user instructed us to drop DeepSeek and complete Phase 0. [ADR 0003](../decisions/0003-nemotron-only-and-preflight-scope.md) records Nemotron-only inference with a single bounded attempt and provider-scoped preflight configuration. Full application webhook/OAuth requirements remain strict; no placeholder webhook ID is used. Historical test counts above describe earlier checkpoints.

The new model-selection and preflight-boundary tests failed before implementation, then passed. Final local checks: **82 tests across 8 files**, typecheck, lint and build all pass. Both default `pnpm preflight` and `pnpm preflight --model-probe --sandbox-payment` exit 0 with real owner-configured credentials. The combined run validates Nemotron and recovers the same successful payout, without creating another payment. Recipient receipt is independently confirmed in Brave; the sandbox balance-display discrepancy remains documented. See [provider evidence](00-preflight.md) for IDs and exact observed limits.

A fresh read-only whole-branch/worktree review found no material code defects. Its important documentation finding identified conflicting current status statements in this summary, the phase index footer and CONTRIBUTING; all were reconciled and local links/whitespace checked. No unresolved critical, important or minor findings remain. No commit, push, deployment or Phase 01 implementation was performed as part of this closeout.

Review boundaries were retained deliberately: award ordering/pagination/late merges (05/06/10), cancellation/refunds (08/10), product recipient reservation (04/06), webhook/worker execution (01/10), and CI/authorship/verifier-quality policy (05/06/07) are future-phase work, not delivered product guarantees. Current probe account/recipient binding and bounded model output were reviewed. The reviewer did not operate live accounts; the implementer's recorded live API and browser receipt evidence supplies that proof. The full 30-day retention duration and wallet balance discrepancy remain empirical limitations. These boundaries prevent a Phase 0 completion claim from being mistaken for production payment readiness.
