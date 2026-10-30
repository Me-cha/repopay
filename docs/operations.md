# Local recovery, cancellation and refund operations

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

## Recovery and reconciliation (Phase 10)

Keep `RECONCILIATION_DISCOVERY_ENABLED=false` until the deferred live discovery/review session is authorized. Existing capture, claim, payout and refund polling remains active. Discovery scans all bounty lifecycles using migration 0016 checkpoints; interrupted scheduling cannot advance without durable work. Rate and page bounds are documented in [ADR 0012](decisions/0012-recovery-checkpoints.md). A capped/failed inventory means **unknown**, never no claim.

Read diagnostic IDs and classes without payloads or destinations:

```sh
docker compose exec -T postgres psql -U gitpay -d gitpay -c \
"SELECT id,kind,status,attempts,max_attempts,last_error FROM jobs WHERE status='failed' ORDER BY id;"
docker compose exec -T postgres psql -U gitpay -d gitpay -c \
"SELECT name,cursor,generation,next_run_at FROM reconciliation_checkpoints ORDER BY name;"
```

For read-only financial triage, run `pnpm ops:retry-job <bounty-id> --inspect-bounty`. This prints only the lifecycle, responsible actor, attention reason and known order/capture/batch/refund IDs; it never prints destinations or queues work.

For a failed read/projection job, restore App access/credentials first, then run `pnpm ops:retry-job <job-id>`. It preserves the failed record and dedupes a new child against that ID. The CLI refuses actor commands, model requests and financial recovery jobs. Do not reset attempts, erase errors, unlock claims or replace sender/request IDs through SQL. A failed recovery child can be investigated separately and explicitly retried by its own ID. PR/installation refresh may trigger ordinary downstream reviews; respect sponsor allowances.

| Cause | Responsible actor / next action |
| --- | --- |
| GitHub access removed or rate limited | Repository owner restores access; operator retries safe discovery/projection. Preserve claims; no new refund authorization. |
| Sponsor revoked or review capped | Owner reconnects; wait for the legitimate allowance or obtain bounded authorization. Do not borrow ambient credentials. |
| Capture unknown or funding hold | Operator checks the saved order/capture, original terms and merchant. Preserve awards and freeze new disbursement. |
| Payout pending/failed/returned | Operator checks existing batch/item IDs and recipient's sandbox Activity. Award remains committed; replacement is unavailable. |
| Refund pending/failed/unknown | Independent operator investigates original capture/refund/request identity. Principal remains reserved until authoritative reconciliation. |
| No eligible independent operator | Funded cancellation remains unavailable. Repository writers cannot approve their own refund. |
| Secret rotated | Restart with the new secret for the same provider account; reconcile known operations. Different account/client IDs require investigation, not resubmission. |

App removal must not stop known PayPal reads. A failure in one polling subsystem must not starve other subsystems. Preserve job/intent/provider IDs for correlation; omit raw provider bodies, credentials and recipient email from reports. Expired provider dedupe windows require manual investigation when the provider ID is unknown, not a fresh POST/key.

## Backup and restore

Before migration, stop workers for a coordinated production backup; local additive migrations also retain a dump under ignored `.local/backups/`. Use `pg_dump -Fc` with the configured database role. Keep encryption keys and provider account binding in a separate protected backup: database restoration without the correct keys cannot decrypt saved identities. Dumps contain sensitive encrypted and operational data and must not be committed or posted.

Restore into a **new isolated database**, with workers, webhooks, discovery and settlement disabled. Validate migration history, award/refund reservations, operation/request IDs, counts and key readability before switching traffic. Never restore over an active money database or run two restored workers against providers. A stale restore can omit provider-side outcomes: inspect/reconcile known operations before enabling any POST path. The local worker crash harness proves lease recovery, not production backup/PITR readiness; an actual hosted restore rehearsal remains Phase 11/final-session evidence.

## Deployment hold and compatibility

Set `RECOVERY_MODE=hold` on **every** service and suspend the worker before attaching restored data. This blocks HTTP mutations (including webhook intake, which must be redelivered later) and worker polling/claims. `/healthz` may be ready while operations are held. Never release hold solely because the restored database has no pending intents: provider activity since backup may contain an operation absent from that snapshot. Independently reconcile provider records and retain hold on uncertainty.

`pnpm db:check` verifies migration timestamps and SQL hashes against the current artifact. Startup and web health use the same gate. The web pre-deploy process alone migrates; bring up the same worker commit afterward. Old binaries do not bypass the gate after new migrations. Preserve data and use an explicitly tested compatible rollback release. Detailed steps: [deployment](deployment.md). The local dump/restore test is synthetic; hosted restore acceptance remains pending.
