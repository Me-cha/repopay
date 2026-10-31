> Foundation milestone: follow [ADR 0021](decisions/0021-foundation-mvp-scope.md). The local v5 profile permits only an exact approved sandbox bounty scope; `SETTLEMENT_DEMO_SCOPE` remains blank by default. A deployment alone is not authorization to activate payouts or consume new model requests. Confirm current review/evidence and finish the hosted payout receipt check; the broad evaluation/recovery campaign is deferred.

# Hosted sandbox deployment

Phase 11 includes a prepared Render Blueprint and local release safeguards. The user manually deployed https://gitpay.onrender.com/ with Free web service and Free Postgres (1 GB), choosing fresh demo issues rather than importing local financial history. Health, GitHub sign-in/intake, unfunded cancellation and the user-observed dashboard are verified; full hosted acceptance remains pending. See [hosted evidence](evidence/11-hosted.md).

## Current manually configured demo

The running demo uses `WORKER_MODE=inline` on the web service, with no separately provisioned worker reported. Its start command is `pnpm db:migrate:hosted && pnpm db:check && pnpm start:hosted`; migration is run before listening because the selected service does not use a pre-deploy command. Build with `corepack enable && corepack prepare pnpm@10.29.3 --activate && pnpm install --frozen-lockfile --prod=false && pnpm build`. Set `PUBLIC_URL=https://gitpay.onrender.com` and keep shared encryption keys stable across releases.

GitHub callback/intake were moved to this origin for fresh issue #10. The PayPal webhook and historical financial records have not been migrated by this smoke test. Keep discovery and funded cancellation disabled, and settlement scope absent until a separately reviewed test is ready. Inline hosted Copilot operation, provider continuity and recovery remain unverified. The paid Blueprint below is an alternative topology, not a description of the user's current Free deployment; do not sync it into that deployment without resource approval.

## Topology and cost review

`render.yaml` defines a separate Node web service, separate worker and private PostgreSQL 16 database in Singapore. Web and worker use `1c-2g`; Postgres uses `0.5c-1g` with 5 GB storage. These are paid compute choices, not a free-worker promise. They are initial capacity assumptions, not load-tested sizing. The Blueprint disables automatic deploys and previews.

Checked on 2026-10-30: Render documents separate workers, service/database plan identifiers, private database references and pre-deploy commands in its [Blueprint specification](https://render.com/docs/blueprint-spec) and [worker documentation](https://render.com/docs/background-workers). The [pricing page](https://render.com/pricing) was consulted, but the retrieved page did not expose a reliable complete monthly quote. Before creating resources, review the actual Dashboard estimate, workspace charges, storage/backup retention, bandwidth and region availability and obtain approval for that concrete configuration. Blueprint schema validation does not prove account availability or capacity.

## Release preparation

1. Choose one reviewed commit for both services. Run typecheck, lint, complete tests, build and browser checks. The frozen pnpm lockfile and pinned Node 22.23.4/pnpm 10.29.3 build both server and dashboard; services execute built JavaScript, not watchers. The worker's hosted Copilot SDK/binary/memory behavior still needs read-only preflight and approved sponsor verification.
2. Review the Blueprint against current Render validation, the account quote and this runbook. It is validated locally against Render's public JSON schema; no authenticated Blueprint sync was performed.
3. Create/configure the services only after approval. The web service prompts for manually supplied configuration/secrets (`sync: false`). The worker references those values from the web service; it must not generate different encryption keys. Runtime defaults are shared through `gitpay-sandbox-runtime`.
4. Keep `RECOVERY_MODE=hold` on **both** services during initial setup, restore and migration. It blocks HTTP mutations/webhook intake and prevents all worker processing. `/healthz` still reports schema readiness; that is not authorization to release the hold. Live discovery and funded cancellation remain false; settlement scope is blank.
5. Use the stable assigned HTTPS origin as `PUBLIC_URL` on both services. Configure the selected GitHub App callback `${PUBLIC_URL}/oauth/github/callback` (also used for sponsor consent), GitHub webhook `${PUBLIC_URL}/webhooks/github`, and PayPal **sandbox** webhook `${PUBLIC_URL}/webhooks/paypal`. Verify existing App permissions/events and repository installation. Replace the configured sandbox webhook ID with the actual hosted registration's ID. Do not change local callbacks until the hosted transition is authorized.

## Secrets and activation

The Blueprint contains no secret values. Set GitHub App identity/private key/client secret/webhook secret, PayPal sandbox client/secret/merchant/webhook IDs, `SESSION_SECRET`, `TOKEN_ENC_KEY` and `PAYMENT_DATA_ENC_KEY` through Render's protected environment settings. Token and payment keys must be separate base64-encoded 32-byte values. Preserve them unchanged across services/redeploys and keep protected copies outside database backups. Do not use Render's arbitrary generated string for fields that require base64 bytes. Neither probe tokens nor contributor emails belong in the Blueprint.

`NODE_ENV=production` still permits **only** `https://api-m.sandbox.paypal.com`; production configuration also requires HTTPS `PUBLIC_URL`. Required CI context identities must be configured for the demo repository before funding. Keep Copilot `auto`; customer reviews require their own saved sponsor consent. No ambient operator token is configured in these services.

## Migration and startup ordering

- Suspend/drain the worker and put the web service on hold before schema changes. Confirm a current backup and key inventory before the deploy. Do not assume the Blueprint orders service deployments.
- The **web service alone** runs `pnpm db:migrate:hosted && pnpm db:check` as its pre-deploy command. Migration uses the existing PostgreSQL advisory lock. The worker never runs migrations.
- Every web/worker startup checks the exact ordered migration timestamps and SQL hashes against its artifact. Missing, altered or newer migration history fails startup. Web health rechecks that match and DB reachability. A worker started before the web migration completes must be redeployed after migration; it must not silently run against an old schema.
- Once the web release passes schema health, deploy the worker from the **same commit**, still held. In separate mode the web service does not run jobs. Inline mode remains supported locally and now wires the same discovery scheduler when explicitly enabled; do not enable inline and separate workers accidentally.
- For a fresh empty database, confirm the held services and provider configuration before releasing hold. For any restored or uncertain database, perform the reconciliation procedure below first. Coordinate `RECOVERY_MODE=normal` across services only for the explicitly authorized live session. Activation does not satisfy outstanding Phase 5–10 acceptance gates.

## Restore and rollback

A backup can predate a successful provider POST entirely. The absence of an intent in restored SQL is **not** proof that no payment happened. Set hold and suspend financial workers **before connecting restored data**. Keep the old source isolated; do not run two restored copies against providers.

Restore into a disposable/private database and check migration hashes, encryption-key readability, original operation keys, allocations and retained evidence. Compare PayPal merchant activity and relevant GitHub activity **since the backup timestamp**, including operations absent from the backup, using independent provider records and the original account binding. Resolve missing identities/outcomes under a reviewed recovery plan before any POST path is enabled. Do not invent an intent or automatically release principal based only on restored rows. Keep hold if reconciliation is incomplete. Human CLI payment probes are outside the server hold and must not be run during this process.

The local test uses real PostgreSQL dump/restore with synthetic credentials and a simulated provider ledger: a payout accepted after backup disappears from the restored DB, while hold prevents another submission. This is not a hosted backup/PITR rehearsal or proof that every unknown outcome can be recovered automatically.

Rollback means a tested compatible application artifact, preserving all data. The exact-history startup check deliberately rejects an old artifact after newer migrations; use a compatibility release carrying the current migration history, or roll forward. Do not delete migration records, reverse financial history, reset the database, or rotate keys to make startup pass. See [operations](operations.md) for diagnostics and recovery identities.

## Hosted acceptance still required

After explicit activation, run `pnpm preflight` read-only first and record the result. Do not add `--sandbox-payment` or `--model-probe` without separate approval. Confirm the deployed commit, redacted logs, DB readiness, callback/webhook delivery, sponsor connection and browser session. Then run the role-specific core, delayed-claim, independent refund/72-hour notice, restart and permission-loss scenarios in [hosted evidence](evidence/11-hosted.md). A local ngrok URL is not a Render deployment.

Render shutdown is allowed up to 300 seconds; forced termination still relies on durable leases/intents, not graceful shutdown alone. Web shutdown closes long-lived SSE connections after stopping inline work. Configure operational alerts for unavailable health, dead jobs and held outcomes; do not use health success as evidence that money moved.
