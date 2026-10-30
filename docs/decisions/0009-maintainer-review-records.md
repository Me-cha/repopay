# ADR 0009: Revision-bound maintainer review records

Date: 2026-10-30

Status: Implemented locally under the user's Phase 7 authorization; live walkthrough pending.

Phase 7 retains Phase 6's immutable `awards` table and adds an append-only `review_decisions` table rather than merging awards and review history into the plan's conceptual `decisions` table. Approvals reference an award; rejections reference the exact submission, head/base/merge SHAs, evidence snapshot and verification. Neither record can be edited or deleted.

Both automatic selection and manual approval call the shared final award guard. The earliest unresolved merged candidate is selected by merge timestamp and stable PR ID. A rejection excludes only the same revision and evidence hash from subsequent award consideration. Changed material evidence becomes reconsiderable; saved evidence and cancellation claims remain intact. Rejection never authorizes a refund or changes an existing award.

Approval is a two-step authenticated flow: choose the validated suggested split or one verified eligible recipient, supply a reason, then confirm a token containing the exact full allocation, scan, evidence and assessment identities. Final POST accepts no replacement allocation. It rechecks access, session, installation, funding, scope, candidate ordering, evidence, CI and token lifetime under the existing locks. AI uncertainty can be overridden; incomplete evidence, unverified recipients and required CI cannot. This does not add co-author identity verification.

`/bounty approve` posts a review link; `/bounty reject <reason>` executes an attributed non-payment rejection after current permission checks. On PRs linked to multiple bounties, the issue number is mandatory. Rejection jobs persist an atomic receipt to prevent a replay from rejecting a later candidate. A browser rejection is also available. Review history is available in the authorized bounty API.

Runtime manual approval remains restricted to the existing explicit settlement scope. No new sandbox payout, funding scenario, global acceptance or production activation is implied by implementation. See [Phase 7](../phases/07.md).
