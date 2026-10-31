# ADR 0018: GitHub contribution commands and discoverable next actions

Date: October 31, 2026. Status: user-approved direction; local implementation, hosted acceptance pending.

ADR 0017's separate authenticated declarations remain required. Its browser-only interaction is superseded as the primary path: signed GitHub issue-comment events on a PR identify the actor, and current installation/repository permissions authorize the action. The browser page remains a compatible fallback. No GitHub command supplies financial approval.

- `/bounty contribute [#issue] <head SHA> <base SHA> <reason>` records the comment author's own contribution declaration.
- `/bounty confirm-contributor [#issue] @login <head SHA> <base SHA> <reason>` records a different write-authorized maintainer's confirmation of an existing declaration.

Full 40-character head and base SHA values are mandatory and supplied in copyable bot instructions. They prevent delayed commands from silently confirming a newer revision. Optional issue selection is mandatory when the PR has multiple eligible funded bounty links. Reasons contain 10–2000 characters. New comments only: edits, quotes, fenced commands and bot-authored commands do not execute. GitHub-identified commit authors remain a prerequisite; display names and trailers alone cannot add payees. PR author/creator exclusion, full commit pagination, open-current-PR checks, fresh installation checks, transactional job leases, immutable records and award fences are shared with the browser flow. Both confirmations are invalidated for eligibility by head/base changes. Duplicate delivery/commands do not create duplicate attestations.

The worker acknowledges on the same PR. A declaration acknowledgement supplies the exact maintainer confirmation command; confirmation acknowledgement links to the bounded review retry page. Attestations never enqueue model requests or payment work. Projection retries use trusted App-owned markers and do not require repeating a model request.

Issue comments expose owner sponsor setup, funding, status and history. A durable `sync_submission` projection publishes review outcome, current revision, contribution commands, retry and owner sponsor links on the PR. Stale evidence is not presented as a current verdict. The issue's NEEDS_REVIEW state links to authenticated financial approval. Award projection announces immutable per-recipient cents and payout connection/progress links on the winning PR, excluding recipient emails and tokens. Other PRs are not announced as winners. The dashboard remains read-only and authenticated pages retain their existing authorization.

No migration, prompt change, payment-policy change, model allowance increase or hosted deployment is implied by this implementation. Existing historical attestations, reviews and awards remain intact.

Follow-up: [ADR 0019](0019-review-evidence-and-pr-retry.md) replaces the primary browser retry link with a signed PR command and carries current-revision attribution evidence into the verifier snapshot.
