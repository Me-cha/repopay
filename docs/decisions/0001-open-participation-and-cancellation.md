# ADR 0001: Open participation with exceptional cancellation

Date: 2026-10-26

Status: Accepted for the GitPay implementation plan; not implemented. The 72-hour notice is an initial configurable MVP choice, to be disclosed before funding.

## Context

V3 kept work in GitHub but allowed a maintainer to cancel FUNDED, NEEDS_REVIEW or AWAITING_CLAIM bounties and refund the money. In AWAITING_CLAIM it could void an existing payment decision because a payout had not been sent yet.

That creates a cancel-then-merge attack: a contributor submits a valid solution, the maintainer withdraws the reward, then merges the work. An exclusive contributor reservation would protect one worker but permit bounty hoarding and prevent the open competition the product is meant to support.

## Decision

Keep participation open. No “accept bounty” step, issue assignment, draft PR or comment reserves the reward. The funded terms specify that the first qualifying merged PR wins; order by GitHub merge time and stable PR ID, not worker execution order. Resolve earlier undecided merges before allocating to later ones. Independent competing PRs do not automatically split a single bounty; eligible co-contributors to the winning solution may share its award.

Funding records the amount, original acceptance criteria, selection and cancellation terms. These terms are not rewritten by later edits to the issue. The normal flow remains GitHub draft → PayPal funding → open PR submissions → verification → qualifying merge → payment.

A funded cancellation is an exceptional request:

1. The maintainer supplies a reason and evidence through the GitHub command and authenticated confirmation page. Confirmation requests review, not a refund.
2. The bot posts the reason, evidence links, affected submissions and notice deadline. The initial proposed notice is 72 hours, saved with the funded terms. Funds stay committed and submissions remain open.
3. AI assembles evidence from the original criteria, PR snapshots, CI and the claimed internal/upstream fix. Model uncertainty is not proof that a submission is invalid.
4. An authorized independent operator reviews the exception after notice. The operator must have evidence access and cannot be the requester, funder or claimant. Silence alone does not approve anything.
5. The backend refreshes GitHub/payment state and rechecks versioned evidence, unresolved claims, awards and available funds before reserving a refund. A stale approval cannot release money.
6. Only provider-confirmed refund completion marks the bounty CANCELLED. Provider uncertainty remains reserved and reconciled.

The review request is separate from the bounty lifecycle. It does not stop verification or settlement. New material submissions invalidate an unexecuted approval; a committed award supersedes the request. A reviewer must record reasons when dismissing irrelevant or abusive submissions so an empty PR does not create a permanent veto.

## Exceptional reasons and award protection

An independently completed earlier internal/upstream fix, duplicate bounty or demonstrably invalid issue may qualify, subject to evidence and no unresolved qualifying contribution. A serious project change may be assessed under the same rule. “Changed my mind,” “found someone cheaper” or copying a submitted patch is insufficient.

A qualifying external submission blocks ordinary cancellation while its claim is unresolved, even before merge. This protects the available reward but does not select that PR as the winner. Closing/rejecting/deleting a PR or changing labels does not erase saved evidence. Maintainer rejection for award consideration is not independent dismissal of a cancellation claim.

A committed award is distinct from payment delivery. AWAITING_CLAIM, failed/returned payouts or an unresponsive recipient do not reopen the maintainer's refund option. Save the award once and reconcile delivery attempts separately.

If no independent reviewer is available, funded cancellations stay disabled. If app access is removed or evidence cannot be retrieved, freeze new refund authorization. Pending disputes remain held with a reviewer and next update date, not automatically refunded on timeout.

## Alternatives considered

| Alternative | Why not selected |
| --- | --- |
| Exclusive contributor acceptance | Allows hoarding and excludes competing solutions |
| Cancel until merge | Allows cancelling after a valid submission, then using it |
| Cancel until payout submission | Lets payment setup delays erase an earned award |
| Maintainer supplies any reason and confirms | The interested party still approves their own refund |
| AI alone decides cancellation fairness | Confidence is not proof of independence, authorship or fair treatment |
| Any PR permanently blocks cancellation | Allows empty or abusive submissions to hold funds indefinitely |
| No funded cancellations ever | Simpler fallback, but cannot accommodate genuine exceptions when a reviewer is available |

## Consequences and limitations

The common path stays automated and GitHub-first; rare exceptions require a real service operator. This is an operational commitment and trust assumption. The optional dashboard remains read-only, and reviewer actions use authenticated confirmation pages.

Record evidence, decisions and actors durably. Reconcile webhook gaps and use transaction guards/idempotency to prevent local double spending. GitHub and PayPal do not share an atomic transaction: a last-moment cross-service race still needs recovery, and a completed refund cannot be automatically recovered on discovering new evidence.

The app cannot force a maintainer to merge, prove unseen offline work, prevent copying elsewhere or guarantee that all unlinked/deleted submissions are found. Refusing to accept a valid solution is a separate dispute requiring review. This sandbox design is not a claim of regulated escrow or guaranteed real-money protection.

## Evidence behind the decision

Research checked on October 26, 2026:

- Algora's official repository documents tracking multiple PR claims and a separate automatic-payment-on-merge option. It supports the open-submission pattern, not a guarantee about cancellation fairness. [Bounty guide](https://github.com/algora-io/algora/blob/74a49d7728400152f5d640ac8d461e6664b7c2eb/priv/content/docs/bounties/in-your-own-repos.md), [autopay guide](https://github.com/algora-io/algora/blob/74a49d7728400152f5d640ac8d461e6664b7c2eb/priv/content/docs/workspace/autopay.md).
- Bountysource's historical FAQ describes competing claims and a verification/dispute period. It includes an abandonment warning; it is historical precedent, not current operational guidance. [Historical FAQ](https://github.com/bountysource/core/wiki/Frequently-Asked-Questions).
- GitHub does not automatically redeliver failed webhooks. A missing local event cannot establish that no submission or merge exists. [Failed webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries).
- GitHub App owners can suspend/uninstall an app or change repository access. Losing visibility cannot justify a refund. [App access controls](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps).
- PayPal distinguishes transfer outcomes such as unclaimed and returned funds. GitPay's proposed policy preserves the award independently of those delivery outcomes. [Payouts FAQ](https://developer.paypal.com/payouts/faqs/).

These sources inform the design. The exceptional-cancellation rules and notice duration are GitPay's decisions, not policies attributed to those providers. Verify current provider documentation when implementing.

## Required acceptance cases

- Multiple contributors can submit; no exclusive claim or first-opened-PR privilege.
- Valid submission → cancellation request → merge produces no refund and at most one award.
- Closing the submission or calling copied work “internal” does not remove the evidence.
- Independent earlier fix, no unresolved claim, elapsed notice and eligible operator approval permit one refund.
- Empty PRs can be dismissed with evidence; substantive disputed claims remain under review.
- AWAITING_CLAIM and failed/returned payouts preserve the award.
- Self-approval, conflicting roles, stale evidence, missed webhooks and lost access prevent uninformed refunds.
- Late evidence invalidates an unexecuted approval; unknown refund outcomes prevent a competing payout until reconciliation.

Implementation requirements and phase gates live in [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md).
