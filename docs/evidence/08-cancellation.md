# Phase 8 cancellation safety scenarios

Local automated evidence only, 2026-10-30. [Summary and commands](08-summary.md).

| Scenario | Local result |
| --- | --- |
| Maintainer requests cancellation, valid contributor PR merges | One award; request SUPERSEDED; no refund |
| Independent earlier fix, elapsed injected-clock notice, independent review | One saved refund identity; mocked COMPLETED → CANCELLED |
| Empty/unrelated claim | Requires concrete snapshot-bound dismissal; unknown/valid unresolved work blocks |
| New claim before reserve | Approval invalidated to REVIEW |
| New evidence after reserve, before POST | ABORTED_UNSENT; immediate pre-reservation state restored |
| Evidence changes after submission boundary | Principal remains reserved; no competing award |
| New claim during pending refund, then completion | CANCELLED reflects provider truth; investigation flag remains |
| Missing App/evidence access | No first refund submission |
| Lost response | Retry same saved identity within deadline; no new key afterward |
| Pending/failed provider result | No cancellation success claim and no released award funds |
| Closed/edited PR or objection | Prior observed evidence retained |
| Creator/requester/funder/claimant reviewer, stale token | Decision refused |
| Failed/lost notice publication; forged marker | Full notice starts only after authentic confirmation/recovery |

No live cancellation/refund was attempted. The real operator walkthrough and 72-hour notice remain deferred; see the [live checklist](../phases/live-walkthroughs.md).
