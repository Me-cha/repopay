# Phase 9 — local visibility and user journeys

Date: 2026-10-30. Worktree was clean when Phase 9 began; implementation remains uncommitted. Local implementation/verification complete; full phase acceptance remains pending the user-deferred live walkthroughs.

## Delivered

- Safe current-scope `/api/me`, paginated `/api/bounties` and `/api/payouts`, richer bounty detail with reasoning, decisions and paginated activity. Public actor IDs are allowed; payment destinations, credentials, raw activity metadata and provider keys are excluded.
- Same-origin `/dashboard/`: React/Vite, AG Grid Community, Bounties/Payouts/Needs attention tabs, page filter/sort, keyboard-accessible separate detail panel and mobile cards. All financial actions remain on existing authenticated server pages.
- One shared PostgreSQL LISTEN connection, migration 0015 transactional notifications, authorized SSE invalidations and independent periodic/focus/reconnect full refetch. Rechecks close revoked/expired streams; failed access clears private browser state. Sequence IDs are never treated as commit order.
- Server status pages show committed versus paid amounts, pending refund truth and next actor. Fixed doubled currency prefixes in review/cancellation displays and the stale draft-only signed-in instruction. Failed status polling hides private details.
- Separate Playwright harness with isolated schema, synthetic sessions/providers and loopback-only HTTP. No test-only login routes enter production source; no worker, live payment or model request is used.

Scope/ownership refinements and bounds: [ADR 0011](../decisions/0011-scoped-dashboard.md). Browser cases: [journeys](09-user-journeys.md).

## Verification

Commands using repository-local Node 22.23.4:

```sh
pnpm typecheck
pnpm lint
TEST_DATABASE_URL=postgresql://repopay:repopay@127.0.0.1:5433/repopay_test pnpm test
pnpm build
TEST_DATABASE_URL=postgresql://repopay:repopay@127.0.0.1:5433/repopay_test pnpm test:e2e
git diff --check
```

Server: **59 files / 310 tests passed**. Web DOM: **2 files / 4 tests passed**. Browser: **10 Chromium journeys passed**. Typecheck, lint, build, whitespace and local documentation-link checks passed. PostgreSQL tests exercise real scopes/transactions/listener connections while external authorization responses are simulated. Initial new read-list regression failed before implementation; the old six-field DTO assertion was updated to the expanded strict whitelist. Browser iterations caught a malformed expired-token fixture and a form navigation race; the form test now waits for the successful POST and the subsequent connection-page reload. Connection reuse and lower-ID late commit have explicit regressions.

Build reports a non-fatal >500 kB bundle warning (Community grid entry approximately 1.04 MB minified / 298 kB gzip). No Enterprise dependency is present. Browser artifacts are ignored under `test-results/`, not fabricated live evidence.

## Local runtime

Created ignored `.local/backups/repopay-before-phase9.dump`, applied additive migration 0015, built both packages and checked local `/healthz` ready. Migration only adds activity notifications; it does not alter funded terms or authorize financial operations. No activation scope was changed. Unauthenticated `/dashboard/` returns 303 to sign-in. The original bounty remains PAID with exactly one award and one payout item.

## Remaining acceptance and limitations

Live roles, actual permission revocation, real worker/provider status and prior phase walkthroughs remain in [the final checklist](../phases/live-walkthroughs.md). No new live-money/model capability is claimed. Fresh scope checks increase provider request volume; streams fail closed beyond 100 repository/installation pairs. List filtering/sorting is per candidate page. Activity is paginated, while review/decision histories remain full reads and need scale monitoring. Deployment and recovery work remain later phases.
