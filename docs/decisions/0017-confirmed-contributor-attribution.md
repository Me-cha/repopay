# ADR 0017: Revision-bound contributor attestations

Date: October 31, 2026. Status: accepted by the user; locally implemented, live split acceptance pending.

The PR author remains GitHub-authenticated. An additional commit author is eligible only after signing in to GitPay, declaring their contribution, and receiving a separate write-authorized maintainer's confirmation. Both attestations bind the submission ID, head SHA and base SHA. GitHub commit identity is a prerequisite, never sufficient proof alone; trailers alone cannot add recipients. The bounty creator and PR author cannot use this additional-author flow. A maintainer cannot confirm their own claim.

`actions/attribution.ts` checks current repository access, bounded commit evidence and an open current PR before recording immutable attestations. `/submissions/:id/contributors` provides CSRF-protected confirmation. The collector consults the same records for model evidence and final candidate scanning. Changing head or base requires both confirmations again; old history remains intact. This is authenticated human attestation, not cryptographic authorship verification or a guarantee against collusion.

Writes serialize on the bounty/submission with award selection, invalidate evidence/version-bound financial confirmations, and cannot change an existing award. They do not enqueue model calls, reserve money or send payments. A fresh review is needed after confirmation. The shared policy still requires complete evidence and exact-cent allocations. No special settlement exception or evaluated model profile is enabled by this change.

Migration 0018 introduces append-only contributor attestations. Live two-author allocation and recipient receipts remain required separately.

Interaction update: [ADR 0018](0018-github-contributor-commands.md) supersedes browser-only confirmation as the primary path. Signed PR commands now reuse these same immutable revision-bound guards; the browser path remains a fallback.

Follow-up: [ADR 0019](0019-review-evidence-and-pr-retry.md) replaces the primary browser retry link with a signed PR command and carries current-revision attribution evidence into the verifier snapshot.
