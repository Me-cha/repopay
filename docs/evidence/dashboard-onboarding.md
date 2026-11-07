# First-visit dashboard tour

Approved design, November 7, 2026: a six-step React Joyride tour shown at most once per authenticated GitHub account. Record presentation before displaying it. Finish, Skip, Close, reload and another device never reset eligibility. Existing accounts become eligible on their next dashboard visit. No replay/reset UI. A lost claim response may suppress the tour; at-most-once presentation takes precedence over retrying it.

Implementation plan:
1. Add migration 0020 and isolated user_onboarding table. Authenticated GET returns eligibility and path-bound CSRF; POST atomically claims presentation using the session identity. Test concurrent claims, new sessions/accounts and rejected mutations.
2. Add DashboardTour, step definitions and useDashboardTour; mount in AppShell. Use existing router and stable page targets, including empty data/mobile. Never click action forms. Stop on navigation away, missing targets, access/error state or close.
3. Verify DOM lifecycle and browser completion/dismissal/reload/mobile. Run repository checks, distinguish baseline failures, update module maps and setup guidance.

Boundaries: only tutorial state changes; no funding, provider, repository or settlement operations. Database migration deployment remains required. No environment variables or external credentials are added.

## Verification — November 7, 2026

- API integration: 2 tests passed using disposable PostgreSQL schemas and mocked identity. Covers simultaneous claim requests, a fresh browser session for the same account, another account, authentication, Origin/CSRF and identity injection rejection. Initial tests reproduced missing-route 404s before implementation.
- Web DOM: all 8 tests passed, including 4 onboarding lifecycle cases (StrictMode, loading/already-seen, unavailable persistence and readiness recovery after dismissal).
- Onboarding Chromium: all 7 tests passed. Complete six-step journey; same-account fresh browser session; Skip/Close/Escape/reload; 320/375/768px positioning, Back and keyboard focus containment; persistence outage; empty workspace. Only onboarding POST occurs during the walkthrough; forms and financial actions are untouched.
- A rapid-click race was reproduced during navigation: Joyride could render controls before its presentation lifecycle was ready. `TourTooltip.tsx` now disables Next/Back until the current tooltip event. The formerly intermittent empty-workspace scenario passed five consecutive repeat runs. Final seven-scenario run also passed.
- Mobile screenshots inspected after transitions completed; tooltip stays within the viewport and the sticky header does not hide the highlighted page heading.
- Typecheck, build, changed-file ESLint and `git diff --check` passed. The Joyride package's client directive emits a nonfatal Vite bundling warning; this is a client-rendered application.
- Migration 0020 applied to the configured **local** database; `pnpm db:check` confirms exact migration compatibility. No hosted migration/deployment or provider requests performed.

## Existing regression-suite limits

Full server run: **399 passed, 4 failed**, with the same authentication/redirect failures recorded before this change. All new API tests passed. The full Chromium run retained the same 9 existing UI-selector/journey failures; 2 existing journeys and the then-current 5 onboarding scenarios passed. The final expanded onboarding-only suite passed all 7. Whole-repository lint still crashes on the pre-existing `capture_localhost.mjs` typed-rule configuration. These unrelated failures were not changed or hidden by the tour work.

## Release and ownership

Use the existing migration/build deployment sequence before serving the new release. No environment variables are added. AppShell mounts the tour, page components expose only stable targets, and `TourTooltip` owns presentation/readiness controls. `useDashboardTour` owns startup; the server remains authoritative for at-most-once eligibility. No replay route, reset flag, financial job or provider call was introduced. Unrelated `docs/third-party-issue-sponsorship-research.md` was left untouched.
