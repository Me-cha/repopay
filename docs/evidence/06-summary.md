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

All provider calls in these tests are mocked. Database tests use unique schemas in `repopay_test`.

- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `TEST_DATABASE_URL=postgresql://repopay:repopay@127.0.0.1:5433/repopay_test pnpm test` — **44 files, 253 tests passed**.
- `pnpm build` — passed.
- Key suites: `award-selection.test.ts`, `payout.test.ts`, `payouts.test.ts`, `github-app.test.ts`, `capture.test.ts`, plus existing policy/allocation checks. Coverage includes concurrent awards/reservations, reverse merge arrival, incomplete/stale evidence, immutable records, lost POST responses and bounded identical retries, expired windows, changed addresses/accounts, stale provider observations, delayed two-author claims, mixed outcomes, returns after PAID, cancellation refusal and private read models.
- Migrations were exercised in isolated test schemas. They have **not** been applied to the development database by this change.

The earlier 06.01 record reported seven focused policy/allocation tests and a 223-test full suite; the counts above supersede those local check totals. No claim is made that every new suite was first observed failing.

## Activation and remaining acceptance

**Phase 6 is not complete.** The runtime profile gate defaults closed and automatic candidate scanning is not scheduled. Tests inject acceptance in fixtures only. Accepted Phase 5 live Auto evaluation and a reviewed runtime acceptance binding are required before enabling automatic selection; no environment bypass was added.

Remaining evidence includes real GitHub merge/squash/rebase and exact-CI behavior, real sandbox recipient receipts, a delayed connection payout and two-author walkthrough. Payout webhook scheduling is not implemented; bounded periodic polling supplies reconciliation. Manual review uses a future Phase 7 integration with the same award guard and is not claimed here. No paid-return or provider timeout scenario was verified against live PayPal in this phase. Do not use historical Phase 0 probe receipts as Phase 6 acceptance.

Development setup must back up the database, stop workers, apply migrations and restart before using the new schema. No payment operation, commit, push or deployment was performed.

## Provider contracts consulted

- [PayPal sender batch identity](https://developer.paypal.com/api/payments.payouts-batch/v1/definitions/sender_batch_header/) documents the 30-day duplicate window; Repopay retains its shorter conservative retry deadline.
- [PayPal payout reads](https://developer.paypal.com/api/payments.payouts-batch/v1/payouts-get/) and [item statuses](https://developer.paypal.com/api/payments.payouts-batch/v1/definitions/transaction_enum/) underpin pagination and item-level reconciliation.
- [GitHub pull request REST API](https://docs.github.com/en/rest/pulls/pulls) and [GraphQL objects](https://docs.github.com/en/graphql/reference/objects#pullrequest) underpin the bounded candidate inventory and closing references.


## Later setup amendment — October 30

During the user-authorized Phase 5 $50 sandbox walkthrough setup, the development database was backed up and migrations through 0012 were applied successfully; the separate worker was then started. This supersedes the earlier unapplied-development-migration note. Phase 5 prompt v2 passed 18/18 live evaluation fixtures, but its live workflow and Phase 6 payout acceptance remain open. Automatic award selection remains disabled. See [Phase 5 evidence](05-summary.md).


## Phase 6 continuation — October 30, 2026

The user requested proceeding with Phase 6 after PR #3's live RESOLVES review. The separate owner sponsor, $50 sandbox capture and Me-cha's repository access are established; remaining Phase 5 workflow acceptance has not been silently waived.

Candidate reconciliation now re-reads the bounded PR inventory after linking/collecting evidence and refuses a complete scan if membership or observed PR metadata/revisions changed. GitHub pagination is not a globally atomic snapshot; this check detects observed inventory races but does not promise that a new merge cannot occur after the final provider read. Existing bounty/evidence version fencing still applies under the award lock.

The new candidate-scan regression failed before the fix. Tests also verify incomplete closing-reference pagination holds selection and removed issue references do not erase saved manual links. Full verification passed: **45 files / 258 tests**, typecheck, lint and build. Live closing-reference lookup returned PR #3 → issue #1. The live scanner completed with one OPEN candidate (PR #3), no merged evidence, and no award or payout. Me-cha's recipient connection is still absent at the last check; connection instructions were provided without requesting payment addresses in chat.

Remaining activation work is explicit: bind accepted verifier evidence to runtime settlement and complete/defer remaining personal-workflow gates through a reviewed decision before scheduling automatic awards. The runtime currently keeps that gate closed. Merge/exact-CI acceptance, a real sandbox recipient receipt, delayed-claim and two-author walkthroughs remain open. Do not merge or expect a transfer solely because these local checks pass.


### Recipient connected — October 30, 2026

Me-cha completed the browser payout-address flow after the GitHub App visibility issue was resolved. A metadata-only database check confirms contributor 127575583, connection version 1; retry_claims job 36 completed on its first attempt. No recipient address was displayed or copied to evidence. Bounty 1 remains FUNDED at 5,000 cents, with zero awards and zero payout batches. This verifies connection/resume-job intake, not delayed-award payout completion or PayPal account ownership. Runtime settlement activation and merge/payout acceptance remain outstanding.


## Scoped integration prepared — October 30, 2026

The user requested Phase 6 completion. A default-off `SETTLEMENT_DEMO_SCOPE` now binds one exact bounty, repository, integer amount, frozen-terms hash and configured sandbox merchant. `settlement/profile.ts` accepts only the evaluated Auto v2 / SDK 1.0.28 profile; the runtime also restricts the actual serving model to the evaluated `gpt-6-luna`. The running configuration has not been enabled: a decision on limited demo acceptance versus completing remaining Phase 5 gates is pending from the user. No merge or payout was performed by this change.

The worker can now reconcile the scoped candidate inventory, enqueue stale merged evidence, wait for a matching completed review and commit the existing guarded award. It revalidates the owner sponsor against GitHub before selection; the award transaction separately locks/checks the stored grant for matching identity, model, installation, expiry and revocation. Existing committed payout reconciliation is independent of scope removal.

A merge-version defect was fixed: unchanged diff hashes no longer reuse evidence from an older submission version. The verifier saves a new version and review rather than leaving settlement permanently held after merge. Tests cover wrong scope bindings, revoked sponsorship, unevaluated serving models and merge-version evidence preservation. Full suite: **46 files / 262 tests passed**; typecheck, lint and build passed before the final additional merchant guard, whose focused checks are recorded with the subsequent verification. No live request was spent by these tests.

Still required for completion: approved activation decision; real qualifying merge and sandbox payout/recipient receipt; delayed-claim loop and two-author live acceptance. These are not marked complete by the successful local tests. Organization support remains deferred.


### Activation decision — October 30, 2026

The user chose **Finish all Phase 5 gates first**, rejecting limited-demo activation with deferred personal-workflow gates. `SETTLEMENT_DEMO_SCOPE` remains unset and automatic settlement is disabled. The scoped implementation remains inactive; no merge, award or payout is authorized by the earlier proposal. Continue Phase 5 before revisiting activation. Organization support remains separately deferred by the prior user decision.

### Superseding activation decision — October 30, 2026

The user subsequently directed proceeding to complete Phase 6, deferring the remaining Phase 5 work. [ADR 0008](../decisions/0008-scoped-phase6-sandbox-acceptance.md) records the limited acceptance and supersedes the prior activation hold. Saved `SETTLEMENT_DEMO_SCOPE` binds only bounty 1, repository 1435468752, 5,000 cents and the exact existing terms hash; the evaluated profile and merchant binding passed validation. The worker was restarted through its watcher to load this configuration. An actual application settlement scan returned `waiting` with no merge/award. Me-cha's connection exists; bounty 1 is FUNDED without funding hold, with zero awards/batches before activation. The owner was asked to merge PR #3 using a merge commit because the App has only read access to PRs.

Current checks passed: typecheck, lint, build, and 46 files / 263 tests. Provider calls in tests remain mocked; the candidate/profile scan above used live GitHub and current sponsor authorization. Real merge, payout/receipt, delayed-claim and two-author acceptance remain outstanding. No new capture or payout was manually submitted.

### Merge observed; missing REST merge identity repaired — October 30, 2026

The owner merged PR #3 at `2026-10-30T12:00:16Z`, head `91717536b49518fb94f7e7fafe88161326fbfdf7`. Post-merge verification 9 completed RESOLVES, but settlement correctly held because the REST response omitted merge_commit_sha. The GitHub adapter now falls back to the documented GraphQL mergeCommit.oid only when the REST merged PR lacks that field. It checks repository name, stable PR ID, head SHA and merge timestamp and rejects errors/mismatched identity. The regression failed before the fix and passed afterward. Live GraphQL resolved merge SHA `ae4e27bb7808336b0f351d3a06f832e7129c16db`, now stored on submission 1.

Refreshing that revision metadata produced evidence version 13; verification 10 is ERROR/VERIFIER_BUDGET_EXHAUSTED. No award or payout was created. One additional scoped review was requested from the user; no cap was raised and no review history was reset. Checks passed: typecheck, lint, build, 46 files / 264 tests. Provider calls in tests are mocked. The live merge gate is observed, but current accepted evidence and payout/receipt remain outstanding.

Provider contract: [GitHub GraphQL PullRequest.mergeCommit](https://docs.github.com/en/graphql/reference/pulls). Missing authoritative merge evidence remains a hold, never a guessed SHA.

### First live Phase 6 sandbox payout succeeded — October 30, 2026

The user approved exactly one additional Auto review for the merged revision. A one-off invocation used a per-SHA cap of 4 with a wrapper limiting model invocation to one; the configured normal cap remains 3. Budget-rejected records were preserved and excluded under the existing budget predicate. Verification 11 completed DONE/RESOLVES after exactly one model call, with the current merged evidence.

The normal settlement service committed award 1 for the full 5,000 cents to Me-cha (127575583), then reserved one immutable batch/item. PayPal sandbox batch `2ZK7VSQG386F8`, item `MSLJBZ8Q34AN4`, progressed from PENDING to SUCCESS. Reconciliation now records bounty 1 PAID with no attention. Subsequent reads reused the known provider batch identity; no replacement batch or payment was created. Database counts confirm one award, one batch and one item. Recipient addresses and credentials were not printed or retained in this evidence.

Recipient-side confirmation from Me-cha was requested and remains pending. This completes the observed merge → qualified award → provider-confirmed sandbox payout path, not all Phase 6 acceptance. A real delayed-connection claim-resumption loop and two-author walkthrough remain outstanding; those paths have mocked integration coverage only. The second eligible contributor is still unavailable. No further model request was authorized or made in this step.


### Recipient receipt confirmed — October 30, 2026

The user relayed Me-cha's confirmation that the $50 sandbox payout was received and supplied a PayPal Activity screenshot showing “Test Store”, “30 Oct · Payment Received”, and +$50.00. This corroborates the previously observed provider SUCCESS and Repopay PAID state. The screenshot does not expose a transaction ID, so transaction binding relies on the recorded provider batch/item evidence plus the user's confirmation. Unrelated account activity and balance are not retained here.

The primary funded issue → merged PR → award → payout → recipient receipt walkthrough is evidenced. Phase 6 remains incomplete against its full exit gate: the live delayed-claim loop and two-author walkthrough are still outstanding, with local mocked coverage only. No additional payment or model call was made to record this confirmation.


### Remaining live-check feasibility — October 30, 2026

The user asked to complete the remaining live checks if unblocked. Database inspection confirms only bounty 1 (PAID, creator deepakA18) and only Me-cha's contributor connection. A delayed-claim test is feasible without a third account: Me-cha can create a separate sandbox bounty, deepakA18 can submit the solution while leaving their payout connection absent, then connect only after the award reaches AWAITING_CLAIM. This requires new sandbox checkout, a contributor PR and a separately bound settlement scope; no existing payment or connection should be reset to simulate it.

The live two-author path has two concrete blockers. Only two GitHub identities are available, while the bounty creator is ineligible, leaving at most one eligible contributor on a bounty. Independently, verifier/collect.ts currently admits only the authenticated PR author to eligibleAuthors and treats additional commit authors as unverified, making the evidence insufficient. A third account alone does not solve this: authenticated revision-bound co-contributor attribution or the planned reviewed path must be implemented and validated before an actual two-payee award can be selected. The mocked two-author payout tests start with an already constructed award and do not establish this onboarding/selection path. Do not substitute commit email/co-author trailers as proof or insert a synthetic live award.

## October 31 — delayed-claim award reached

Issue #4 / bounty 3, PR #6 merged at `4344c7e16fb1e3a6fc8ecd014498874735c2bcf1`. Post-reconciliation verification 31 returned RESOLVES. Normal scoped settlement committed award 2 for 100 cents to submission 3; bounty is AWAITING_CLAIM, recipient unconnected, zero payout batches. Bounty 1 remains PAID. Scope was process-local; normal environment unchanged. See [walkthrough](05-demo-walkthrough.md#delayed-claim-award-observed-october-31). Connection/resumption/receipt and two-author allocation remain open.

### Delayed claim resumed to PAID — October 31

Database inspection confirms Mecha-Test-Account (350676467) connected at version 1. Original award **2**, submission 3, remains **100 cents**. Exactly one batch **2** / provider `XCKBDAE9R9JQJ` and one item **2** / provider `GVHRMZVAW47BA` exist for that award. The worker recorded item **SUCCESS** and bounty 3 **PAID**, with no attention flag. No new award, checkout or manual replacement payout was created by this check. This verifies saved provider-observation state; recipient Activity confirmation remains pending. The earlier deepakA18 connection did not resume this recipient's award. No additional Copilot request was used.

### Paid issue labels — October 31

User requested a visible completion label. The GitHub badge adapter now reconciles `bounty-open` and `bounty-paid` independently, preserving unrelated labels. PAID adds `bounty-paid`; all other states remove it, including PAYING after a return. Award/cancellation states remove `bounty-open`; merge alone does not assert successful payment. Applied the adapter to recorded PAID demo bounties 1 and 3 (issues #1 and #4). No comment, money operation or model request was created. Typecheck, lint, 354 server tests and 4 web tests passed; new adapter cases cover paid projection and removal for awaiting-claim, paying and cancelled states.

October 31 recipient confirmation: user confirmed Mecha-Test-Account received the $1 in sandbox Activity. Delayed-claim acceptance now passes: award 2 existed before connection, resumed with one batch/item, recorded SUCCESS/PAID, and recipient receipt confirmed. Two-author allocation and other broader Phase 6 checks remain open.

## October 31 — authenticated additional contributors

Implemented [ADR 0017](../decisions/0017-confirmed-contributor-attribution.md). Each additional API commit author authenticates and declares their contribution; a separate current write-authorized maintainer confirms it. Both bind head/base and become ineligible when either changes. Old attestations remain immutable. The collector and final settlement scan share the confirmed identity set. Bounty/submission locks and version increments fence concurrent reviews and awards; no confirmation can modify a committed award or trigger a provider request.

Validation: 367 server tests across 69 files plus 4 web tests passed, including four new attribution integration cases. Typecheck, lint and build passed. The existing frontend bundle-size warning remains. Migration 0018 applied to the local sandbox database after a private local backup; `pnpm db:check` confirms matching history. No live split payout was performed. The live two-author exercise remains unchecked, and v3 settlement remains blocked by the failed 17/18 evaluation.
