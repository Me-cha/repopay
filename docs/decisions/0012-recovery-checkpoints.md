# ADR 0012 — durable discovery and safe recovery

Status: Accepted for local Phase 10 implementation, 2026-10-30. Live fault walkthroughs remain deferred.

Retain the existing durable due-time capture, payout, claim and refund services. They already preserve operation identities and rotate completed payouts for later returns. Do not introduce parallel financial job state or a generic resend operation.

Migration 0016 adds reconciliation checkpoints. The scheduler locks one scheduling row, rotates every bounty (including AWAITING_CLAIM, PAID and funding incidents), and commits the cursor with durable `reconcile_bounty` jobs. Concurrent schedulers cannot advance a cursor without its jobs. `RECONCILIATION_PAGE_LIMIT` bounds each scheduling batch; `RECONCILIATION_RATE_PER_MIN` and `RECONCILIATION_INTERVAL_SEC` set persisted spacing. These are reconciliation-work bounds, not an aggregate HTTP or monetary budget; each discovery page may generate up to 100 PR jobs, and normal webhook/action traffic is separate.

Each GitHub discovery job reads one ascending-created PR page and commits downstream revision sync jobs with a per-bounty page cursor under its current lease. Failures retain the cursor. A completed discovery pass wraps for future edits; it never establishes absence or authorizes payment. Award selection still requires the existing complete, stable candidate inventory. Repositories beyond that inventory bound remain held, even if discovery eventually visits every page. Provider lists are not atomic snapshots.

`RECONCILIATION_DISCOVERY_ENABLED` defaults false because discovery can enqueue sponsored verification. This is a live-activation switch, not a substitute for local tests. Existing financial polling continues independently, even when a GitHub/scheduler/other subsystem tick fails. Status commands retain one reply per participant command; funding/projection work is coalesced per configured interval.

Safe operational retry keeps the failed job and reason, creates a deduped child with the same payload and uses an explicit read/projection allowlist. Actor commands, funding POST recovery and model requests are excluded; their own consent/intent/budget boundaries remain authoritative. Installation refresh and PR sync can enqueue existing normal downstream work, so operators must consider sponsorship before retrying them. No replacement payout/refund endpoint exists.

GitHub REST page shape checked against [official pull-request documentation](https://docs.github.com/en/rest/pulls/pulls): `state=all`, `sort=created`, `direction=asc`, `per_page=100`, numeric page. This recovers missed PR events; it does not fabricate or replay never-received user commands. Recover failed received jobs using their saved identity, and ask the original actor to reissue a missing command if needed.
