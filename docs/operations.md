# Local cancellation and refund operations

Phase 8 is locally implemented; live acceptance is deferred. Keep `FUNDED_CANCELLATION_ENABLED=false`. See [ADR 0010](decisions/0010-cancellation-refund-boundaries.md) and the [final live checklist](phases/live-walkthroughs.md).

Before explicitly authorized isolated testing, back up Postgres, stop workers, apply migration 0014 with `pnpm db:migrate`, and restart the server/worker. Configure an isolated repository and independent operator with read access. Confirm the operator is neither requester, creator, funder nor claimant. New funding must disclose version 5 cancellation terms; legacy bounties cannot be converted.

The maintainer uses `/bounty cancel` → authenticated request page. The worker publishes a notice; verify the persisted comment and full 72-hour deadline. Contributors reply with PR/evidence on the issue. A failed publication has no deadline. The independent operator opens the notice's review link, inspects saved evidence and chronology, gives claim-specific reasons, and previews then confirms a decision. Holds require a future update. Approval alone is not a provider refund: the worker refreshes all guards before reserving and submitting.

Inspect state without exposing secrets:

```sh
docker compose exec -T postgres psql -U gitpay -d gitpay -c \
"SELECT id, bounty_id, status, evidence_version, notice_published_at, notice_ends_at, next_update_at FROM cancellation_requests ORDER BY id;"
docker compose exec -T postgres psql -U gitpay -d gitpay -c \
"SELECT id, bounty_id, status, boundary_at, safe_retry_until, attention FROM refund_intents ORDER BY id;"
```

- `RESERVED`: proven unsent. Evidence/access changes abort it and require fresh review.
- `MAY_HAVE_SUBMITTED`: do not clear the reservation, replace the key or pay a contributor. The response may have been lost.
- `IN_FLIGHT`: poll the saved refund ID; pending is not cancelled.
- `SETTLED_FAIL`: investigate the existing provider operation; the bounty remains reserved.
- `SETTLED_OK`: provider completion is confirmed. Keep history; never reopen the same bounty.
- Late evidence: record independent investigation. A completed refund cannot be automatically clawed back.

When a provider ID is unknown after the retry window, stop POST retries and investigate in the sandbox merchant account. Preserve the original request key and capture; do not improvise a new refund or modify rows to release funds. Disabling activation prevents new authorization and unsent operations; existing known-ID reconciliation continues. Credentials, payer/contributor emails and raw financial responses must not enter logs or evidence files.
