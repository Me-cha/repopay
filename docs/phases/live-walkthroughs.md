# Final live walkthrough checklist

Updated October 30, 2026.

## Execution decision

The user directed finishing local implementation and verification first, then running the remaining live walkthroughs together after all phases are implemented. The proposed Phase 7 $1 sandbox setup is deferred; do not create it or initiate additional live model/payment exercises now. Existing committed payment reconciliation remains intact.

This is a scheduling deferral, not a waiver or a passing result. Keep each phase's local verification separate from its live acceptance. Add newly discovered cases here as later phases are implemented. Numbered phase files remain authoritative for the full acceptance requirements, including unresolved local checks. Do not reinterpret every unchecked item as live-only.

## Phase 5 — PR review

Already evidenced: Auto v2 evaluation 18/18, real exact-revision Check Runs, new-code review, owner authorization revocation/session invalidation, blocked review while revoked, and successful review on a new revision after reconnection. See [Phase 5 evidence](../evidence/05-summary.md).

- [ ] Two distinct eligible contributors submit competing PRs on one funded issue; both are linked and reviewed. **Blocked:** a second eligible contributor account is unavailable; the creator cannot earn their bounty.
- [ ] A failed review recovers through the authenticated retry flow on the **same revision**, with preserved failure history. Prepare sufficient bounded request allowance before starting; do not reset counters or history.
- [ ] Live sponsor expiry/refresh and remaining App-access-loss/recovery cases. Real owner revocation has already passed and need not be repeated unnecessarily.
- [ ] Audit the remaining [Phase 5](05.md) acceptance items against their exact tests/evidence, including CI updates without a push and duplicate events. Retain local gaps as implementation work.
- [ ] Organization sponsorship remains explicitly blocked pending an eligible organization and an implemented/verified flow; scheduling it later does not supply either prerequisite.

## Phase 6 — awards and payouts

Already evidenced: merged PR #3 → one $50 award → one sandbox batch/item → PayPal SUCCESS → GitPay PAID → user-confirmed recipient receipt. Do not repeat or alter that completed payment. See [Phase 6 evidence](../evidence/06-summary.md).

- [ ] Delayed claim: a qualifying merged solution earns an award while its recipient has no saved connection; verify AWAITING_CLAIM, connect, and observe resumption of the same award through receipt with one payout. Feasible with reversed roles on a separate bounty: Me-cha creates it, deepakA18 contributes and connects only after award.
- [ ] Two-author allocation: verify exact cents and both recipient outcomes, including waiting for missing connections. **Blockers:** third account needed to leave two eligible authors after creator exclusion, plus verified revision-bound co-contributor attribution. Current automatic evidence accepts only the PR author; prepared-award mocked payout tests do not prove live attribution.
- [ ] Reconcile broader [Phase 6](06.md) merge/squash/rebase, replay and provider-recovery expectations with recorded coverage; distinguish simulated faults from real provider observations.

## Phase 7 — maintainer decisions

Local verification: 47 files / 273 tests, typecheck, lint and build passed; migration 0013 applied. See [Phase 7 evidence](../evidence/07-summary.md).

- [ ] Separate sandbox bounty with a partial merged solution reaches NEEDS_REVIEW; inspect revision, CI, full amount and recipients, supply a reason, confirm and verify one award/payment.
- [ ] Reject a separate candidate; verify immutable attribution/reason, preserved evidence and next merged candidate considered in stable order.
- [ ] Show stale confirmation rejection after evidence changes, loss of permission, and a duplicate action without a second award.
- [ ] Exercise issue/PR command routing and ambiguous PR links with explicit issue numbers in the browser/GitHub flow.

## Phase 8 — exceptional cancellation and refunds

Local verification: 57 files / 303 tests, typecheck, lint and build passed; migration 0014 applied. No cancellation requests or refund intents exist in the demo database. See [Phase 8 evidence](../evidence/08-summary.md).

- [ ] Obtain a separate independent operator account with repository evidence access, excluding creator/requester/funder/claimants.
- [ ] Explicitly authorize isolated activation; set its numeric repository scope and operator IDs. Keep general activation off. Fund a **new version 5 bounty**; do not retrofit the paid $50 bounty or other legacy terms.
- [ ] Publish notice, verify bot identity and persisted deadline, and wait the **full real 72 hours**. Injected-clock local tests do not satisfy this step.
- [ ] Demonstrate valid contributor work blocks cancellation and a qualifying merge earns one award with no refund.
- [ ] Review a genuine independent earlier fix with complete chronology, no copied/unresolved work and reasoned claim assessments; confirm as the independent operator.
- [ ] Verify the original capture's full-principal refund, provider completion, CANCELLED status and payer receipt, with one operation. Inspect pending/uncertain recovery without replacement keys.
- [ ] Verify stale review/new objection/access-loss behavior and public status links. Keep cross-service race limitations explicit.

## Phase 9 — visibility and role journeys

Local scoped API/stream, DOM and Chromium journeys are recorded in [Phase 9 evidence](../evidence/09-summary.md). No live payment or model request was initiated.

- [ ] Walk maintainer funding/review, contributor connection/claim, and independent operator notice/refund links with actual eligible accounts.
- [ ] Verify real repository/App permission loss, session expiry and reconnect hide private data and restore only current authorized state.
- [ ] Observe actual worker activity update the dashboard; inspect paid, failed/pending delivery and refund history against provider records.
- [ ] Check real content on mobile and with keyboard navigation. Complete earlier phase blockers before claiming full end-to-end acceptance.

## Later phases — expand during implementation

These are planned walkthroughs, not claims that implementation is complete.

| Phase | Final-session work | Setup/dependency |
| --- | --- | --- |
| [10](10.md) | Restart/recovery, access loss, missed webhooks and ambiguous provider outcomes without duplicate financial operations. | Controlled fault plan; clearly label simulations. |
| [11](11.md) | Hosted clean-session core flows and restart recovery. | Approved hosting setup and deployment; local checks alone do not establish hosted acceptance. |
| [12](12.md) | Complete evidence matrix, reproduce setup/demo, verify negative paths and obtain final acceptance. | Resolve or explicitly document all remaining blockers. |

Before the final session, consolidate accounts, eligible roles, sandbox balances, recipient connections, supported attribution, scopes, callback/webhook URLs, hosting and bounded Copilot request allowances. Record issue/PR/award/batch/item IDs and outcomes without credentials, tokens or recipient emails. Earlier Phase 2–3 deferred items must also be reconciled from their own evidence before final MVP claims.
