# Phase 11 — hosted validation in progress

The user manually deployed the web service and selected Free Postgres (1 GB). On October 31, 2026 at 20:07 IST, public GET https://gitpay.onrender.com/healthz returned HTTP 200 with {"status":"ready","version":"0.0.0"}; the homepage also rendered GitPay and its sign-in link. Runtime health verifies database reachability and exact migration compatibility. Release commit, database identity, recovery hold, worker operation and provider configuration have not been independently verified. This is partial hosted evidence, not full acceptance.

- [ ] Approve the concrete Render resource/cost configuration and region; record actual service/database identifiers and release commit.
- [ ] Set shared secrets, hold both services, back up keys independently and run the single migration process. Verify exact schema readiness and worker hold.
- [ ] Configure real hosted GitHub callback/webhook and PayPal sandbox webhook; record successful deliveries without credentials or raw bodies.
- [ ] Read-only provider preflight, hosted Copilot SDK availability and separate sponsor consent; approve any new model/payment exercise independently.
- [ ] Fresh-session draft → funding → PR → exact-SHA review → merge → one payout and recipient receipt.
- [ ] Delayed claimant connects and resumes the original committed award.
- [ ] Independent cancellation review after the full actual notice produces one sandbox refund and original payer receipt.
- [ ] Restart a pending operation; record deployment/restart identity and unchanged saved operation keys/counts.
- [ ] App removal blocks new refunds; known financial reads and later restored access reconcile correctly. Expired sessions request sign-in; a second account cannot read private repository state.
- [ ] Restore into an isolated hosted database, audit provider activity since backup including missing intents, retain hold until reviewed and verify no duplicate external operation.

Use [deployment instructions](../deployment.md) and consolidate results in [the final live checklist](../phases/live-walkthroughs.md). No personal emails/tokens/keys belong here.

- [x] Verify public web endpoint and database/schema readiness: https://gitpay.onrender.com/healthz (October 31).

- [x] Hosted `/login` redirected to GitHub with `redirect_uri=https://gitpay.onrender.com/oauth/github/callback`; user subsequently supplied a successful sign-in screenshot showing deepakA18. This verifies the browser identity flow, not sponsor consent or webhook processing.

The user subsequently confirmed the fresh-database path through record counts and chose fresh demo issues, as recorded below. Local historical financial operations are not migrated or accepted by this hosted smoke test.

## Fresh hosted GitHub draft — October 31

User chose fresh hosted issues, preserving local financial history. Hosted SQL counts supplied by the user were zero bounties, awards, payout batches and submissions. User reported hosted inline mode enabled with discovery/cancellation disabled and settlement scope removed, then activated GitHub delivery.

Read-only GitHub verification: [issue #10](https://github.com/deepakA18/gitpay-demo-http/issues/10), created by deepakA18 with `/bounty create 1`, received [the bot reply](https://github.com/deepakA18/gitpay-demo-http/issues/10#issuecomment-6545765011) showing `$1.00 USD · OPEN`, hosted bounty ID 1 and funding/cancellation links under `https://gitpay.onrender.com`. The `bounty-open` label is present. Command timestamp 16:00:38Z; reply timestamp 16:00:50Z. This verifies GitHub intake, job processing and projection for the unfunded draft. It does not verify funding, sponsor consent, model runtime or payouts. Hosted bounty ID 1 is distinct from local bounty ID 1.

- [x] Fresh hosted GitHub command → persisted draft → bot reply and label.
- [x] Hosted status command and authenticated draft cancellation.

- [x] Hosted status command: deepakA18 posted `/bounty status` on issue #10 at 16:01:56Z; a separate [bot reply](https://github.com/deepakA18/gitpay-demo-http/issues/10#issuecomment-6545780123) at 16:02:05Z reported OPEN / unfunded / no money collected.
- [x] Authenticated draft cancellation: the user's subsequent status screenshot shows CANCELLED, zero award committed and zero delivered, with no payment/refund sent. Read-only GitHub API verification confirms the canonical bot comment now reports CANCELLED, `bounty-open` is removed (labels empty), and issue #10 remains open. Historical status/confirmation comments are retained. This validates unfunded cancellation only, not the deferred funded refund flow.

- [x] Hosted dashboard cancelled-draft display and refresh: user confirmed issue #10 looked correct at `/dashboard/?tab=bounties` after checking CANCELLED, zero awarded/delivered and retained history. User-observed acceptance; not an independent browser inspection.

- [x] Hosted signed-out access boundary (October 31): `/dashboard/` and `/bounties/1` returned 303 to `/login`; `/api/bounties/1` returned 401; none exposed the demo repository name or cancelled bounty state. `/healthz` remained 200. This does not establish private-repository cross-account isolation, token expiry or permission-revocation behavior.

## Next combined hosted / two-author walkthrough — prepared, not run

Proposed separate USD 1.00 sandbox bounty, subject to explicit checkout and review allowance. Keep cancelled issue #10 and all historical local bounties unchanged. Do not reuse their IDs or assume local sponsorship/connections exist in the fresh hosted database.

Fresh issue criteria: `FormEncoded.encode` must reject unsupported scalar values and unsupported array elements with a clear TypeError. Supported non-null values are strings, booleans and finite numbers; reject objects, nested arrays, functions, symbols, bigint, NaN and infinities. Preserve existing null/undefined behavior, field order, repeated pairs, escaping, zero/false/empty strings and input immutability. Preserve all existing tests. This is an isolated demo requirement, not an upstream PayPal change.

1. Confirm deployed release includes migration 0018 and attribution pages. Configure hosted sponsor consent, trusted CI and PayPal sandbox intake separately; verify hosted model runtime under the agreed allowance before payment activation.
2. Create a fresh issue with the frozen criteria and a USD 1.00 draft. Review the hosted funding page and complete one sandbox Personal-account checkout only after the amount/scope is approved.
3. Me-cha opens one PR from current main. Me-cha implements scalar validation; Mecha-Test-Account contributes a separate authenticated commit on that same branch implementing array-element validation. Each adds focused regression tests in `demo-test/serializers.test.cjs`. Both run `node --test demo-test/serializers.test.cjs`; retain all existing tests. Use actual GitHub-associated contributor commits, not fabricated author names or trailers.
4. After the final push and settled base/head, verify both author identities from GitHub. Mecha-Test-Account signs into the hosted `/submissions/<verified-id>/contributors` page and declares their contribution. deepakA18 separately confirms it with a reason. Do not guess the hosted submission ID. Any new head/base change requires both confirmations again.
5. Request one fresh review after both confirmations, within the approved bounded allowance. Verify exact-head CI, two eligible recipient IDs, complete evidence and proposed shares before merging. Approval of the evaluation alone does not authorize a payout.
6. Only when the exact sandbox scope and qualifying review are verified, merge the selected PR; verify immutable allocation sums to 100 cents, one award, stable payout identities, and both recipient outcomes/receipts. Hosted recipients connect their own accounts; local connections do not carry across databases.

This proposed case does not establish manual partial approval, recovery/restore, private-repository isolation or the deferred 72-hour refund flow.

Preparation observed: user authorized the fresh USD 1.00 hosted two-author case with up to six additional Auto requests, conditional on the corrected evaluation passing. That evaluation passed 18/18. [Issue #11](https://github.com/deepakA18/gitpay-demo-http/issues/11) was created and `/bounty create 1` produced [the hosted bot reply](https://github.com/deepakA18/gitpay-demo-http/issues/11#issuecomment-6546042262), bounty ID 2, USD 1.00 OPEN. Sponsor consent, checkout, contributor PR/attestations and settlement are pending; walkthrough request usage is 0/6. Release checks after scoped-profile acceptance: 368 server tests, 4 web tests, typecheck, lint and build passed. Build retains the existing large web-bundle warning.

- [x] Hosted owner sponsor consent: user screenshot confirms connected sponsor deepakA18 for deepakA18/gitpay-demo-http, Auto selected, profile checked 2026-10-31T16:32:25.266Z. Callback mismatch was resolved. This verifies consent/profile display, not a hosted model request; six-request walkthrough allowance remains unused by this step.

- [x] Hosted bounty 2 / issue #11 funding projection: read-only GitHub verification of comment 6546042262 reports USD 1.00 FUNDED / confirmed funding. This is application bot evidence, not independent PayPal capture inspection. No new PR linked to #11 was visible at this check. Bot displays an empty required-CI list; inspect frozen CI configuration before any merge/award acceptance.

Hosted PR inspection: PR #12 by Me-cha at `48ffdac26d3b4d56a0f7a6348459d1bfe03f842d` has passing external CI and hosted PARTIAL review (Check Run 124595840821; missing array validation), submission 1. PR #13 by Mecha-Test-Account at `894a36042b8e5595a5122780365b9195cbda57ea` targets main separately, has failing CI and hosted PARTIAL review (Check Run 124597924738; removed outer loop, undefined values/value/key/helper), submission 2. Both remain unmerged. Two published hosted model reviews are observed; total SDK attempt usage still requires authoritative accounting before retries. The additional contributor must add working code/tests to PR #12, then complete both exact-revision attestations before fresh review. This establishes hosted model execution and advisory publication, not complete solution or payout acceptance. No contributor email is retained here.

PR #12 updated to head `c934a41163d57eeeb714593b99d983218fff9725`, base `eda6f57b158571f25fe3ca6edea944614400ef22`. GitHub identifies Mecha-Test-Account on commits `8729e24bc6005ef151462722c9f6952fd9c375cf` and `a291edf677a576ed101a9a9118f6b34440064bd2`; Me-cha remains the authenticated PR author. External CI passes. Check Run 124600237110 explicitly reports no model review for this revision because one additional author remains unverified. Next: claimant and separate maintainer confirmations at hosted submission 1, before any fresh review. Both PRs remain open/unmerged.

ADR 0018 hosted declaration verified October 31: [Mecha-Test-Account's new comment](https://github.com/deepakA18/gitpay-demo-http/pull/12#issuecomment-6546841434) binds the above head/base. [App acknowledgement](https://github.com/deepakA18/gitpay-demo-http/pull/12#issuecomment-6546843408) reports the declaration saved and supplies the separate maintainer command. [Canonical PR projection](https://github.com/deepakA18/gitpay-demo-http/pull/12#issuecomment-6546843904) displays awaiting maintainer confirmation, current revision awaiting review, and discoverable checks/status/retry/sponsor links. This demonstrates the deployed command path and PR action discovery; it does not yet establish maintainer confirmation, stale-command rejection or independent model/payment accounting. No model or payment operation was requested during this verification.

Separate maintainer confirmation subsequently verified: [deepakA18's command](https://github.com/deepakA18/gitpay-demo-http/pull/12#issuecomment-6546862964) received [App acknowledgement](https://github.com/deepakA18/gitpay-demo-http/pull/12#issuecomment-6546865001) that both confirmations are saved for the above revision. The canonical PR projection now reports Mecha-Test-Account as maintainer confirmed. Fresh review has not been requested in this verification; authoritative hosted model-attempt accounting remains necessary against the six-request allowance before retrying.

User authorized exactly one additional Auto review for this revision, even if the original six-request allowance is exhausted. Browser navigation reached the hosted retry URL, but its content was unavailable to automation even after reload. No retry was submitted by the agent; the additional authorization remains unused by this action. User handoff is required to submit once; verify the resulting Check Run before any further retry.

User subsequently submitted the retry. Check Run 124609710405 completed at unchanged head `c934a41163d57eeeb714593b99d983218fff9725`: PARTIAL, coverage 90%, confidence 88%, CI pass. Its reasoning accepts scalar/array validation, supported/unsupported tests and preserved encoding behavior; the sole unmet requirement asks for separate GitHub-associated contributions and exact-revision declarations/maintainer confirmation. The additional one-request allowance is now consumed by this observed review; no further retry is authorized by that allowance. PR #12 remains open and unmerged. Source inspection identifies an evidence gap: collection uses authenticated confirmations to select eligible authors, but `buildVerifierPrompt` supplies only author IDs/logins, omitting attestation and commit-provenance details requested by the frozen two-contributor walkthrough text. Do not override the verdict, rewrite frozen terms or repeat the unchanged review. Correct and verify the evidence boundary before another model request; two-author acceptance remains open.
