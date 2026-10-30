# Phase 10 — security and workflow coverage

2026-10-30. Local release checks only; MVP/provider acceptance remains open.

## Security boundaries

- Signed GitHub intake, receipt/job atomicity and replay: `integration/github-webhooks.test.ts`; PayPal signature/provider verification: `integration/paypal-webhooks.test.ts`.
- Payload/response limits and safe transports: HTTP/preflight and provider unit tests; URL allowlists remain enforced before fetching. `unit/cancellation.test.ts` rejects arbitrary and cross-repository evidence URLs.
- Session/CSRF/Origin/token expiry: `integration/oauth.test.ts`, `integration/confirm.test.ts`, `integration/cancellation-http.test.ts`, `integration/review-approve.test.ts`. Current permissions are rechecked rather than trusting operator status.
- HTML escaping: confirmation tests and `packages/web/test/security.spec.ts` render hostile stored issue markup through the real local read API without creating executable DOM.
- Private scope and revoked stream clearing: `integration/read-scope.test.ts`, `integration/sse.test.ts`, browser journeys.
- SQL uses query parameters or Drizzle values; schema identifiers are restricted by `createDatabase`. No new arbitrary query or financial mutation HTTP endpoint.
- Logs: `unit/log.test.ts` plus `integration/security.test.ts` cover nested/child secrets, bearer tokens, raw recipient email and action URLs; read DTOs exclude raw activity metadata.
- Prompt injection remains serialized untrusted evidence; `unit/verifier.test.ts` and schema/policy tests prohibit model authority over financial decisions. A new live model evaluation was **not run**, per deferred live testing. Prior Auto v2 18/18 evidence is historical, not a fresh Phase 10 evaluation.
- New discovery and financial/projection polling use configured work/rate bounds. This is not a distributed global HTTP abuse budget. Deployment-level ingress protection and hosted load testing remain Phase 11 concerns.
- CI uses `pull_request`, read-only contents permissions, synthetic test credentials and no privileged fork secrets. It now installs Chromium and runs the browser suite; no live evaluator/payment or publish step is added. Hosted CI execution itself is not claimed here.

## W01–W16 map

Paths below are relative to `packages/server/test/integration/` unless specified.

| Workflow | Local evidence | Remaining real acceptance |
| --- | --- | --- |
| W01 App/draft | github-webhooks, drafts, permissions | Phase 1 recorded demo; hosted replay deferred |
| W02 funding | funding-intent, capture, funding-recovery, paypal-webhooks | Phase 3 receipt/recovery checklist |
| W03 draft cancellation | confirm, funding-intent | Prior phase live gaps remain tracked |
| W04 competing submissions | linking, candidate-scan, award-selection | Second contributor unavailable |
| W05 review/retry/revision | verification-checks, verification-retry, sponsor, verifier evaluation tests | Funded competition/retry and org sponsorship blockers |
| W06 qualifying award/payment | award-selection, payout, concurrency | First $50 payout/receipt recorded; further live recovery deferred |
| W07 exact split | policy unit tests, payout two-author case | Two-author sandbox receipt |
| W08 delayed claim | connect, claim-readiness, payout | Delayed live connection/resumption |
| W09 approve/reject | review-approve; server browser journeys | Partial-approval/rejection live examples |
| W10 exceptional refund | cancellation-request/review/http, refund-authorization/submit | Independent operator, full real 72-hour notice, sandbox refund receipt |
| W11 protect submitted work | cancel-then-merge, cancellation-evidence/matrix | Live abuse walkthrough |
| W12 objections | cancellation-evidence/review | Real non-writer objection and operator disposition |
| W13 financial recovery | capture, payout, refund-submit, concurrency, crash-recovery | Live ambiguous outcome and hosted restore |
| W14 webhook/access gaps | reconciliation, operations, crash-recovery, permissions | Actual missed events/App removal/hosted recovery |
| W15 scoped visibility | read-scope, sse, web DOM/browser/security suites | Real-role dashboard walkthrough |
| W16 reproducible hosted MVP | migrations, configuration, build/CI/local browser harness | Phases 11–12 deployment and final acceptance |

These entries map tests, not automatic completion of the real workflows. The authoritative deferred list is [live walkthroughs](../phases/live-walkthroughs.md).
