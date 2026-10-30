# Phase 5 demo walkthrough — pending live evidence

Repository: https://github.com/deepakA18/gitpay-demo-http
Issue: https://github.com/deepakA18/gitpay-demo-http/issues/1
Owner/funder: deepakA18. Contributor: Me-cha (collaborator invitation accepted).
**Verified October 30, 2026:** the $50 sandbox capture is COMPLETED and GitPay records bounty 1 as FUNDED. Me-cha has accepted collaborator access. PR #3 has a completed advisory RESOLVES review, and Me-cha has saved a sandbox payout address. The new-code revision is also verified below. Remaining acceptance includes failed-attempt retry, live sponsor revocation/recovery, a second eligible contributor and Phase 6 merge/payout behavior. Do not repeat checkout.

This is an isolated PayPal sandbox demo. PR #3 was subsequently merged under Phase 6 authorization and bounty 1 reached PAID; see [Phase 6 evidence](06-summary.md). Earlier steps below are historical; do not repeat checkout or payment. Do not open upstream PRs.

## Owner

1. Review the updated issue criteria at `/bounties/1/fund` on the configured GitPay URL. The current draft is $50 USD sandbox.
2. Prepare/confirm checkout and approve it with a PayPal sandbox Personal account. Wait for GitPay's authoritative captured state; a browser return alone is not proof of capture.
3. Invite Me-cha to this demo repository and have them accept. The current MVP links same-repository PRs; use a branch here rather than a fork.

## Share with Me-cha

1. Sign in as Me-cha and accept the repository invitation.
2. Clone `https://github.com/deepakA18/gitpay-demo-http.git` and create a branch such as `demo/form-field-encoding`. Ensure your commit author is associated with your own GitHub account.
3. In `lib/paypalhttp/serializer/form_encoded.js`, escape the field name with `querystring.escape(key)` as well as the existing escaped value. Preserve all other serialization behavior.
4. Add regression cases to `demo-test/serializers.test.cjs`, preserving the existing tests. Include names containing `&`, `=`, spaces and Unicode, values requiring escaping, and an ordinary ASCII name. Use fixed expected encoded strings; do not skip tests or change production code to hardcode fixtures.
5. Run `node --test demo-test/serializers.test.cjs`, commit and push the branch to this demo repository.
6. Open a PR targeting this repository's default branch. Put `Fixes #1` in its description. Send the PR URL to the owner. Do not merge yet.

## Acceptance still to record

Observe the actual funded-bounty PR link and neutral GitPay Check Run. Push a new commit and verify a new exact-SHA review without replacing history; exercise a failed-attempt retry and check authorization-loss behavior. A second distinct eligible contributor is still needed for the competing-contributor walkthrough: the owner created this bounty and cannot earn it. Two PRs by Me-cha alone do not prove two-contributor acceptance.

The v2 synthetic evaluation passed 18/18. It does not replace these live steps. No result on this page is asserted complete merely because instructions exist. Automatic awards remain disabled, and Phase 6 payout acceptance is separate.


## Remaining personal-repository acceptance sequence

The user subsequently deferred remaining Phase 5 work and authorized scoped Phase 6 demo activation; see [ADR 0008](../decisions/0008-scoped-phase6-sandbox-acceptance.md). Unfinished checks here remain open.

1. **Verified:** Me-cha added the empty-form-body regression in head `d6e58e6cb3b3b42db6f73ce9541447be8235f72d`. External GitHub Actions tests passed. Verification 4 is DONE/RESOLVES with completed neutral Check Run 124036186873; verification 3 and both reviews of the old head remain preserved. This proves new-commit review, not failed-attempt recovery.
2. **Blocked:** the user confirmed no second eligible contributor is available. A second eligible contributor must open a competing same-repository PR referencing issue #1; the owner is excluded. Neither PR should be merged during this acceptance sequence. No waiver has been accepted.
3. **Revocation/reconnection verified:** verification 5 failed with VERIFIER_UNAVAILABLE while the owner grant was revoked; verification 6 hit the old-head cap. After reconnection, head `91717536b49518fb94f7e7fafe88161326fbfdf7` includes the empty-field-name regression and passed external CI. Verification 8 is RESOLVES with completed neutral Check Run 124044055304, serving model `gpt-6-luna`. Old review history remains intact. Successful manual recovery from ERROR on the same revision has not been demonstrated; new-revision success does not replace that case.
4. Record observed Check Runs, retry history and sponsor-state transitions. Organization sponsorship stays deferred. Local mock tests alone do not satisfy these live gates.
