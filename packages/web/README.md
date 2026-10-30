# GitPay read-only dashboard

React/Vite and AG Grid **Community** render Bounties, Payouts and Needs attention at `/dashboard/`. A separate React detail panel shows verifier reasoning, decision history, committed/delivered amounts and activity. Mobile widths use cards. Filtering/sorting is per page; history has a separate older-activity cursor.

Run `pnpm build` at the repository root, start the server, and sign in on its origin. `pnpm dev:web` provides optional Vite development with `/api` proxying to local port 3000; use the server origin for OAuth and acceptance checks. Rebuild web assets after changes when using `pnpm dev`.

`pnpm --filter @gitpay/web test` runs DOM tests. Root `pnpm test:e2e` runs Chromium journeys with isolated test data; see [setup](../../docs/setup.md). No Enterprise module/license, payment address, mutation API or browser financial decision is used. Server-rendered action links preserve their existing authorization and confirmations.

[Phase 9 evidence](../../docs/evidence/09-summary.md) · [scope and update contract](../../docs/decisions/0011-scoped-dashboard.md)
