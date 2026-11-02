# Repopay read-only dashboard

React/Vite workspace rendering the protected 3-page Core 2.0 shell with compact Shadcn-style divided analytics cards and 60fps `<LivelineChart />` canvas telemetry at `/dashboard` (Analytics overview), `/dashboard/contributions` (Contribution management & truthful bounty inspection modal), and `/dashboard/payouts` + `/dashboard/payouts/settings` (Live settlement stream, disbursements ledger & masked PayPal destination connection via `/api/connect`). Unauthenticated visitors at `/` see the GitHub OAuth sign-in screen; private dashboard HTML and JSON require an authenticated session. `Detail.tsx` and `grid/Bounties.tsx` remain preserved for compatibility tests.

Run `pnpm build` at the repository root, start the server, and sign in on its origin. `pnpm dev:web` provides optional Vite development with `/api` proxying to local port 3000; use the server origin for OAuth and acceptance checks. Rebuild web assets after changes when using `pnpm dev`.

`pnpm --filter @repopay/web test` runs DOM tests. Root `pnpm test:e2e` runs Chromium journeys with isolated test data; see [setup](../../docs/setup.md). No Enterprise module/license, payment address, mutation API or browser financial decision is used. Server-rendered action links preserve their existing authorization and confirmations.

[Phase 9 evidence](../../docs/evidence/09-summary.md) · [scope and update contract](../../docs/decisions/0011-scoped-dashboard.md)
