# Phase 12 — local handoff and acceptance preparation

2026-10-30. Base commit `82183e6`; Phase 12 changes are uncommitted. Starting worktree was clean. **Local preparation complete; full MVP acceptance incomplete.** The user deferred remaining live walkthroughs until all local phase work was finished. No new GitHub publication, model call, payment, deployment or submission occurred.

## Delivered

- [Acceptance matrix](12-acceptance.md): W01–W16 local tests, historical real observations, required gaps and R01–R11 review traceability. Required gates remain unchecked.
- [Demo guide](../demo.md): fresh ordinary issue preparation, <=3-minute recording outline and separate genuine-refund recording requirements.
- `pnpm demo:seed`: no-provider dry run; explicit execution restricted to the designated detached repository. Fresh issues each run, no bounty/merge/payment actions, no automatic retry after uncertain create. Four mocked CLI tests cover boundaries; real execution is deferred.
- [Postman collection](../../postman/repopay.postman_collection.json): read-only endpoints and default-skipped local synthetic signed ping. No exported secrets. Signature generated locally; no webhook secret imported into Postman. Guard test rejects opt-out and non-loopback/host-confusion destinations. Postman GUI import/send remains unobserved.
- README/setup/contribution/map updates and an ordered [final-session checklist](../phases/live-walkthroughs.md#final-session-order). No new application environment variables or database migrations.

## Fresh-clone rehearsal

Created `/private/tmp/repopay-phase12-clean-rm1iy895` using `git clone --local --no-hardlinks` from base commit, then copied only nonignored Phase 12 changes over it. This is a fresh local clone **plus the uncommitted patch**, not a claim that the remote repository already contains this work. No `.env`, `.local`, `node_modules`, generated build or credential artifacts were copied.

Used Node 22.23.4/pnpm 10.29.3 from the existing version-tooling installation through PATH. `CI=true pnpm install --frozen-lockfile` installed dependencies from the pnpm cache (327 packages), exercising install lifecycle scripts. This was not an empty-cache internet download. Docker PostgreSQL 16 and `repopay_test` already existed; `COMPOSE_PROJECT_NAME=repopay` selected that stack for restore tests from the temporary clone. Tests created/dropped their isolated schemas, not the application database. No new Docker volume or test database was necessary.

Commands executed from the clean clone:

```sh
export COMPOSE_PROJECT_NAME=repopay
export TEST_DATABASE_URL=postgresql://repopay:repopay@127.0.0.1:5433/repopay_test
CI=true pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm demo:seed
pnpm exec vitest run packages/server/test/unit/postman.test.ts
pnpm eval:verifier
pnpm eval:verifier --report docs/evidence/05-auto-v2-20261030.json
```

| Check | Observed result |
| --- | --- |
| Frozen install, typecheck, lint | Passed; final source typecheck/lint also rerun in working tree |
| Full `pnpm test` | 66 server files / **332 tests**, plus 2 web files / **4 tests**, passed |
| Postman guard added after full run | Copied to clean clone; **1 additional test passed** (333 server tests in total across runs) |
| Build | Web and server passed |
| Browser | **11 Chromium journeys passed** |
| Seeder | Dry run passed; unit suite first failed because entrypoint did not exist, then all 4 authorization/rerun/failure tests passed |
| Verifier default command | `fixtures_ready_live_evaluation_not_run`; not a live pass |
| Historical report validation | Current v2 prompt/SDK accepted stored Auto v2 report, 18/18 historical observations; zero new requests |

A first report-only invocation hit sandbox IPC `EPERM` in tsx; rerunning with local execution permission succeeded. Initial lint findings in new tooling tests were corrected before passing final typecheck/lint. After the full rehearsal, the CLI adapter was tightened to pin github.com and pass issue bodies via stdin/--body-file; focused tooling tests, typecheck/lint and clean-clone dry run were repeated for that final change.

Nonfatal existing warnings: dependency install skips `koffi@3.2.1` build scripts; this credential-free rehearsal does not validate hosted Copilot SDK runtime/native readiness. Vite reports the existing ~1.04 MB minified dashboard chunk (~298 KB gzip); no performance threshold or hosted load pass is claimed. Browser runner emits color-environment warnings.

## Documentation and export verification

Relative file links, referenced test paths, tracked/nonignored file secret-pattern scan and `git diff --check` were checked after writing the handoff documents. The scan is a bounded heuristic, not a guarantee or a git-history audit. It does not inspect ignored credentials or dump their values. Final check disposition: 314 tracked/nonignored files scanned; no private-key/GitHub-token pattern candidates and no missing relative file links. Whitespace check passed. Synthetic fixture values are not provider credentials.

## Remaining acceptance

The [matrix](12-acceptance.md) retains live/hosted/recording/user acceptance as open. A second eligible contributor and an independent operator are not available; real two-author allocation also needs supported revision-bound attribution, not merely another account. Organization sponsorship stays explicitly blocked. Real 72-hour notice cannot be compressed. Historical $50 payment remains untouched.

Provider-connected startup from a fresh checkout, actual seeder rerun, Postman GUI behavior, hosted infrastructure, final recording/privacy review and current official event rules remain unverified. No submission is planned by this change. Do not mark Phase 12 or the full MVP accepted on the strength of local test results.
