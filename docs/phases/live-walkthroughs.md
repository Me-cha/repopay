# Foundation MVP checklist and deferred walkthroughs

## Active foundation MVP checklist

User scope decision: validate the basics now; defer the broader matrix below. Automatic payout after a qualifying merge remains required. See [ADR 0021](../decisions/0021-foundation-mvp-scope.md). Unchecked historical scenarios below are backlog, not additional foundation release gates. Financial/identity safeguards remain mandatory.

- [x] Create a bounty and receive bot status/labels: hosted issue #10, then funded issue #11.
- [x] Sign in and connect the owner Copilot Auto sponsor: hosted evidence recorded.
- [x] Fund an issue through PayPal sandbox and show FUNDED: issue #11 / hosted bounty 2 (application confirmation recorded).
- [x] Link a PR, publish Copilot feedback and request a review on the PR: #12 RESOLVES, PR-native retry acknowledged.
- [x] Maintainer feedback/rejection before merge: live PR #9 rejection retained; no merge needed to reject.
- [x] Connect a recipient and deliver a sandbox award: historical $50 and $1 receipt-confirmed flows; reuse this evidence.
- [x] Basic funding/connection/dashboard browser journeys: six local Chromium cases passed on October 31; providers mocked.
- [x] Deploy the foundation-scoped release and finish a hosted qualifying-merge → automatic payout → recipient receipt/status flow. November 9: issue #14 / correction PR #16 on `deepakA18/gitpay-demo-http`, hosted bounty 3, four authorized Copilot calls through Render, one $1 payout SUCCESS, PAID in both account views/GitHub and user-confirmed recipient receipt. [Evidence and limitations](../evidence/render-workflows-implementation.md#hosted-user-journey--november-9-follow-up). Historical PR #12 was not reused.

- [x] Hosted qualifying-merge → automatic payout → recipient receipt/status flow: PR #12 merged; one $1 award, one batch, two $0.50 SUCCESS items, hosted PAID, `bounty-paid`, both receipts confirmed November 2. See [evidence](../evidence/11-hosted.md#hosted-payout-and-both-receipts--passed-november-2).

November 2 retest: the new Repopay frontend shell/assets and health respond successfully; signed-out API access is denied. The false funding hold was reconciled with provider evidence, and the scoped hosted worker has now created the automatic award. Authenticated visual UI inspection and independent deployed commit verification remain pending. See [current hosted retest evidence](../evidence/11-hosted.md#foundation-retest--november-2-2026).

- [x] November 2: reconcile the rebrand-induced funding hold on hosted bounty 2 after exact PayPal order/capture verification and explicit user approval. Original $1 capture/terms preserved; audit 11, projection job 365 completed, bot hold removed, zero awards and no new financial POST.
- [x] November 2: current-profile PR #12 review 28 returned RESOLVES with both confirmed contributors, sufficient evidence and passing exact-head CI; bot publication verified. One of two newly approved Auto requests consumed; one reserved for post-merge refresh. Normal hosted attempt limits unchanged.
- [x] Resolve hosted recipient connections: subsequent database readback confirms saved connections for both reviewed GitHub identities, Me-cha and Mecha-Test-Account. PayPal ownership/delivery are not established by connection alone.
- [x] Hosted PR #12 merge and post-merge review: merge identity verified; review 30 RESOLVES. Both approved Auto requests consumed; normal hosted caps unchanged.
- [x] Hosted automatic award: exactly one award, 100 cents split 50/50 between the two verified contributors; one payout batch submitted by the hosted worker.
- [x] Both hosted payout items reached provider SUCCESS; application PAID and GitHub `bounty-paid` verified; user confirmed both $0.50 receipts.

Do not run another full model-evaluation campaign for this foundation milestone. No further inference allowance is implied. Two-author edge cases, organizations, funded refunds, exhaustive recovery/restore and recording remain deferred; existing committed funds/claims must still be preserved.




October 31 latest: delayed-claim award 2 resumed after Mecha-Test-Account connected. Bounty 3 is PAID; one $1 payout batch/item is recorded with provider SUCCESS. Recipient receipt was confirmed by the user; delayed-claim walkthrough passed. All 14 approved model requests are used.

Updated October 31, 2026.

## Execution decision

The user directed finishing local implementation and verification first, then running the remaining live walkthroughs together after all phases are implemented. The user subsequently authorized the bounded Phase 5/6 validation session on issue #4 / bounty 3. The user extended its allowance to 14 total requests (14 used), with a scoped PR #6 revision-attempt exception from 3 to 5. The Phase 7 $1 sandbox setup was subsequently authorized and funded. The user now requests all remaining work except the real 72-hour refund walkthrough; bounded model allowances and deployment resource approval still apply. Existing committed payment reconciliation remains intact.

This is a scheduling deferral, not a waiver or a passing result. Keep each phase's local verification separate from its live acceptance. Add newly discovered cases here as later phases are implemented. Numbered phase files remain authoritative for the full acceptance requirements, including unresolved local checks. Do not reinterpret every unchecked item as live-only.

October 31: the resumed competing-PR case passed on issue #4 / bounty 3: $1 capture COMPLETED, PR #5 RESOLVES, PR #6 PARTIAL, both linked/open, no award. Used 2 of 6 approved Auto requests. See [observed evidence](../evidence/05-demo-walkthrough.md#funded-competing-pr-acceptance--pass-october-31). Other deferred scenarios are not activated by this result.

## Phase 5 — PR review

Already evidenced: Auto v2 evaluation 18/18, real exact-revision Check Runs, new-code review, owner authorization revocation/session invalidation, blocked review while revoked, and successful review on a new revision after reconnection. See [Phase 5 evidence](../evidence/05-summary.md).

- [x] Two distinct eligible contributors submit competing PRs on one funded issue; both are linked and reviewed. October 31: Me-cha PR #5 and Mecha-Test-Account PR #6 on funded bounty 3; RESOLVES/PARTIAL published at exact heads, both OPEN, zero awards. Creator excluded.
- [x] A failed review recovers through the authenticated retry flow on the **same revision**, with preserved failure history. October 31: PR #5 verification 14 ERROR / VERIFIER_UNAVAILABLE → verification 15 DONE / RESOLVES at unchanged head after sponsor reconnect. Prior success/failure retained, no limit override; cumulative usage 3 of 6 approved model requests.
- [x] Regression: unchanged required tests omitted from the PR patch are included as bounded exact-revision context; local negative tests and live verification 29 passed. Historical PARTIAL reviews retained.
- [ ] Live sponsor expiry/refresh and remaining App-access-loss/recovery cases. Real owner revocation has already passed and need not be repeated unnecessarily.
- [ ] Audit the remaining [Phase 5](05.md) acceptance items against their exact tests/evidence, including CI updates without a push and duplicate events. Retain local gaps as implementation work.
- [ ] Organization sponsorship remains explicitly blocked pending an eligible organization and an implemented/verified flow; scheduling it later does not supply either prerequisite.

## Phase 6 — awards and payouts

Already evidenced: merged PR #3 → one $50 award → one sandbox batch/item → PayPal SUCCESS → Repopay PAID → user-confirmed recipient receipt. Do not repeat or alter that completed payment. See [Phase 6 evidence](../evidence/06-summary.md).

- [x] Delayed claim: complete the following steps for issue #4 / bounty 3 and PR #6. Preparation does not establish an award or payout.
  - [x] Capture the separate $1 sandbox funding; bounty 3 is FUNDED.
  - [x] Verify eligible contributor Mecha-Test-Account has no saved payout connection.
  - [x] Verify corrected tests and passing exact-head CI; resolve merge conflict.
  - [x] Fix omitted unchanged-test context and obtain live RESOLVES on the current revision. Verification 29 / Check Run 124524057517; [evidence](../evidence/05-demo-walkthrough.md#exact-revision-context-fixed-live-review-pass-october-31).
  - [x] Prepare the exact bounty-3 settlement scope without activating it.
  - [x] Obtain additional bounded review allowance and the required one-off revision-attempt exception before post-merge review. User approved 2 additional requests (14 total, 12 used) and PR #6 only: revision-attempt limit 3 → 5 in the one-off invocation; normal configured limits remain unchanged.
  - [x] Activate the reviewed isolated scope, merge the qualifying PR and verify one committed award in AWAITING_CLAIM with no payout sent. October 31: scope applied only in the settlement invocation, award 2 for 100 cents, verification 31; zero payout batches, recipient unconnected. Normal environment unchanged.
  - [x] Connect the recipient and verify the same award resumes with one payout intent. Mecha-Test-Account connection version 1; original award 2, batch 2, item 2, 100 cents.
  - [x] Confirm recorded provider SUCCESS and Repopay PAID; batch `XCKBDAE9R9JQJ`, item `GVHRMZVAW47BA`, same award 2, one batch/item.
  - [x] Confirm recipient sees the incoming $1 in their sandbox Personal-account Activity. User confirmed receipt October 31.
- [x] Two-author allocation with both recipients connected: real PR #12, GitHub-associated commits and exact-revision declarations/maintainer confirmation, current foundation profile, one 100-cent award split 50/50, both provider SUCCESS outcomes and receipts confirmed November 2. See [hosted evidence](../evidence/11-hosted.md#hosted-payout-and-both-receipts--passed-november-2).
- [ ] Two-author mixed connection timing (one recipient awaiting claim while the other is connected): deferred. The separate single-author delayed-claim test and connected two-author test do not establish this combined case.
- [ ] Reconcile broader [Phase 6](06.md) merge/squash/rebase, replay and provider-recovery expectations with recorded coverage; distinguish simulated faults from real provider observations.

## Phase 7 — maintainer decisions

- [x] Live-check corrected pre-merge rejection (ADR 0015). PR #9 remains OPEN/unmerged; decision 2 has null merge SHA, history retained, bounty 4 FUNDED, zero awards. App PR-write permission approved; acknowledgement recovered with original job marker: [bot reply](https://github.com/deepakA18/repopay-demo-http/pull/9#issuecomment-6543538264).


October 31: user authorized one new $1 sandbox bounty, two contributor PRs and up to 6 Auto requests (all 6 used after PR #9 revision/metadata reviews). Issue #7 created with explicit nullish-value criteria; PR #8 merged and reached NEEDS_REVIEW; historical rejection and corrected pre-merge rejection passed; later approval remains pending.

Local verification: 47 files / 273 tests, typecheck, lint and build passed; migration 0013 applied. See [Phase 7 evidence](../evidence/07-summary.md).

- [ ] Separate sandbox bounty with a partial merged solution reaches NEEDS_REVIEW; inspect revision, CI, full amount and recipients, supply a reason, confirm and verify one award/payment.
- [x] Reject the first partial candidate through the authenticated browser; verify attributed reason and preserved evidence. October 31: decision 1 rejects submission 4 / PR #8, actor deepakA18, verification 34 retained; bounty 4 returns to FUNDED, zero awards.
- [ ] Verify the next merged candidate is considered in stable order after that rejection. PR #9 remains unmerged while the user-requested pre-merge workflow correction is verified.
- [ ] Show stale confirmation rejection after evidence changes, loss of permission, and a duplicate action without a second award.
- [ ] Exercise issue/PR command routing and ambiguous PR links with explicit issue numbers in the browser/GitHub flow.

## Phase 8 — exceptional cancellation and refunds

**Current user direction:** defer the real 72-hour refund walkthrough. Other independently executable work remains authorized; do not mark the deferred refund path passed.

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

## Phase 10 — recovery and release hardening

Local results and fault boundaries: [Phase 10 evidence](../evidence/10-summary.md). Discovery is implemented but default-off.

- [ ] Explicitly enable isolated discovery for the final session with a bounded sponsor allowance; verify real missed PR events and restored App access.
- [ ] Restart during an approved sandbox operation; verify saved provider identity, held unknown outcomes and no second financial allocation.
- [ ] Verify delayed/returned payout and refund reads after App removal, credential restoration and worker restart, without new replacement operations.
- [ ] Run an approved fresh Auto evaluation and reconcile all W01–W16 evidence. Existing Phase 5 evaluation is historical, not a new run.
- [ ] Rehearse hosted backup/restore with workers isolated and provider reconciliation before reactivation; complete hosting-specific rate/load/access controls in Phase 11.

## Phase 11 — hosted validation

Local preparation: [Phase 11 summary](../evidence/11-summary.md). The user deployed https://repopay.onrender.com/; public web health and database/schema readiness were verified October 31. Remaining hosted checks are below.

- [ ] Approve actual Render pricing/region/resources, configure shared secrets and stable HTTPS origin, and validate the account-specific Blueprint.
- [ ] Deploy one reviewed commit with the web-owned migration step and both services held; verify schema health and SDK runtime readiness.
- [ ] Configure hosted callback/webhooks, run read-only preflight, then explicitly authorize activation and bounded live tests.
- [ ] Complete the role, restart, access-loss and missing-intent restore evidence in [11-hosted.md](../evidence/11-hosted.md).

## Phase 12 — final acceptance

Handoff materials are prepared locally; final acceptance and recording remain pending.

| Phase | Final-session work | Setup/dependency |
| --- | --- | --- |
| [12](12.md) | Complete evidence matrix, reproduce setup/demo, verify negative paths and obtain final acceptance. | Resolve or explicitly document all remaining blockers. |

Before the final session, consolidate accounts, eligible roles, sandbox balances, recipient connections, supported attribution, scopes, callback/webhook URLs, hosting and bounded Copilot request allowances. Record issue/PR/award/batch/item IDs and outcomes without credentials, tokens or recipient emails. Earlier Phase 2–3 deferred items must also be reconciled from their own evidence before final MVP claims.

## Final-session order

1. Eligible contributor accounts are available. Resolve an independent cancellation operator when refund testing resumes, and implement/verify revision-bound co-author attribution. Organization sponsorship remains separately blocked. More time alone does not solve these implementation/account gaps.
2. Review the [acceptance matrix](../evidence/12-acceptance.md), agree fresh issue IDs, exact sandbox amounts, scopes, hosting costs and bounded model allowance. Preserve the completed $50 award. Reconcile Phase 2 collaborator revocation and Phase 3 abandoned checkout/restart/receipt cases.
3. When explicitly authorized, configure and validate held hosting before activation. Complete the hosted preflight/restore checklist. The [demo seeder](../demo.md) prepares ordinary issues only; its real execution/rerun and Postman GUI import remain manual checks.
4. Deferred by current user direction: begin the genuine cancellation case only when resumed: new v5 funding, independent reviewer and confirmed public notice. Wait the full real 72 hours; run the other approved scenarios during this period. Never shorten funded terms or modify timestamps to finish a recording.
5. Complete competing PR/retry/CI, delayed claim, supported split and manual review/rejection scenarios; inspect recipient receipts and immutable identities. Demonstrate valid-work cancellation protection and actual-role dashboard access.
6. Finish genuine refund and provider recovery/hosted restore evidence. Record safe issue/PR/award/provider identifiers and observed outcomes in the matrix; retain pending results as pending.
7. Record the <=3-minute outline and separate genuine-refund evidence. Review privacy and claims; verify official event rules before any submission; request final user acceptance. This checklist does not itself authorize live operations or publication.

October 31 source-context correction: ADR 0016 / prompt v3 is locally verified; read-only PR #9 evidence contains scalar source and tests. A subsequently authorized seventh request produced RESOLVES on the same PR #9 revision. Phase 7 allowance is exhausted (7/7); full v3 evaluation and profile acceptance remain pending. Historical v2 acceptance does not authorize v3 awards.

- [x] Correct false-PARTIAL source-context regression and verify same-revision live result: PR #9 verification 38 RESOLVES / CI pass with prompt v3, Check Run 124546610761. Phase 7 allowance now 7/7 used. Full v3 evaluation/profile acceptance remains pending; PR unmerged, no award.

October 31 update: the full Auto v3 evaluation completed and **failed (17/18)**. Current v3 awards remain disabled by evaluated-profile binding. See [evaluation result](../evidence/05-auto-v3-result.md). Two-party revision-bound attribution is implemented locally; its two-recipient live payout is still pending. The real 72-hour refund test remains deferred.

- [x] Implement authenticated additional-contributor declaration plus separate maintainer confirmation, head/base binding, stale-proof evidence integration and award fencing (ADR 0017).
- [x] Run the approved 18-request v3 evaluation and preserve the failed 17/18 result.
- [x] Diagnose v3 false PARTIAL, correct incomplete fixtures and obtain a passing 18/18 evaluation before user-authorized scoped v3 acceptance.
- [x] Perform the two-confirmation flow with real accounts and verify two-recipient payout receipts: hosted PR #12, November 2, $0.50 each received.

- [x] Hosted web health and homepage: https://repopay.onrender.com/ returned Repopay; `/healthz` returned HTTP 200 / ready on October 31. Worker, hold and provider readiness remain unverified.

- [x] Hosted GitHub callback and deepakA18 browser sign-in confirmed. User-supplied record counts were zero; user selected fresh demo issues rather than restoring local financial history.

- [x] Hosted fresh draft intake and inline processing: demo issue #10, `$1.00 USD · OPEN`, `bounty-open`, bot links to hosted bounty 1 (October 31). No funding/payment acceptance claimed.

- [x] Hosted `/bounty status` produces a new reply: issue #10, comment 6545780123, OPEN / unfunded, October 31.
- [x] Hosted authenticated unfunded cancellation: issue #10 shows CANCELLED in the user's status screenshot and canonical GitHub bot comment; `bounty-open` removed, issue remains open, historical replies retained. Zero committed/delivered amounts; no payment or refund sent. See [hosted evidence](../evidence/11-hosted.md).

- [x] Hosted dashboard cancelled-draft display and refresh: user confirmed issue #10 looked correct at `/dashboard/?tab=bounties` after checking CANCELLED, zero awarded/delivered and retained history. User-observed acceptance; not an independent browser inspection.

- [x] Run the separately approved three-request v3 diagnostic and retain reasoning: two RESOLVES, one PARTIAL explicitly citing missing `isValid` implementation. See [diagnostic evidence](../evidence/05-auto-v3-result.md). Allowance 3/3 used. Fixture correction and full profile acceptance remain open.

- [x] Replace ambiguous evaluation fixtures with explicit requirements and complete source context; locally establish full-fix behavior and partial-fix counterexamples.
- [x] Run newly authorized corrected-fixture evaluation: 18/18 passed, reviewed and accepted by the user for scoped sandbox demos only.

- [x] Hosted signed-out access boundary (October 31): `/dashboard/` and `/bounties/1` returned 303 to `/login`; `/api/bounties/1` returned 401; none exposed the demo repository name or cancelled bounty state. `/healthz` remained 200. This does not establish private-repository cross-account isolation, token expiry or permission-revocation behavior.

- [x] Hosted owner sponsor consent: user screenshot confirms connected sponsor deepakA18 for deepakA18/repopay-demo-http, Auto selected, profile checked 2026-10-31T16:32:25.266Z. Callback mismatch was resolved. This verifies consent/profile display, not a hosted model request; six-request walkthrough allowance remains unused by this step.

- [x] Hosted bounty 2 / issue #11 funding projection: read-only GitHub verification of comment 6546042262 reports USD 1.00 FUNDED / confirmed funding. This is application bot evidence, not independent PayPal capture inspection. No new PR linked to #11 was visible at this check. Bot displays an empty required-CI list; inspect frozen CI configuration before any merge/award acceptance.

- [ ] Deploy and verify ADR 0018 PR declaration/maintainer confirmation on the final PR #12 revision; verify issue/PR bot next-action discovery, stale-command rejection and no automatic model/payment effect.

- [x] Hosted PR-native declaration and action discovery: Mecha-Test-Account's declaration on PR #12 was acknowledged as saved; the canonical bot comment shows pending maintainer confirmation and review/status/sponsor links. See [hosted evidence](../evidence/11-hosted.md). Separate maintainer confirmation and the remaining checks above are still pending.

- [x] Hosted separate maintainer confirmation: deepakA18's PR #12 command was acknowledged as saved for the same head/base; canonical bot projection now shows Mecha-Test-Account as maintainer confirmed. Fresh review and payout acceptance remain pending.

- [x] Hosted fresh review after both confirmations: Check Run 124609710405 completed PARTIAL (90% coverage, 88% confidence), CI pass. The separately approved one-review allowance is consumed. This verifies retry execution, not solution/payout acceptance.
- [x] Correct verifier attribution evidence while preserving frozen criteria and historical verdict: v4 Check Run 124615632605 recognizes exact-revision contribution/confirmation proof and returns RESOLVES (100% coverage, 98% confidence), CI pass. The separately approved one-request allowance is consumed; full v4 evaluation and award acceptance remain separate.

- [x] Locally implement and verify PR-native contribution commands plus role-specific issue/PR action discovery (ADR 0018). 379 tests, typecheck, lint and build passed; hosted confirmation/acknowledgement acceptance remains separate.

- [x] Locally correct attribution payload and implement PR retry/status plus signed issue-command unfunded cancellation (ADR 0019). Preserve historical review and frozen criteria; no model requests or money effects during implementation.
- [x] Deploy ADR 0019 and verify PR-native status/retry on PR #12: command 6547201886 received queued acknowledgement 6547203768; Check Run 124615632605 and canonical comment 6546843904 publish RESOLVES. No Repopay page was needed to request or read this review. PR remains open/unmerged. See [hosted evidence](../evidence/11-hosted.md).
- [x] Hosted ADR 0019 status and instruction refresh: PR #12 comment 6547174879 received bot reply 6547176797 (USD 1.00 FUNDED); canonical comment 6546843904 now supplies revision-bound `/bounty retry #11` and PR-native status instructions. Both confirmations remain recorded, head/base unchanged, PR open/unmerged. This verifies deployed behavior; live retry execution and v4 model acceptance remain pending.
- [ ] Evaluate verifier v4, including complete/missing/stale contributor-confirmation evidence, before accepting any new v4 award scope. Historical 18/18 v3 evaluation is not v4 evidence.

- [x] Prepare the nine-case v4 evaluation (27 requests): six baseline cases and complete/missing/stale contributor evidence. No live calls made during preparation.

- [x] Run the separately approved 27-request v4 evaluation and preserve the failed result: 24/27 matched; all three false PARTIAL results cite incorrect JavaScript regex semantics. Missing/stale confirmations and adversarial cases passed. [Evidence](../evidence/05-auto-v4-result.md). Allowance exhausted.
- [ ] Resolve the v4 semantic false-negative failure and obtain separately authorized passing evaluation before any v4 award acceptance; do not repeat requests or enable settlement based on the partial pass.

- [x] Prepare v5 correction for false semantic defect claims: language/flag-aware review guidance, explicit line-ending regression evidence, and a real multiline-bug negative case; preserve failed v4 results and fixtures. Local verification is separate from live effectiveness.
- [ ] Run a separately approved v5 evaluation (ten cases × three runs = 30 requests), inspect all results, and obtain scoped acceptance before v5 awards. No new allowance is implied.

November 10 crypto extension: optional sandbox funding passed local verification; actual crypto checkout and its end-to-end USD PayPal payout remain unverified. Hyperwallet and wallet payouts are excluded from scope. Track [crypto extension](../crypto-payments.md); do not mark these provider gates complete from mocked tests.

## Direct PYUSD on Solana devnet — November 10

Separate from the completed USD foundation and the optional PayPal crypto-to-USD test. [Implementation evidence](../evidence/pyusd-devnet.md) and [setup](../crypto-payments.md). No live chain/model allowance or hosted activation is implied.

Latest verified result: **bounty 9 / issue 21 is PAID**. PR23 merged at `af57c33700a1497ea83bf12f7f47419c7d83872e`; exact-head v6 postmerge review returned RESOLVES / 100% confidence. Award 3 assigns all 1.00 devnet PYUSD to 0xdeepak18. One outgoing transfer finalized at slot 520807943; the recipient confirmed receipt. GitHub shows `bounty-paid`, and the winning PR has a PAID award comment. This is local self-controlled devnet evidence; mainnet, refunds and hosted chain acceptance remain outside this result.

- [x] Local signed ownership, account/session/CSRF, cross-provider reservation, exact receipt, qualifying award, delayed claim, immutable split and refund/recovery checks with mocked providers.
- [x] Save maintainer's actual devnet wallet through authenticated ownership proof (deepakA18; local database verified).
- [x] Save contributor's actual devnet wallet through ownership proof: 0xdeepak18 (GitHub ID 354933167), Backpack selected in user screenshot; local wallet record verified.
- [ ] Confirm contributor can revisit wallet settings without a new ownership prompt.
- [x] Fund one fresh test bounty with devnet PYUSD; confirm exact finalized receipt (bounty 9 / issue 21, Solflare; [transaction](https://explorer.solana.com/tx/AcCHGo3eAPRWALFJNCUB8jojE9k2iAVu9p76hmGZqwWtjo6auvSGAYngm3j8BEaaC5na3HVc3MjL5Fbm2zqs2F5?cluster=devnet)).
- [x] Exercise authorized qualifying merge and automatic PYUSD delivery; confirm recipient receipt (PR23, award 3, finalized 1 PYUSD to 0xdeepak18; user confirmed receipt).
- [ ] Verify callback/response-loss recovery on devnet.
- [ ] Separately authorized funded-refund walkthrough with original-wallet destination and existing notice/reviewer rules.
- [ ] Protected-key hosted deployment and operational recovery review.

Mainnet and automatic signed/uncertain-transaction replacement remain outside this local release. Unsigned expiry recovery follows ADR 0025; the signed exception is pinned to one explicitly approved historical transfer. Existing reservations/awards must never be deleted to make a test pass.

November 10 recovery follow-up: bounty 9 / issue 21 now has locally verified same-bounty unsigned-expiry recovery (ADR 0025). 478 server tests, 24 web tests and the mocked Chromium signing journey passed. Live Solflare signing/finalized funding subsequently passed as recorded above; no replacement GitHub issue or payout was created.

November 10 PYUSD handoff: v6 accepted only for bounty 9 / issue 21; exact local settlement scope enabled after 514 tests and readiness checks. PR23 is still unmerged; postmerge review, outgoing payout and receipt remain unchecked. Model allowance used: 2/3. See [evidence](../evidence/pyusd-devnet.md#v6-accepted-and-exact-local-scope-enabled--november-10).

November 10 completion: PR23 merged; postmerge review 41 passed RESOLVES; one automatic award and one finalized 1-PYUSD payout reached PAID, with recipient receipt confirmed. Approved model allowance is exhausted at 3/3. See [payout evidence](../evidence/pyusd-devnet.md#qualifying-merge-and-pyusd-payout--passed).
