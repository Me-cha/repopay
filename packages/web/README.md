# Repopay read-only dashboard

React/Vite workspace rendering the protected 3-page Core 2.0 shell with compact Shadcn-style divided analytics cards and 60fps `<LivelineChart />` canvas telemetry at `/dashboard` (Analytics overview), `/dashboard/contributions` (Contribution management & truthful bounty inspection modal), and `/dashboard/payouts` + `/dashboard/payouts/settings` (Live settlement stream, disbursements ledger & masked PayPal destination connection via `/api/connect`). Unauthenticated visitors at `/` see the GitHub OAuth sign-in screen; private dashboard HTML and JSON require an authenticated session. `Detail.tsx` and `grid/Bounties.tsx` remain preserved for compatibility tests.

Run `pnpm build` at the repository root, start the server, and sign in on its origin. `pnpm dev:web` provides optional Vite development with `/api` proxying to local port 3000; use the server origin for OAuth and acceptance checks. Rebuild web assets after changes when using `pnpm dev`.

`pnpm --filter @repopay/web test` runs DOM tests. Root `pnpm test:e2e` runs Chromium journeys with isolated test data; see [setup](../../docs/setup.md). No Enterprise module/license, payment address, mutation API or browser financial decision is used. Server-rendered action links preserve their existing authorization and confirmations.

[Phase 9 evidence](../../docs/evidence/09-summary.md) · [scope and update contract](../../docs/decisions/0011-scoped-dashboard.md)

First-visit tour: `components/onboarding/` defines the six controlled React Joyride 3.2.0 steps and an accessible tooltip that enables navigation only after positioning completes; `hooks/useDashboardTour.ts` obtains the account-level presentation claim. AppShell mounts it after workspace data loads. Skip/Close/Done/reload never reset eligibility. Missing persistence or targets suppresses the tour without blocking the dashboard. `test/onboarding.spec.ts` covers actual browser navigation, dismissal, mobile and another session.

`pages/WalletPage.tsx` provides `/dashboard/wallet` for saved Solana devnet wallets and optional `?funding=<id>` funding. Only explicit user actions connect/sign; a returning user sees their saved destination. It uses injected Phantom/Solflare providers and the authenticated `/api/pyusd` transport. This is a financial/connection surface, not a new browser-only PR workflow. PYUSD is shown separately from USD; USD aggregate charts exclude it. See [crypto setup](../../docs/crypto-payments.md).

PYUSD devnet wallet signing uses the pinned Wallet Standard app/features packages. Use a current Phantom or Solflare extension exposing `solana:devnet`; no mainnet or network-unspecified transaction-signing fallback is offered. Expired preparations stop before the wallet prompt and retain their original transfer for reconciliation.
