# Phase 10 — local recovery and hardening

2026-10-30. Worktree was clean at phase start. Changes are uncommitted. Local implementation and verification are complete; live acceptance and fresh model evaluation remain deferred by user direction.

## Implemented

- Migration 0016 stores rotating scheduling and per-bounty PR-page checkpoints. Cursor advancement and durable downstream jobs commit together under row locks/leases. Discovery includes every bounty lifecycle and never asserts no claim from an incomplete scan.
- Existing capture, payout, claim and refund due-time services remain authoritative. One failing tick no longer starves other subsystems. Completed payout reads continue to detect later returns.
- Explicit safe retry CLI preserves failed jobs/reasons and dedupes a child with the original payload. No command, model-budget bypass or replacement financial operation is allowed. Operational guidance covers identities, secret rotation, removed Apps, unknown outcomes and backup/restore precautions.
- Status commands still reply individually; redundant funding/projection refresh work is interval-deduped.
- Worker subprocess kill/restart, checkpoint rollback, provider barriers, stale leases, concurrent principal allocation, App removal and security/browser tests added. CI runs the isolated browser suite without privileged fork secrets.

[ADR 0012](../decisions/0012-recovery-checkpoints.md) records ownership and limits. [Fault evidence](10-recovery.md) and [release/workflow map](10-release-checklist.md) distinguish tests from live acceptance.

## Commands and results

Repository-local Node 22.23.4:

```sh
pnpm typecheck
pnpm lint
TEST_DATABASE_URL=postgresql://repopay:repopay@127.0.0.1:5433/repopay_test pnpm test
pnpm build
TEST_DATABASE_URL=postgresql://repopay:repopay@127.0.0.1:5433/repopay_test pnpm test:e2e
git diff --check
```

Full server suite: **64 files / 323 tests passed**. Web DOM suite: **2 files / 4 tests passed**. Browser suite: **11 Chromium journeys passed**. Typecheck, lint, build, whitespace and local documentation-link checks passed. Initial scheduler regression failed because the module was absent. Full-suite iteration exposed an old assumption that every status comment must create a projection job; the updated test retains two replies and explicitly checks one coalesced projection. Browser interception initially raced aborted refresh requests; the security case now uses malicious stored fixture content through the actual API.

No `pnpm eval:verifier` request was issued: fresh paid-provider evaluations are deferred. Prior Auto v2 evaluation remains recorded in Phase 5. The unchanged Community bundle has a non-fatal >500 kB build warning.

## Local runtime

Backed up to ignored `.local/backups/repopay-before-phase10.dump`, applied migration 0016 and confirmed `/healthz` ready. Discovery activation defaults false, so migration does not start live scans/reviews. No new checkout, payout, refund or model request was initiated by this phase. Existing scoped demo guards remain unchanged. Read-only runtime checks confirmed discovery and funded cancellation disabled; bounty 1 remains PAID with one award and one payout item.

## Remaining limits

All live recovery and earlier phase walkthroughs remain on the [final checklist](../phases/live-walkthroughs.md). General discovery requires explicit activation and may enqueue sponsored reviews. Work-unit limits are not aggregate HTTP or monetary budgets. A capped candidate inventory still blocks selection. Never-received user commands are not reconstructed as authorizations. Unknown provider outcomes beyond dedupe expiry stay held for investigation. The process harness is not a hosted restore/PITR rehearsal. No deployment/commit/push was performed.
