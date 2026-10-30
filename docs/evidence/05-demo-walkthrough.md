# Phase 5 demo walkthrough — pending live evidence

Repository: https://github.com/deepakA18/gitpay-demo-http
Issue: https://github.com/deepakA18/gitpay-demo-http/issues/1
Owner/funder: deepakA18. Contributor: Me-cha (must accept collaborator invitation).
**Verified October 30, 2026:** the $50 sandbox capture is COMPLETED and GitPay records bounty 1 as FUNDED. Me-cha has accepted collaborator access. Contributor PR and Check Run acceptance remain pending. Do not repeat checkout.

This is an isolated PayPal sandbox demo. Do not open upstream PRs or merge a demo PR yet.

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
