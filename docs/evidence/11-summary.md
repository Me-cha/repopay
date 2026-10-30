# Phase 11 — local deployment preparation

Date: 2026-10-30. Worktree was clean at phase start. Changes remain uncommitted. **Local preparation is complete; Phase 11 hosted acceptance is not complete.** Hosting and live walkthroughs remain deferred by user direction.

## Prepared and verified locally

- Render Blueprint with separate web/worker services, private PostgreSQL 16, pinned Node/pnpm, frozen installs and built artifacts. Auto deploys/previews are off. Paid plan choices require an actual account quote and approval before provisioning.
- Shared environment values without committed secrets; default hosted recovery hold, sandbox-only PayPal, Copilot Auto, discovery/cancellation disabled and blank settlement scope.
- One web pre-deploy migration process. `db/compatibility.ts` checks ordered timestamps and SQL hashes; both entrypoints fail before serving/processing against an incompatible schema. Web health repeats the check. Failed startup closes the pool.
- `RECOVERY_MODE=hold` prevents all worker processing and HTTP mutations before restore. Inline mode now wires the same scheduler as separate mode when explicitly enabled. Shutdown closes long-lived HTTP connections after stopping inline work.
- Operator runbooks for held rollout, compatible rollback, independent key backup and provider reconciliation when an operation is entirely absent from restored SQL.
- Actual PostgreSQL dump/restore rehearsal in a generated test schema with synthetic credentials. A fake provider accepts a payout after backup; restoration removes its local intent; hold prevents another worker submission. Original award and schema history survive the restore. No personal credentials/provider accounts are involved.

[ADR 0013](../decisions/0013-deployment-and-restore-hold.md) records boundaries. [Deployment instructions](../deployment.md) include source links and pending pricing/account verification. [Hosted checklist](11-hosted.md) contains no fabricated deployment IDs or results.

## Validation

Commands using repository-local Node 22.23.4:

```sh
pnpm typecheck
pnpm lint
TEST_DATABASE_URL=postgresql://gitpay:gitpay@127.0.0.1:5433/gitpay_test pnpm test
pnpm build
TEST_DATABASE_URL=postgresql://gitpay:gitpay@127.0.0.1:5433/gitpay_test pnpm test:e2e
pnpm db:check
git diff --check
```

**Results:** 65 server test files / 328 tests, 2 frontend files / 4 tests, and 11 Chromium journeys passed. Typecheck, lint and build passed.

Initial compatibility regression failed because the compatibility module did not exist. Focused tests then passed missing/mismatched schemas, production sandbox/HTTPS checks, missing secrets, legacy job parsing, hold behavior and restore omissions. The existing health tests now migrate before expecting readiness. Restore uses Docker's PostgreSQL 16 tools with a validated local test DB and generated schema; provider calls are fake.

The prepared Blueprint passed local validation against `https://render.com/schema/render.yaml.json` using a temporary JSON-schema validator. Synthetic manually supplied values plus the Blueprint defaults passed strict production configuration parsing. This is not an authenticated Render API validation, deployment, price quote or proof of hosted SDK availability.

No new database migration was needed. The current local database passed the compatibility CLI; health remains ready. No hosting resource, payment, model evaluation, callback/webhook change or activation was performed. The unchanged Community bundle warning remains non-fatal.

## Deferred evidence

Paid account/plan approval, actual hosted URL/IDs, hosted Copilot runtime, read-only provider preflight, role workflows, delayed claim, independent refund after real notice, restarts/access loss and hosted restore/PITR remain on [the final live checklist](../phases/live-walkthroughs.md). Local results cannot satisfy those gates. Exact migration history is a release compatibility check, not full schema-drift detection or automatic provider recovery. Hold must be set on every restored service before connecting it; standalone human provider probes remain outside that guard.
