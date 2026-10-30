# ADR 0013 — deployment compatibility and restore hold

Status: Accepted for local Phase 11 preparation, 2026-10-30. Hosted activation remains deferred.

Use separate Render web/worker services and a private Postgres database. One web pre-deploy migration process owns schema changes; both services check exact migration timestamps/hashes before startup. Health repeats the check. This favors a coordinated held rollout over claiming zero-downtime compatibility with untested old binaries. Rollback uses an explicitly tested compatibility artifact, never erased migrations or payment history.

`RECOVERY_MODE=hold` disables HTTP mutations/webhook intake and all worker processing. It is normal by default for existing local development and explicitly hold in the prepared Blueprint. It must be set on every service before restoring data. No database-only latch can prove that a restored snapshot includes all external effects: an intent may be missing entirely. Provider activity since backup must be independently reconciled before an operator releases hold. The setting does not constrain a human running standalone provider probes.

Preserve encryption keys separately from backups and share their exact values across web/worker. Keep PayPal sandbox-only even with production NODE_ENV. Neither this phase nor the Blueprint enables general settlement, new live discovery, refunds or a sponsored evaluation.

`db/compatibility.ts` owns the artifact/history gate; `scripts/check-migrations.ts` exposes it to deployment. `main.ts` and `worker.ts` validate before serving/processing. `jobs/runner.ts` enforces hold before any poll or claim; `http/routes.ts` rejects mutations before handlers. Inline mode uses the same scheduler as separate workers. `test/helpers/restore.ts` uses matching PostgreSQL 16 Docker tools only against generated schemas in a validated local test database.

Tradeoffs: hashes establish migration history compatibility, not a full structural drift audit or successful hosted restore. Exact equality intentionally rejects newer schemas on old releases. Restoration remains an operator procedure with independent provider evidence, not automatic re-creation of missing money operations. Blueprint validation does not provision resources or validate the account's pricing/quotas.
