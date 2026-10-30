# Phase 06 — local implementation, live acceptance pending

October 30, 2026. Current implementation is an uncommitted worktree change over `9a7dcf7`, authorized by the user's request to move to Phase 6. Copilot remains Auto; organization sponsorship remains explicitly blocked. No live Copilot request or PayPal transfer was made during this implementation.

## Implemented locally

- Deterministic policy and exact-cent allocation from 06.01 remain in place.
- Candidate reconciliation combines paginated REST PR inventory, GraphQL closing references and saved submission links. Incomplete scans hold selection. Settlement checks the bounty version, candidate fingerprint, current evidence/prompt hash, sponsor/profile, revision and CI before selecting by merge time then stable PR ID. Earlier unresolved submissions block later awards; a late-discovered earlier candidate records attention without a second award.
- Migration 0010 adds the unique immutable award and exact winning evidence/revisions. Database triggers reject award edits/deletes and malformed allocations.
- Migrations 0011–0012 add one immutable account-bound batch and one item per award recipient, stable sender IDs, encrypted destination snapshots, persisted submission boundaries/deadlines and observation versions. Changed contributor addresses or PayPal account configuration cannot redirect an existing intent.
- Submission persists identity before external calls and retries only that identity inside the saved window. A known provider batch is read, not posted again. Unknown outcomes beyond the window remain reserved for investigation.
- Item reconciliation validates batch/item identity, destination, currency and cents; PAID requires all SUCCESS. Mixed, unknown, failed, unclaimed and returned items preserve the award. Paid batches are revisited daily; a return changes delivery state without creating a replacement payment. Observation fencing rejects stale reads.
- Claim jobs and bounded worker polling resume the original award only after all recipients connect. Status comments explain claim/delivery states; scoped API reads expose paid/unpaid cents without payment addresses.
- Funding polling now preserves later award/payment states instead of resetting them to FUNDED.

## Verification

All provider calls in these tests are mocked. Database tests use unique schemas in `gitpay_test`.

- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `TEST_DATABASE_URL=postgresql://gitpay:gitpay@127.0.0.1:5433/gitpay_test pnpm test` — **44 files, 253 tests passed**.
- `pnpm build` — passed.
- Key suites: `award-selection.test.ts`, `payout.test.ts`, `payouts.test.ts`, `github-app.test.ts`, `capture.test.ts`, plus existing policy/allocation checks. Coverage includes concurrent awards/reservations, reverse merge arrival, incomplete/stale evidence, immutable records, lost POST responses and bounded identical retries, expired windows, changed addresses/accounts, stale provider observations, delayed two-author claims, mixed outcomes, returns after PAID, cancellation refusal and private read models.
- Migrations were exercised in isolated test schemas. They have **not** been applied to the development database by this change.

The earlier 06.01 record reported seven focused policy/allocation tests and a 223-test full suite; the counts above supersede those local check totals. No claim is made that every new suite was first observed failing.

## Activation and remaining acceptance

**Phase 6 is not complete.** The runtime profile gate defaults closed and automatic candidate scanning is not scheduled. Tests inject acceptance in fixtures only. Accepted Phase 5 live Auto evaluation and a reviewed runtime acceptance binding are required before enabling automatic selection; no environment bypass was added.

Remaining evidence includes real GitHub merge/squash/rebase and exact-CI behavior, real sandbox recipient receipts, a delayed connection payout and two-author walkthrough. Payout webhook scheduling is not implemented; bounded periodic polling supplies reconciliation. Manual review uses a future Phase 7 integration with the same award guard and is not claimed here. No paid-return or provider timeout scenario was verified against live PayPal in this phase. Do not use historical Phase 0 probe receipts as Phase 6 acceptance.

Development setup must back up the database, stop workers, apply migrations and restart before using the new schema. No payment operation, commit, push or deployment was performed.

## Provider contracts consulted

- [PayPal sender batch identity](https://developer.paypal.com/api/payments.payouts-batch/v1/definitions/sender_batch_header/) documents the 30-day duplicate window; GitPay retains its shorter conservative retry deadline.
- [PayPal payout reads](https://developer.paypal.com/api/payments.payouts-batch/v1/payouts-get/) and [item statuses](https://developer.paypal.com/api/payments.payouts-batch/v1/definitions/transaction_enum/) underpin pagination and item-level reconciliation.
- [GitHub pull request REST API](https://docs.github.com/en/rest/pulls/pulls) and [GraphQL objects](https://docs.github.com/en/graphql/reference/objects#pullrequest) underpin the bounded candidate inventory and closing references.


## Later setup amendment — October 30

During the user-authorized Phase 5 $50 sandbox walkthrough setup, the development database was backed up and migrations through 0012 were applied successfully; the separate worker was then started. This supersedes the earlier unapplied-development-migration note. Phase 5 prompt v2 passed 18/18 live evaluation fixtures, but its live workflow and Phase 6 payout acceptance remain open. Automatic award selection remains disabled. See [Phase 5 evidence](05-summary.md).
