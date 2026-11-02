# Phase 5 demo walkthrough — pending live evidence

Repository: https://github.com/deepakA18/repopay-demo-http
Issue: https://github.com/deepakA18/repopay-demo-http/issues/1
Owner/funder: deepakA18. Contributor: Me-cha (collaborator invitation accepted).
**Verified October 30, 2026:** the $50 sandbox capture is COMPLETED and Repopay records bounty 1 as FUNDED. Me-cha has accepted collaborator access. PR #3 has a completed advisory RESOLVES review, and Me-cha has saved a sandbox payout address. The new-code revision is also verified below. Remaining acceptance includes failed-attempt retry, live sponsor revocation/recovery, a second eligible contributor and Phase 6 merge/payout behavior. Do not repeat checkout.

This is an isolated PayPal sandbox demo. PR #3 was subsequently merged under Phase 6 authorization and bounty 1 reached PAID; see [Phase 6 evidence](06-summary.md). Earlier steps below are historical; do not repeat checkout or payment. Do not open upstream PRs.

## Owner

1. Review the updated issue criteria at `/bounties/1/fund` on the configured Repopay URL. The current draft is $50 USD sandbox.
2. Prepare/confirm checkout and approve it with a PayPal sandbox Personal account. Wait for Repopay's authoritative captured state; a browser return alone is not proof of capture.
3. Invite Me-cha to this demo repository and have them accept. The current MVP links same-repository PRs; use a branch here rather than a fork.

## Share with Me-cha

1. Sign in as Me-cha and accept the repository invitation.
2. Clone `https://github.com/deepakA18/repopay-demo-http.git` and create a branch such as `demo/form-field-encoding`. Ensure your commit author is associated with your own GitHub account.
3. In `lib/paypalhttp/serializer/form_encoded.js`, escape the field name with `querystring.escape(key)` as well as the existing escaped value. Preserve all other serialization behavior.
4. Add regression cases to `demo-test/serializers.test.cjs`, preserving the existing tests. Include names containing `&`, `=`, spaces and Unicode, values requiring escaping, and an ordinary ASCII name. Use fixed expected encoded strings; do not skip tests or change production code to hardcode fixtures.
5. Run `node --test demo-test/serializers.test.cjs`, commit and push the branch to this demo repository.
6. Open a PR targeting this repository's default branch. Put `Fixes #1` in its description. Send the PR URL to the owner. Do not merge yet.

## Acceptance still to record

Observe the actual funded-bounty PR link and neutral Repopay Check Run. Push a new commit and verify a new exact-SHA review without replacing history; exercise a failed-attempt retry and check authorization-loss behavior. A second distinct eligible contributor is still needed for the competing-contributor walkthrough: the owner created this bounty and cannot earn it. Two PRs by Me-cha alone do not prove two-contributor acceptance.

The v2 synthetic evaluation passed 18/18. It does not replace these live steps. No result on this page is asserted complete merely because instructions exist. Automatic awards remain disabled, and Phase 6 payout acceptance is separate.


## Remaining personal-repository acceptance sequence

The user subsequently deferred remaining Phase 5 work and authorized scoped Phase 6 demo activation; see [ADR 0008](../decisions/0008-scoped-phase6-sandbox-acceptance.md). Unfinished checks here remain open.

1. **Verified:** Me-cha added the empty-form-body regression in head `d6e58e6cb3b3b42db6f73ce9541447be8235f72d`. External GitHub Actions tests passed. Verification 4 is DONE/RESOLVES with completed neutral Check Run 124036186873; verification 3 and both reviews of the old head remain preserved. This proves new-commit review, not failed-attempt recovery.
2. **Blocked:** the user confirmed no second eligible contributor is available. A second eligible contributor must open a competing same-repository PR referencing issue #1; the owner is excluded. Neither PR should be merged during this acceptance sequence. No waiver has been accepted.
3. **Revocation/reconnection verified:** verification 5 failed with VERIFIER_UNAVAILABLE while the owner grant was revoked; verification 6 hit the old-head cap. After reconnection, head `91717536b49518fb94f7e7fafe88161326fbfdf7` includes the empty-field-name regression and passed external CI. Verification 8 is RESOLVES with completed neutral Check Run 124044055304, serving model `gpt-6-luna`. Old review history remains intact. Successful manual recovery from ERROR on the same revision has not been demonstrated; new-revision success does not replace that case.
4. Record observed Check Runs, retry history and sponsor-state transitions. Organization sponsorship stays deferred. Local mock tests alone do not satisfy these live gates.

## October 31 — fresh competing-contributor walkthrough (in progress)

The user authorized starting this test after Phase 12 preparation. This resumes the competing-PR scenario only; other deferred walkthroughs remain separate.

- Verified `Mecha-Test-Account` has repository **write** access. The creator is deepakA18; the two intended contributors are Me-cha and Mecha-Test-Account. Additional-account availability is no longer the blocker for this scenario. It does not establish authenticated co-author attribution for split payouts.
- Created [issue #4](https://github.com/deepakA18/repopay-demo-http/issues/4): array form values must produce repeated escaped pairs, omit empty arrays, retain empty strings, preserve scalar behavior/order, and not mutate input. Both contributors use current `main` and separate same-repository branches. Neither PR should be merged during this test.
- Posted `/bounty create 1` as deepakA18. Signed intake and the worker created **bounty 3**, amount **100 cents**, status **OPEN**. [Bot confirmation](https://github.com/deepakA18/repopay-demo-http/issues/4#issuecomment-6541702662) links its funding page. No checkout/capture is claimed from draft creation.
- Existing bounty 1 remains **PAID**, 5000 cents. Its issue/award/payment is not reused.
- Local server and existing HTTPS tunnel returned `ready`. Stored owner sponsor is `deepakA18`, model `auto`, with no local revocation marker. This database observation alone does not prove a fresh provider token refresh.
- Baseline demo main SHA: `ae4e27bb7808336b0f351d3a06f832e7129c16db`. An isolated Node 22 regression harness tested five cases against the fetched serializer: repeated values, escaped array name/elements, omitted empty array, retained empty string, and mixed frozen input. **All five failed as expected** on the baseline (arrays are currently serialized as comma-separated strings). These establish a real missing feature, not successful implementation. Scratch harness: `/private/tmp/repopay-competing-pr/array-regression.cjs` (not a retained release artifact).

### Contributor steps (each account separately)

1. Clone `https://github.com/deepakA18/repopay-demo-http.git` into a fresh working directory, or update an existing clean clone from `origin/main`.
2. Create a separate branch from current `main`: `demo/array-form-mecha` for Me-cha or `demo/array-form-test-account` for Mecha-Test-Account.
3. Implement all issue #4 acceptance criteria in `lib/paypalhttp/serializer/form_encoded.js`, preserving existing behavior and tests. Add regression tests to `demo-test/serializers.test.cjs`.
4. Run `node --test demo-test/serializers.test.cjs`, then commit and push the branch using that contributor's own authenticated account.
5. Open a same-repository PR into `main` using that account. Include **Fixes #4** in the description. Do not merge. Return both PR URLs to the operator.

### Outstanding for this scenario

- User sandbox checkout at `/bounties/3/fund`; authoritative captured/FUNDED state must be observed.
- Explicit allowance requested for at most **6 Copilot Auto requests** including necessary retries; approval is pending. Prior evaluation allowances are not reused.
- Both real contributor PRs, their persistent links, exact-head external CI and Repopay Check Runs. The current CLI is authenticated only as deepakA18; changing commit author metadata cannot substitute for contributor-authored PRs.
- Record verdicts, attempt counts, immutable evidence, distinct author IDs and no pre-merge award/payment. Only then mark this scenario passed.

CI setup checked: `.github/workflows/demo-ci.yml` runs on push and pull_request with read-only contents permissions, Node 22 and `npm test`. The demo package maps that command to `node --test demo-test/*.test.cjs`, so the requested serializer regressions are included. Final observation before contributor handoff: no open PRs, bounty 3 still OPEN/unfunded, and zero review attempts today. The test is pending participant actions, not passed.


### Submitted PRs and funding verification — October 31

The user confirmed checkout approval and explicitly authorized **up to 6 Copilot Auto review requests**, including retries, for this competing-PR scenario. No previous evaluation allowance is reused.

| PR | Actual GitHub author | Exact head | Observation |
| --- | --- | --- | --- |
| [#5](https://github.com/deepakA18/repopay-demo-http/pull/5) | Me-cha | `7d05bba11b1cd6c39bb46bbd4ade149cb18a9d25` | Open/unmerged; description includes `Fixes #4`; implementation and five added regression tests |
| [#6](https://github.com/deepakA18/repopay-demo-http/pull/6) | Mecha-Test-Account | `73a4eb89d7a7f0db3ad9b7ccc1f4381b78ab9b67` | Open/unmerged; description says `Fixed the issue #4`, which does not match automatic closing-reference parsing; production implementation only, no new regression tests |

Both heads have completed successful external GitHub Actions `test` Check Runs. An independent isolated Node harness ran the same five acceptance cases against each exact-head serializer: **10/10 passed**. This does not replace missing committed tests in PR #6, Copilot assessment, or payment acceptance.

The initial `/bounty link #6` command was rejected as unavailable: the actual parser expects `/bounty link 6`. A corrected [manual link command](https://github.com/deepakA18/repopay-demo-http/issues/4#issuecomment-6541872054) was posted. README syntax corrected to match the implementation; no parser or financial behavior changed.

Funding remains the blocker: a direct read through the sandbox Orders adapter returned order `8MC07017K60287144` as **PAYER_ACTION_REQUIRED**, amount 100 cents USD, with no captures. Repopay funding attempt 2 remained CREATED and bounty 3 OPEN. The user was asked to continue the existing checkout at `/bounties/3/funding/2`; no replacement order or forced database transition was created. Copilot usage for these PRs at this observation: **0 of 6 approved requests**. Neither PR was merged and no new award/payout was initiated.

The corrected manual link was processed: submission 2 is PR #5 / Me-cha, submission 3 is PR #6 / Mecha-Test-Account, both OPEN on bounty 3. Thus two distinct contributor links are now persisted concurrently, but the **funded + reviewed** competing-PR acceptance remains pending checkout/capture.


### Funded competing-PR acceptance — PASS (October 31)

After the user completed the existing sandbox checkout, funding attempt 2 reached COMPLETED: order `8MC07017K60287144`, capture `2U039566RG2576232`, 100 cents USD. Bounty 3 is FUNDED. No replacement checkout was created.

Both pre-funding submissions were retained and automatically reviewed after capture:

| Submission / PR | Author | Verification | Published Check Run | Result |
| --- | --- | --- | --- | --- |
| 2 / [#5](https://github.com/deepakA18/repopay-demo-http/pull/5) | Me-cha | 12, DONE | 124505964176, completed/neutral | RESOLVES; coverage 100%, confidence 97%; exact head `7d05bba11b1cd6c39bb46bbd4ade149cb18a9d25` |
| 3 / [#6](https://github.com/deepakA18/repopay-demo-http/pull/6) | Mecha-Test-Account | 13, DONE | 124506039840, completed/neutral | PARTIAL; coverage 83%, confidence 98%; exact head `73a4eb89d7a7f0db3ad9b7ccc1f4381b78ab9b67` |

Both external GitHub Actions checks passed at those exact heads. PR #6's model reasoning correctly retained the missing committed regression-test requirement despite its production implementation passing the independent harness. Advisory neutral Check Run conclusions are not payment approvals.

Persisted SDK usage reports one user request for each review: **2 of 6 approved requests consumed**, no retries needed. Both PRs were re-read from GitHub and remain OPEN/unmerged at the same heads. The database has **zero awards for bounty 3**, so no associated payout exists. The historical $50 bounty remains PAID.

This completes the narrow live case: two distinct eligible contributors linked and reviewed concurrently on one funded issue, with pre-funding submissions reviewed on capture and no exclusive reservation/pre-merge award. It does not complete Phase 5's same-revision ERROR recovery, sponsor expiry/refresh, organization sponsorship, every other unchecked acceptance case, or two-author splitting. Keep both PRs unmerged for the next explicitly selected walkthrough.

### Same-revision recovery — failure step verified (October 31)

The user disconnected the repository sponsor through Repopay and requested one authenticated retry for submission 2 / PR #5. The saved sponsor is revoked locally. Verification 14, attempt 2, finished ERROR / VERIFIER_UNAVAILABLE at unchanged head `7d05bba11b1cd6c39bb46bbd4ade149cb18a9d25`. GitHub Check Run 124506973532 is completed/neutral and explicitly reports no model verdict; external CI remains pass. Original successful verification 12 remains preserved. The sponsor check fails before the model call; no SDK usage was recorded for attempt 2, so the walkthrough still has 2 of 6 approved model requests consumed.

GitHub confirms PR #5 remains open/unmerged at that head. Bounty 3 remains FUNDED, zero awards, no queued/running jobs. Reconnection and a single authenticated retry on the same revision are next; successful recovery is **not yet evidenced**. The next attempt is the third allowed attempt on this revision; do not click retry repeatedly or alter/reset attempt history.


### Same-revision recovery — PASS (October 31)

After sponsor reconnection and one authenticated retry, verification **15**, attempt **3**, completed DONE / RESOLVES on the identical PR #5 head `7d05bba11b1cd6c39bb46bbd4ade149cb18a9d25`. Published GitHub Check Run **124507512968** is completed/neutral, coverage 100%, confidence 99%, exact-revision CI pass. The original success (12) and disconnected-sponsor failure (14, ERROR / VERIFIER_UNAVAILABLE) remain stored separately. No commit change, history reset, attempt-limit override or fallback to the older success was used.

Sponsor `deepakA18` is reconnected with Auto. SDK usage records one request for the recovered review; total for the authorized walkthrough is **3 of 6 model requests**. The disconnected-sponsor attempt made no model call but consumed a revision attempt. PR #5 now has all three normal attempts used; do not request another retry on this revision without separately resolving that limit.

GitHub confirms PR #5 remains OPEN/unmerged at the same head. Bounty 3 remains FUNDED with zero awards; the queue has no queued/running jobs at observation. This satisfies the live authenticated same-revision ERROR-to-success recovery case, not all remaining Phase 5 gates. No new capture, merge, award or payout was performed.

### Delayed-claim preparation — tests still missing (October 31)

PR #6 advanced to `bf13e012c4be0378c1b9a0caacf875e1512bf777`, still OPEN/unmerged. Its new diff reformats the five existing scalar/JSON tests but adds no array regression cases. External CI passes. Verification 16 (while CI pending) and verification 17 (after CI pass) both completed PARTIAL, each with one SDK user request. Latest published Check Run: 124510583288. Total walkthrough model usage is **5 of 6 approved requests**. An extension of up to 3 additional requests was requested, not yet approved at this observation.

Mecha-Test-Account has no saved payout connection (existence checked without reading an address). Bounty 3 has no award. Keep the connection absent and PR unmerged. Settlement scope has not been changed. Before delayed-claim activation, append actual regression cases below to `demo-test/serializers.test.cjs` on PR #6's branch, retaining all current tests. These use the existing `test`, `assert` and `FormEncoded` imports. Run `node --test demo-test/serializers.test.cjs`; there should be ten tests, not five. Commit and push only after the bounded review allowance is settled.

```javascript
test('form arrays produce repeated pairs', () => {
  assert.equal(new FormEncoded().encode({body: {tag: ['red', 'blue']}}),
    'tag=red&tag=blue');
});
test('form arrays escape names and elements', () => {
  assert.equal(new FormEncoded().encode({body: {'a&b': ['x=y', 'hello world', 'café']}}),
    'a%26b=x%3Dy&a%26b=hello%20world&a%26b=caf%C3%A9');
});
test('form empty arrays emit no pairs and mixed fields retain order', () => {
  assert.equal(new FormEncoded().encode({body: {before: 'one', empty: [], tag: ['red', 'blue'], after: 'two'}}),
    'before=one&tag=red&tag=blue&after=two');
});
test('form arrays retain empty strings', () => {
  assert.equal(new FormEncoded().encode({body: {tag: ['', 'x']}}), 'tag=&tag=x');
});
test('form encoding does not mutate array inputs', () => {
  const tags = Object.freeze(['red', 'blue']);
  const body = Object.freeze({tag: tags});
  assert.equal(new FormEncoded().encode({body}), 'tag=red&tag=blue');
  assert.deepEqual(body, {tag: ['red', 'blue']});
});
```

### Corrected PR #6 tests verified (October 31)

PR #6 now has head `5712b64b2075eb5a4fc0c833d03543274001ca95`, OPEN/unmerged. The actual `demo-test/serializers.test.cjs` diff includes all five new array regression cases alongside the five existing tests. External GitHub Actions Check Run 124515505305 completed successfully on that exact head. Latest verification 21 is DONE / RESOLVES, published as completed/neutral Check Run 124515570268: coverage 100%, confidence 98%, CI pass. Earlier verification 20 on this head was PARTIAL and remains preserved.

The user approved three additional model requests (nine total). Verifications 18/19 on the previous whitespace-only revision and 20/21 on this corrected revision each recorded one SDK request. Total for this walkthrough is now **9 of 9 approved requests consumed** (verification 14's disconnected-sponsor failure made no model call). No additional retry, push-triggered review or merge-evidence refresh is authorized within that exhausted allowance. Before continuing the delayed-claim merge, obtain a bounded extension and prepare the exact bounty-3 settlement scope; neither scope activation nor merge was performed by this check. Keep the recipient unconnected until AWAITING_CLAIM is observed.

### Delayed-claim merge preparation — conflict identified (October 31)

GitHub reports PR #6 OPEN/unmerged but mergeable=false / dirty at head `5712b64b2075eb5a4fc0c833d03543274001ca95` against main `ae4e27bb7808336b0f351d3a06f832e7129c16db`. PR #5 also remains open/unmerged. Recipient 350676467 still has no saved payout connection; bounty 3 is FUNDED with zero awards.

Prepared (not activated) settlement scope: bountyId `3`, repoId `1435468752`, amountCents `100`, termsHash `f75eeea40846abb95c0e4090ab1d09844a86b1172cefb6b4c46296c8447eb104`. The existing scope/environment was not changed. A further allowance of up to three model requests (12 total) was requested; approval remains pending at this observation.

An isolated clone and `git merge-tree` found the sole conflict in `demo-test/serializers.test.cjs`. Rehearsed merging origin/main into the PR branch and retaining the PR branch's file (`--ours` with the PR branch checked out). That file contains all five original tests and all five array tests; Node 22 reports **10/10 passing** after the merge resolution. No commit or remote push was made. The contributor should perform that resolution on their PR branch only after the request allowance is approved; this integrates main into the branch, not the PR into main. Keep both PRs unmerged until the refreshed review and exact settlement scope are ready.

### Conflict resolved; verifier context gap identified (October 31)

PR #6 is OPEN/unmerged and mergeable=true / clean at `a7cd3a799e905d2678ca86cf178f8f41d497a7be`, against main `9266efe5eaef405a30cf10997e495bf4023d8e06`. Exact-head external CI passes. Direct inspection of the actual head test file confirms all ten tests, including all five array cases, are present.

Verifications 27 and 28 each used one model request and returned PARTIAL. Latest Check Run 124520459776 says several required tests are not shown. Those tests are now also on main, so the PR's GitHub patch omits their unchanged middle section. `verifier/collect.ts` currently supplies file patches as the diff; the full test file is not supplied as context. This is an evidence-context limitation, not proof that the contributor omitted tests. Do not ask for duplicate tests or artificial whitespace changes to influence the diff, and do not manually replace the verdict with RESOLVES.

The approved extension is 12 total model requests; current recorded usage is **11 of 12**. No retry initiated by this check. Settlement remains unactivated for bounty 3; do not merge or connect the recipient yet. Next work is bounded exact-revision test-context support (or an explicitly accepted existing manual-review path), with local regression coverage before spending the remaining request. Delayed-claim acceptance is still pending.

### Exact-revision context fixed; live review PASS (October 31)

Implemented [ADR 0014](../decisions/0014-exact-revision-test-context.md): bounded full contents of changed test files are fetched using the installation token at the exact PR head, checked against their Git blob hashes, and included as explicitly labeled context alongside the patch. Missing, oversized or invalid context fails closed; the collector rechecks the revision after fetching. Historical verdicts remain preserved.

Local validation: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` passed (350 server tests across 67 files; 4 web tests across 2 files). New regression coverage reproduced the omitted unchanged-test problem before the fix and covers unavailable/bounded context, revision movement and invalid provider content. Build retains the existing large frontend chunk warning.

The real installation can read the exact-head test file (2,459 bytes). Collection produced sufficient, non-truncated evidence with passing CI and snapshot hash `93a47f39b346756016c20e5b9048e8afa93fa53ac3567c87599950161751b1f0`. One normal application-verifier call created verification **29**, DONE / **RESOLVES**, on unchanged head `a7cd3a799e905d2678ca86cf178f8f41d497a7be`. GitHub Check Run **124524057517** is completed/neutral, coverage 100%, confidence 97%, CI pass. No attempt override or history reset was used. This focused live regression is not a repeat of the full semantic evaluation.

Walkthrough usage is now **12 of 12 authorized Copilot requests**. Bounty 3 remains FUNDED with zero awards; Mecha-Test-Account still has no payout connection. No merge or settlement-scope activation occurred. Delayed claim remains pending. The current head has exhausted its three normal attempts; before post-merge refresh, obtain an explicit bounded request allowance and any required one-off attempt-limit exception. Keep PR #6 unmerged and the recipient unconnected until that preparation is complete.

### Delayed-claim review extension approved (October 31)

User approved up to two additional Auto requests (14 total; 12 used, two remaining) and a one-off PR #6 revision-attempt limit of five instead of three. Apply only to the explicit submission-3 post-merge invocation; do not change the normal environment limit or erase attempts. No additional model request has been run at this checkpoint.

Fresh GitHub read: PR #6 remains OPEN/unmerged, mergeable/clean, author Mecha-Test-Account, head `a7cd3a799e905d2678ca86cf178f8f41d497a7be`, base `9266efe5eaef405a30cf10997e495bf4023d8e06`. Database confirms bounty 3 FUNDED for 100 cents, zero awards and recipient connection absent. Verification 29 remains the latest completed third attempt. The exact prepared scope remains bounty 3 / repo 1435468752 / 100 cents / terms hash `f75eeea40846abb95c0e4090ab1d09844a86b1172cefb6b4c46296c8447eb104`. No persistent scope activation, merge, award or payment occurred at this checkpoint.

Next participant step: repository owner merges PR #6 using Create a merge commit, leaves PR #5 unmerged, and keeps Mecha-Test-Account unconnected. Then refresh merged evidence under the approved bounded invocation and apply the isolated scope through normal settlement guards to observe AWAITING_CLAIM.

### Delayed-claim award observed (October 31)

User merged PR #6 at 2026-10-31T11:30:43Z, merge SHA `4344c7e16fb1e3a6fc8ecd014498874735c2bcf1`, unchanged head `a7cd3a799e905d2678ca86cf178f8f41d497a7be`. PR #5 remains OPEN/unmerged.

The two authorized invocations each used one Auto request with process-local revision-attempt limit five. Verification 30 (attempt 4) returned RESOLVES against the still-saved pre-merge submission context. Candidate reconciliation then recorded MERGED and evidence version 16; settlement correctly held for current evidence rather than awarding from that older context. Verification 31 (attempt 5, Check Run 124525812057) returned DONE / RESOLVES for the reconciled evidence. All **14/14 approved requests are now used**; no normal configured limit or history was changed.

Normal `createPhase6(...).settleBounty('3')` with the exact prepared scope in that invocation committed **award 2**, submission 3, verification 31, **100 cents**. Fresh database reads confirm bounty 3 **AWAITING_CLAIM**, exactly one award, **zero payout batches**, and recipient 350676467 has no saved connection. Bounty 1 remains PAID. No direct financial-state SQL updates or forced verdicts were used; persistent environment scope remains unchanged.

This passes the award-before-connection step. Have Mecha-Test-Account authenticate at `/connect` and save their sandbox Personal-account email. Then verify the same award resumes, exactly one batch/item is created, provider completion and recipient receipt. These remaining steps are not yet passed.

### Delayed claim resumed to PAID — October 31

Database inspection confirms Mecha-Test-Account (350676467) connected at version 1. Original award **2**, submission 3, remains **100 cents**. Exactly one batch **2** / provider `XCKBDAE9R9JQJ` and one item **2** / provider `GVHRMZVAW47BA` exist for that award. The worker recorded item **SUCCESS** and bounty 3 **PAID**, with no attention flag. No new award, checkout or manual replacement payout was created by this check. This verifies saved provider-observation state; recipient Activity confirmation remains pending. The earlier deepakA18 connection did not resume this recipient's award. No additional Copilot request was used.

October 31 recipient confirmation: user confirmed Mecha-Test-Account received the $1 in sandbox Activity. Delayed-claim acceptance now passes: award 2 existed before connection, resumed with one batch/item, recorded SUCCESS/PAID, and recipient receipt confirmed. Two-author allocation and other broader Phase 6 checks remain open.
