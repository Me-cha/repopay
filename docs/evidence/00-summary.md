# Phase 00 — local foundation evidence

**Status: local foundation verified; external feasibility blocked. Phase 00 is not complete.** October 26, 2026. Worktree branch: `feat/phase-00-foundation`; base commit: `1b2998b39f7739c1b2e57227a9d6387d5947827a`. The worktree was clean before implementation. Changes remain uncommitted; nothing was pushed or deployed.

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

At initial setup, the owner confirmed accounts and credentials existed but were unavailable locally. They subsequently configured the NVIDIA key; GitHub/PayPal setup remains pending. [Provider evidence](00-preflight.md) records every unavailable external check. The local `.env` is ignored and now contains the owner-provided NVIDIA credential; complete the remaining setup using [setup](../setup.md).

Actual GitHub App authentication, DeepSeek inference capability, PayPal Payouts access, duplicate behavior and a recipient receipt remain unverified. NVIDIA credentials are now available locally and Nemotron passed a live structured-output probe; see the provider evidence record. Phase 01 remains blocked by the combined Phase 00 gate. Hosted GitHub Actions has not run; local checks exercise its commands. No browser validation is needed for this JSON-only health scaffold; no UI is claimed.

Reviewer boundaries: provider capabilities require real credentials; final docs and smoke checks are verified by the implementer; financial workflows, authorization enforcement and worker behavior belong to later phases. Their absence is not evidence that the full product is ready.

Dependency installation reports two deprecated transitive packages under drizzle-kit (`@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader`). These did not prevent install/checks; no claim of a comprehensive dependency security audit is made.

## NVIDIA provider migration — October 26, 2026

Per the user's instruction and [ADR 0002](../decisions/0002-nvidia-runtime-models.md), current code requires NVIDIA instead of Anthropic. DeepSeek is primary; Nemotron is the bounded fallback. Added independent model-only probes and separate inference timeout/output limits. Existing local secret values were preserved; only missing non-secret NVIDIA settings were added. No key was printed or tracked.

After this change, `pnpm test` passed **67 tests across 8 files**, and `pnpm typecheck`, `pnpm lint`, `pnpm build` passed. Earlier 43-test/fresh-source entries above describe the initial foundation before this migration. Added cases cover transient fallback, non-retryable HTTP errors, negative verdict preservation, malformed/truncated/schema-invalid/model-mismatched output, response limits, transport timeout and independent capability results. The timeout case simulates only the fetch transport: Nock's delayed-response abort caused a native Undici assertion with the installed versions; real timeout signaling, fallback request and validation still run.

`pnpm preflight --model-only` passed with both exact model IDs listed. `pnpm preflight --model-only --model-probe` exited 1: Nemotron validated, DeepSeek timed out. No GitHub or PayPal calls were made in these model-only checks. Live results are recorded separately in [00-preflight.md](00-preflight.md).

Independent review found that interrupted error bodies could misclassify known authentication/quota errors as retryable. Four regression cases (401/402/403/422) failed before the fix and pass afterward; observed HTTP status is now preserved. Final suite: 67/67; typecheck, lint and build passed. No remaining material review findings.
