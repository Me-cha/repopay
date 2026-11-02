# Phase 8 — local cancellation and refund verification

Date: 2026-10-30

Status: Local implementation and automated verification complete. Live operator/72-hour-notice/refund acceptance is deferred by user direction; funded cancellation remains disabled. This does not mark Phase 8's full exit gate complete.

## Implemented

- Migration 0014 adds requests, immutable evidence/decisions and immutable refund intent identities; REFUNDING reserves the principal against concurrent awards.
- Version 5 freezes cancellation-enabled Auto terms only for explicitly scoped new funding. Existing versions 1–4 and the completed $50 bounty retain their original terms/hashes.
- Authenticated requests require current write access, reason and same-repository evidence links. One active request; no money moves on request or operator decision.
- Full 72-hour notice begins only after App-authenticated publication/recovery. Delayed/lost publication does not consume notice time; forged user markers do not count.
- Background bounded evidence refresh retains open/closed PRs, patches, saved snapshots and non-writer objections. Unknown/truncated access blocks approval. Material changes invalidate prior approval; closed/edited claims are retained.
- Independent allowlisted operators cannot be creator, requester, funder or observed claimant. Evidence-version-bound expiring one-use confirmations record concrete dismissal reasons, decision and hold follow-up.
- Shared bounty lock protects award/refund allocation. Fresh evidence/access/full capture are checked before reservation and submission. Proven unsent abort restores the immediate prior lifecycle state; after the durable boundary uncertainty never releases principal.
- Sandbox refund adapter uses original capture/full cents and one saved request key. Known IDs use GET; ambiguous same-key retries have a persisted bounded window. Failed/pending/unknown outcomes retain history and reservation. Only confirmed COMPLETED becomes CANCELLED. Late evidence remains an investigation even after completion.
- Authenticated request/review pages, GitHub status/notice links, worker polling and operational guidance are connected. No generic replacement refund endpoint exists.

Ownership mapping and limitations: [ADR 0010](../decisions/0010-cancellation-refund-boundaries.md). Operational procedures: [operations](../operations.md).

## Verification

Initial boundary test failed because the cancellation module did not exist. Focused integration runs exposed and corrected test profile setup and cross-schema advisory lock collisions. Test database network access required sandbox escalation; local schemas remained isolated and all provider calls were mocked.

Commands using repository-local Node 22.23.4:

```sh
pnpm typecheck
pnpm lint
TEST_DATABASE_URL=postgresql://repopay:repopay@127.0.0.1:5433/repopay_test pnpm test
pnpm build
git diff --check
```

Results: **57 test files / 303 tests passed**; typecheck, lint, build and whitespace checks passed. Integration coverage includes real Postgres locks/constraints with simulated GitHub/PayPal responses and an injected clock. HTTP request/CSRF and refund transport/schema checks are local, not live provider acceptance.

Test map:

| Contract | Evidence |
| --- | --- |
| Request, access, duplicate notice, delayed/lost publication, forged marker, legacy terms | `test/integration/cancellation-request.test.ts` |
| Retained closed PRs, copied-work objections, non-writer comments, missing evidence | `test/integration/cancellation-evidence.test.ts` |
| Conflict checks, early/stale/expired/replayed tokens, assessments, held next update | `test/integration/cancellation-review.test.ts` |
| Reservation, immediate prior state, permission loss, late evidence | `test/integration/refund-authorization.test.ts` |
| Replay, response loss, retry expiry, pending/failure, exact identity, late investigation | `test/integration/refund-submit.test.ts` |
| Cancel-then-merge, concurrent award/refund allocation | `test/integration/cancel-then-merge.test.ts` |
| Reviewed exception and new valid claim invalidating approval | `test/integration/cancellation-matrix.test.ts` |
| Request-page CSRF, independent operator preview/confirmation, amount substitution and replay rejection, no refund on decision | `test/integration/cancellation-http.test.ts` |
| URL/operator boundaries and sandbox transport/schema | `test/unit/cancellation.test.ts`, `test/unit/refunds.test.ts` |

## Local runtime observation

Worktree was clean at Phase 8 start; changes remain uncommitted. Stopped local watchers, backed up Postgres to ignored `.local/backups/repopay-before-phase8.dump`, applied migration 0014 with `pnpm db:migrate`, and restarted server and separate worker. `/healthz` reports ready. Configuration check: cancellation disabled, no operator or cancellation repository scope configured. Database check: **0 cancellation requests, 0 refund intents; bounty 1 remains PAID, 1 original award, 1 payout item**. No live refund/model/payment exercise was initiated.

## Remaining acceptance

Real independent-operator workflow, unshortened 72-hour publication-to-deadline notice, sandbox refund receipt and live abuse scenario remain on the [final live checklist](../phases/live-walkthroughs.md). A separate eligible operator and newly funded version 5 bounty will be required. Same-repository evidence links, bounded collection and cross-service race limits are documented in ADR 0010. Do not enable general funded cancellation or treat simulated notice time as elapsed live notice.
