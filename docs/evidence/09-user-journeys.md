# Phase 9 — local browser journeys

Date: 2026-10-30. Chromium via Playwright, isolated PostgreSQL schema, seeded lifecycle states, synthetic OAuth/GitHub/PayPal boundaries. **10/10 journeys passed**. These are local tests, not live provider acceptance.

| Journey | Assertion |
| --- | --- |
| Maintainer funding → status | Existing pending capture stays unconfirmed; expired token offers recovery without mutation |
| Contributor connect → claim | Successful save and reload precede navigation; committed award and delivered amount remain distinct |
| Operator review → refund status | Review link readable, pending refund not completed, completed funded refund not described as draft cancellation |
| Server status access loss | Poll failure hides repository details |
| Community grid | No Enterprise/license/CSP errors; page filter, separate detail, focus/Escape and arrow-key tabs |
| Dashboard permission loss/reconnect | Rows/private detail cleared; fresh authorized login restores data |
| 375 / 768 / 1280 widths | Readable cards/grid, no page horizontal overflow; responsive screenshots inspected |
| Partial assessment / failed payout | Reason and unmet requirement visible; $50 commitment with $0 delivered remains an award, not cancellation |

Provider calls are mocked; operator browser journey reads the review and status screens rather than issuing a real refund. Existing Phase 7–8 integration suites exercise confirmation, CSRF, stale/replayed approval and money invariants. Server stream tests additionally cover private events, session/repository revocation, separate-connection notifications, a lower activity ID committing late and seven simultaneous browser streams sharing the listener.

Run with the command in [setup](../setup.md#phase-9-dashboard-and-local-browser-verification). Screenshots and failure traces use ignored `test-results/`. Live GitHub-to-page-to-provider journeys remain on [the final checklist](../phases/live-walkthroughs.md).

October 31 rerun after review/context corrections: `pnpm build` passed and `TEST_DATABASE_URL=… pnpm test:e2e` passed **11/11 Chromium tests**, including hostile-markup coverage. Disposable PostgreSQL and mocked provider boundaries; actual-role/hosted acceptance remains separately open.
