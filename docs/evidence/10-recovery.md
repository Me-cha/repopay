# Phase 10 — recovery fault evidence

2026-10-30. All tests here use isolated local PostgreSQL schemas and synthetic provider responses. No live payment/model request was made.

| Boundary / schedule | Executable evidence |
| --- | --- |
| Concurrent scheduler, durable scheduling cursor | `integration/reconciliation.test.ts` locks the checkpoint and asserts one durable discovery job |
| Crash before work persistence | Same suite injects a PostgreSQL job-insert exception; both cursor and work roll back; fresh scheduler resumes |
| Capped page / rate-limit uncertainty | Same suite saves page 2 only after downstream work commits; a provider failure keeps page 2 pending |
| Missed merge | Discovery enqueues revision sync from the closed/merged PR inventory; existing `candidate-scan.test.ts` and `award-selection.test.ts` retain complete-inventory selection guards |
| Actual worker restart | `integration/crash-recovery.test.ts` spawns the real `startWorker` loop in a child, kills it during leased provider work, expires the saved lease with a test-only SQL clock adjustment, starts another process and verifies the same job finishes on attempt 2 |
| Stale worker after external read | `integration/concurrency.test.ts` blocks provider completion behind a barrier, changes the lease from another connection, then confirms no downstream jobs/cursor commit |
| Award versus refund | Same suite races separate PostgreSQL reservations and asserts committed award + active refund principal = $50, one allocation, no provider POST |
| Two merges / approve versus auto award | `award-selection.test.ts`, `review-approve.test.ts`: stable ordering, shared guards and one immutable award |
| Before/after reservation, unknown POST, expiry, slow provider result | `payout.test.ts`, `refund-submit.test.ts`, `refund-authorization.test.ts`: saved identity, observation fence, no replacement after safe retry expiry |
| App removal and secret rotation | Additional payout/refund tests confirm known reads continue; same-account secret rotation preserves identity; no second POST or new refund authorization |
| Missed capture / capture funding incident | `funding-recovery.test.ts`, `capture.test.ts`: durable due-time polling, held disbursement and preserved saved identity |
| Previously PAID returned item | `payout.test.ts`: read reconciliation reopens delivery attention without changing entitlement |
| Same-minute contributor wakeups | `connect.test.ts`, `claim-readiness.test.ts`, `payout.test.ts`: connection-version jobs and immutable award/intent identity; no minute-based wakeup key |
| Delayed/lost notice publication | `cancellation-request.test.ts`: full notice begins only on confirmed App publication; fake markers do not consume notice |
| One subsystem unavailable | `operations.test.ts`: failing discovery scheduler does not starve other polling; safe retry retains original failed record/reason |
| Command storm | `bounty-projection.test.ts`: each participant gets a reply; interval-scoped projection work dedupes |

The process test simulates lease expiry; it does not wait a production lease duration or contact GitHub. Existing provider barrier/transaction tests exercise local money guards, not cross-service atomicity. General discovery activation remains off. Live missed-event/restart/provider scenarios and hosted backup restore remain in the final checklist.
