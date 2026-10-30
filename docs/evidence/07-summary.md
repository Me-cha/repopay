# Phase 7 — local implementation; live acceptance pending

October 30, 2026. User authorized moving to Phase 7 with Phase 6's delayed-claim and two-author live checks still deferred. Existing paid bounty 1 and immutable award remain unchanged.

## Implementation

- `actions/approve.ts`: current candidate preview, full-amount allocation choice, required reason, expiring single-use confirmation, fresh authorization/evidence checks, attributed approval and revision-bound rejection.
- `actions/reject.ts`: current-permission comment rejection adapter. Atomic job receipts prevent replay advancing to the next candidate; PR-targeted rejection cannot reject another PR.
- `settlement/award.ts`: shared automatic/manual final guard and rejection-aware stable candidate ordering. One immutable award, exact cents and verified recipients remain mandatory.
- `http/review.ts`: review and exact confirmation pages, CSRF/Origin validation, strict final body, escaped output and same-origin navigation. Financial confirmation cannot substitute recipients or amounts.
- Migration 0013: append-only review decisions, revision-specific rejection uniqueness and approval action tokens. Applied to development after ignored local backup `.local/backups/gitpay-before-phase7.dump`; worker stopped for migration and restarted afterward.
- GitHub approve/reject commands, linked-PR issue disambiguation, NEEDS_REVIEW projection link and authorized review history in the bounty API.

See [ADR 0009](../decisions/0009-maintainer-review-records.md) for schema and authority boundaries. No new model evaluation or payment was made by this implementation.

## Validation and limits

Database tests use isolated schemas; provider responses are mocked. Coverage includes partial approval with reason/full amount, missing merge, unknown recipient, stale evidence and assessment, lost permission, required CI, unverified authors, expired tokens, funding holds, duplicate confirmation, automatic/manual races, rejection preservation/next-candidate selection, committed-award rejection refusal, strict HTTP confirmation parameters, cross-origin denial and comment replay/PR-target binding. Initial tests exposed the action-token constraint missing `approve`; migration/schema were corrected without weakening the tests.

The live walkthrough still requires a new funded sandbox issue, partial merged solution, manual full-amount approval and a separate rejection case. The completed $50 bounty cannot be repurposed. The user deferred the proposed $1 sandbox setup and all remaining live walkthroughs until the final validation session. No live UI approval/rejection or new transfer is claimed. Co-contributor identity verification remains out of scope; choosing a recipient does not verify a new author. Runtime approval remains limited to the configured exact settlement scope.

## Final local verification

- `pnpm typecheck`, `pnpm lint`, `pnpm build`: passed.
- `TEST_DATABASE_URL=… pnpm test`: 47 files / 273 tests passed.
- `git diff --check`: passed.
- Development readback: bounty 1 remains PAID, exactly one award exists, and there are zero live review decisions. Migration applied and the separate worker started successfully.

No commits or pushes were made. Phase 7 is locally implemented, not live-acceptance complete.

The user accepted local-only verification for now. Remaining Phase 5 onward live cases are consolidated in [the final live checklist](../phases/live-walkthroughs.md). No new sandbox setup was started.
