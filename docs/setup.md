# Local setup and provider feasibility

Review execution (November 9): apply migrations 0021–0022 with `pnpm db:migrate` before starting this artifact. They add publication and durable dispatch; `REVIEW_BACKEND=shared` preserves the default. See the [executor setup and recovery runbook](review-execution.md) before enabling dedicated or Render execution. Isolated executor configuration must never include the application database/payment secrets.

The local application includes GitHub workflows, sandbox funding and payouts, reviewed cancellation, and a read-only dashboard. Provider/hosted acceptance is incomplete; use the [acceptance matrix](evidence/12-acceptance.md) for verified behavior and blockers. For a credential-free clean install, follow the verification commands in [README](../README.md#start-here).

## Install and run locally

Use the Node 22 version in `.node-version` and pnpm version in the root `packageManager` field. Install/activate those with your normal version manager. Docker Desktop or another working Docker Compose daemon is required.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
chmod 600 .env
docker compose up -d
# Once Postgres is healthy; run this once for a new volume:
docker compose exec -T postgres createdb -U repopay repopay_test
pnpm db:migrate
```

Do not overwrite an existing `.env`. Compose exposes PostgreSQL 16 only on `127.0.0.1:5433`, with development-only credentials. The primary database is `repopay`; tests use `repopay_test`. `createdb` reports an error if the test database already exists; retain the existing database. Migrations are versioned and rerunnable. Test migrations use `TEST_DATABASE_URL` and an isolated schema through the test helper, never the primary migration command.

Populate the required application settings in `.env` before `pnpm dev` or `pnpm start`; Copilot model probes have their own explicit sponsor configuration. Both startup and preflight validate configuration. `GH_PRIVATE_KEY` can contain literal `\n` escapes in one quoted line; the probe converts them to line breaks. Generate separate 32-byte base64 values for `TOKEN_ENC_KEY` and `PAYMENT_DATA_ENC_KEY`, and random 32-byte or longer session/webhook secrets; keep them local. The encryption keys must differ. Funded cancellation stays disabled.

```sh
pnpm dev
# In another shell:
curl --fail http://localhost:3000/healthz
# Or build, then run the compiled server:
pnpm build
pnpm start
```

Health responds with `{status,version}`: HTTP 200 when Postgres is reachable and 503 when unavailable. SIGINT/SIGTERM stops HTTP and closes the pool. The health route does not call GitHub, PayPal or Copilot.

## Offline checks

Tests do not load `.env` or use provider credentials. Unit fixtures use explicit synthetic configuration; integration tests require real local Postgres. Each fixture creates a unique schema and drops only that schema. Remote URLs, database names without `_test`, and URL query options are refused before fixture creation/reset.

```sh
export TEST_DATABASE_URL=postgresql://repopay:repopay@127.0.0.1:5433/repopay_test
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Missing database configuration fails integration tests. Nock rejects unmatched external HTTP requests. CI supplies PostgreSQL and the test URL; it needs no provider secrets and does not run feasibility probes. GitHub-hosted CI itself is not verified until this branch is pushed under separate authorization.

## Configure provider accounts

1. **GitHub:** create the App/demo installation described in [architecture section 3](../IMPLEMENTATION_PLAN.md#3-external-setup-human-does-this-codex-documents-it-in-readme). Put its App ID, slug, private key, client ID/secret and webhook secret in `.env`. The Phase 0 probe signs a JWT and reads `/app`; installation access and user OAuth are verified in later phases. The Phase 0 probe posts no bot comments. The Phase 1 worker does post comments on its installed repositories.
2. **PayPal:** use a sandbox REST app and business account with Payouts enabled and sufficient sandbox balance. Set `PP_CLIENT_ID`, `PP_SECRET`, `PP_WEBHOOK_ID`; keep the exact sandbox `PP_BASE`. Prepare a personal sandbox recipient account. A successful OAuth token alone does not establish Payouts capability.
3. **Copilot SDK:** new funding defaults to `COPILOT_MODEL=auto` and requires a separate repository-owner sponsor connection. Sign in as the owner at `/bounties/{id}/copilot-sponsor`, choose **Connect Copilot sponsor**, and authorize the same GitHub App that is installed on that repository. Repopay stores the refreshable grant encrypted and separately from the browser session. Reviews use the owner's Copilot allowance; contributors' accounts are not used. Auto's serving model is recorded for each review. Fixed profiles remain supported for legacy terms without silently changing their hashes. See [ADR 0007](decisions/0007-copilot-auto-model.md).

Set the App's callback URL to `${PUBLIC_URL}/oauth/github/callback`. App ID, client ID, client secret and private key must all belong to that same App. A private key is not a client secret. After editing `.env`, restart the existing server; `tsx watch` does not guarantee an environment-file reload. When switching Apps, sign out and begin a fresh login. A configured callback, a successful installation read and a valid OAuth client secret are separate checks.

For an organization sponsor, this app still needs the GitHub App's **Copilot Requests → Read-only** organization permission, an approved organization installation, and an enabled organization Copilot app policy. GitHub's documented installation-token billing route is researched, but is not implemented in this onboarding slice. See [official organization authentication](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/server-to-server-tokens).

`COPILOT_GITHUB_TOKEN`, `COPILOT_AUTH_KIND` and `COPILOT_BILLING_OWNER_ID` are for explicit local model probes only; the running app does not use them as a funding or customer fallback. Sponsor OAuth and background PR verification support personal repositories locally. Configurable per-repository UTC-day and per-SHA attempt caps and SDK-reported usage telemetry are implemented. They do not create a hard monetary limit: GitHub account/organization billing controls remain authoritative. Organization-billed onboarding remains deferred. Signed user-authorization revocation and refresh fencing are implemented locally. Repopay preserves the selected profile and never falls back to another account. Old NVIDIA variables in an existing local `.env` are ignored; the migration does not edit that file.

Never paste credentials into chat or evidence files.

## Explicit probes

From the repository root, `pnpm preflight` reads GitHub App metadata and obtains a PayPal OAuth token. It does not contact Copilot or submit a payout. Copilot listing/generation uses `parseCopilotEnv`; it needs only the sponsor settings and response-size bound, independently of GitHub App/PayPal setup.

```sh
pnpm preflight
# No generation: lists accessible IDs when COPILOT_MODEL is blank;
# otherwise checks whether that exact configured ID is listed.
pnpm preflight --model-only
# Explicit generation, billed to the configured sponsor:
pnpm preflight --model-only --model-probe
# The same model probe alongside GitHub/PayPal authentication checks:
pnpm preflight --model-probe
```

`--model-only` exits nonzero if the accessible fixed-model catalog is empty. Successful authentication alone is not model availability. GitHub currently documents [Auto-only access for Free and Student plans](https://docs.github.com/en/copilot/reference/ai-models/supported-models#supported-ai-models-per-copilot-plan). The October 29 non-payment Auto experiment succeeded, but Auto remains outside the application configuration and funding contract; see [evidence](evidence/copilot-migration.md#auto-prototype--october-29-2026). Do not set `COPILOT_MODEL=auto` or copy an Auto-selected model ID into configuration without proving explicit access.

`parsePreflightEnv` requires GitHub App ID/slug/client ID/private key, PayPal sandbox client credentials and HTTP limits. It does not require Copilot credentials, webhook IDs/secrets, user OAuth secrets, database settings or local application keys. Leave unregistered webhook IDs blank. HTTP and worker startup use `parseFundingEnv`; new funding also requires an explicit `COPILOT_MODEL`. Missing Copilot credentials do not stop existing GitHub login/draft workflows.

The explicit model probe makes one SDK `sendAndWait` call with a strict Zod `{confirmed:true}` schema and synthetic input. It launches the pinned SDK's managed stdio runtime in an isolated temporary directory with `mode: empty`, explicit authentication, a filtered environment, no tools/skills/config discovery and rejected permissions. It removes temporary state on completion and aborts/stops the runtime on timeout or failure. Raw model reasoning and provider errors are not returned or logged. A valid negative decision is final; errors are not retried with another model or credential. Observed model changes reject the result.

`COPILOT_MAX_INPUT_BYTES` bounds supplied evidence; `PROVIDER_RESPONSE_MAX_BYTES` bounds streamed text/reasoning and final JSON; `COPILOT_TIMEOUT_MS` bounds the request lifecycle and `COPILOT_SHUTDOWN_TIMEOUT_MS` bounds cleanup. These are resource bounds, not a guaranteed maximum bill: GitHub controls model pricing and runtime accounting. The SDK's structured-output interface is preview; authenticated model/schema compatibility must pass a live probe and semantic evaluations before settlement. Model listing alone proves neither. No BYOK/NVIDIA fallback is configured.

Use a sandbox Merchant REST app associated with a Business sender in a payout-sending-supported test country (the verified fixture uses US). Its Client ID and Secret authenticate the sender. The recipient is a separate sandbox account and needs no REST app. The default IN sender was rejected with `PAYOUT_NOT_AVAILABLE`.

For the sandbox payment probe, set `PREFLIGHT_SANDBOX_RECIPIENT` in local `.env` to an explicitly selected **sandbox** recipient address, then run:

```sh
pnpm preflight --sandbox-payment
```

This sends one 100-cent USD payout operation and repeats the same `sender_batch_id` to observe provider duplicate handling. The request body is identical on repeat. It then reads the batch/item status. Only an observed item `SUCCESS` and the corresponding sandbox recipient receipt establish delivery; `PENDING`, `UNCLAIMED`, errors or a batch-level `SUCCESS` alone do not. Run the same command again to reconcile/recheck the same identity while inside its safety window.

The ignored `.data/preflight/payout.json` contains immutable operation IDs, amount, creation time, hashes binding account/recipient and a recovered batch ID. It is written/fsynced before the request, with restrictive file permissions and an exclusive lock. Raw recipient addresses and access tokens are not persisted. Keep this state: deleting it can create another payout. Do not change accounts/recipients, rename the state, or run from a fresh checkout to retry an ambiguous operation. These local files are only for the single-machine Phase 0 probe; product intents will live in Postgres.

The CLI refuses resubmission at 29 days, providing margin before PayPal's documented 30-day deduplication window. If a process crashes, inspect its state and provider history before removing a stale `.lock`; never erase the identity. After expiry, use PayPal's sandbox portal or authenticated read-only batch lookup for reconciliation, not another send. Missing/untrusted recovery links or unexpected response schemas fail closed. Actual retention/duplicate behavior remains an external evidence requirement.

The observed sandbox duplicate response is HTTP 400 `USER_BUSINESS_ERROR` with `SENDER_BATCH_ID` and the exact issue `Batch with given sender_batch_id already exists`, without a recovery link. The adapter accepts that specific format as well as `DUPLICATE_BATCH_ID`. Recovery uses the saved batch ID; an unknown batch still requires manual reconciliation. Preserve the active identity at `.data/preflight/payout.json`. The earlier definitively country-rejected operation was archived separately when the owner switched test accounts; do not reset state for normal retries.

Record redacted request/batch/item IDs, HTTP statuses, actual duplicate response shape, recipient receipt in [00-preflight.md](evidence/00-preflight.md); record new Copilot observations in [migration evidence](evidence/copilot-migration.md). Provider response bodies, emails, keys and tokens stay out of tracked evidence and logs. The historical Phase 0 gate passed; Copilot capability requires fresh evidence.

## Configuration bounds

Payout destinations are saved against the stable GitHub account ID in the current database. Payout settings show the masked saved address and reuse it; the edit form opens only when the user chooses to change it. A failed status lookup offers a retry rather than asking the user to reconnect. Local and hosted databases have separate destination records, even when the same GitHub identity signs in to both. Current delivery remains USD through PayPal; saving a crypto wallet is not supported by this payout adapter.

`.env.example` contains explicit values; `src/env.ts` is the validation source of truth. Timeout, body/response size, job lease and reconciliation settings are bounded positive integers. `PROVIDER_RESPONSE_MAX_BYTES` bounds streamed probe responses; `PROVIDER_TIMEOUT_MS` bounds GitHub/PayPal requests; `COPILOT_TIMEOUT_MS` separately bounds the SDK request lifecycle. Money is bounded integer cents; keys decode to exactly 32 bytes; stable IDs remain strings. Cancellation operator IDs are required only when enabled, and the notice value is fixed at 72 hours.

## Provider references checked

- [GitHub App JWT authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app) and [authenticated App endpoint](https://docs.github.com/en/rest/apps/apps#get-the-authenticated-app).
- [PayPal create payout and deduplication](https://developer.paypal.com/api/payments.payouts-batch/v1/payouts-post), [batch lookup](https://developer.paypal.com/api/payments.payouts-batch/v1/payouts-get), and [official OpenAPI schema](https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/payments_payouts_batch_v1.json).
- [Copilot SDK OAuth](https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/github-oauth) and [pinned Node SDK](https://github.com/github/copilot-sdk/blob/v1.0.28/nodejs/README.md).
- [Drizzle migrations](https://orm.drizzle.team/docs/migrations).

## Phase 1 demo and workers

The isolated demo is [deepakA18/repopay-demo-http](https://github.com/deepakA18/repopay-demo-http), an independent MIT-licensed copy of PayPal's archived HTTP client. It has no upstream remote or GitHub fork relationship. Preserve source attribution and LICENSE. Do all demo issues, labels and bot comments there.

Register a private GitHub App under deepakA18 with Issues read/write and mandatory Metadata read-only. Subscribe to Issues and Issue comment events; installation lifecycle events are delivered automatically. Install only on the demo repository. Configure an HTTPS webhook URL ending `/webhooks/github` and a matching local `GH_WEBHOOK_SECRET`; update App ID/client ID/slug/private key locally. Never copy credentials into evidence. App `repopay-demo-deepak` is configured and installed only on the demo repository. The live draft/status/replay/label walkthrough passed; see [Phase 1 evidence](evidence/01-summary.md). Its original demo setup used a temporary Cloudflare tunnel to port 3107; the current Repopay app uses the stable ngrok workflow below.

Run `pnpm db:migrate`, then `pnpm dev` with `WORKER_MODE=inline`. For separate processes use `WORKER_MODE=separate pnpm dev` plus `pnpm dev:worker`; compiled equivalents are `pnpm start` and `pnpm start:worker`. Both workers use the same handlers, leases and configured retry limits. Stop gracefully before changing App credentials.

Supported commands are `/bounty create 50` and `/bounty status`; `bounty:$50` also creates a draft for a current writer. Other commands explain that their phase is unavailable. Labels never fund, resize or cancel drafts. Failed jobs retain a generic reason; restore App access/provider availability, then request `/bounty status` to enqueue a fresh projection. Inspect exhausted command jobs before explicit redelivery; do not delete delivery identities to force retries. Scheduled recovery arrives in Phase 10.

Each new `/bounty status` comment receives its own visible status reply, including for read-only participants. Replayed deliveries and job retries reconcile the same per-command reply. The canonical bounty summary is refreshed separately.

## Phase 2 login and draft cancellation

Run `pnpm db:migrate` to apply migrations 0002 and 0003 before restarting `pnpm dev`. HTTP startup now also requires `GH_CLIENT_SECRET`, `SESSION_SECRET`, `TOKEN_ENC_KEY`, `ACTION_TOKEN_TTL_SEC`, `SESSION_TTL_SEC` (example 604800) and `OAUTH_STATE_TTL_SEC` (example 600). Add missing settings to an existing `.env`; do not replace it. Phase 2 itself makes no PayPal or model call; current Phase 3 workers also load funding settings below.

Set the GitHub App redirect URI to `${PUBLIC_URL}/oauth/github/callback`, with expiring user authorization tokens enabled. `PUBLIC_URL` must be an origin without a path, query or credentials. HTTPS is required except for loopback development, such as `http://localhost:3000`. Cookies are HttpOnly, SameSite=Lax and Secure under HTTPS. Restart after changing configuration.

### Stable local tunnel

Install the official ngrok agent and add its authtoken once with `ngrok config add-authtoken`; the token stays in ngrok's user-level config, never in Repopay `.env`. Every ngrok account has a stable dev domain; find it in the ngrok dashboard under **Gateway → Domains**. Set the hostname (without `https://`) in local `.env` as `NGROK_DOMAIN`, then set `PUBLIC_URL=https://<NGROK_DOMAIN>`. Restart `pnpm dev` after changing `PUBLIC_URL`, and configure the GitHub App callback to `${PUBLIC_URL}/oauth/github/callback` and webhook to `${PUBLIC_URL}/webhooks/github` once. Keep Repopay running, then start the tunnel in another terminal with `pnpm tunnel`. The helper checks the domain, origin, ngrok authentication and `/healthz` before forwarding port `PORT` (default 3000), with Ngrok request inspection disabled so request bodies are not retained in its local inspector. The assigned domain remains the same across restarts; the endpoint is reachable only while Repopay and ngrok are running. Free ngrok accounts may show an interstitial in browsers.

1. Create an unfunded draft using the Phase 1 workflow. Comment `/bounty cancel` as a current repository writer, or follow the canonical bot comment's review link.
2. Sign into GitHub through the same App. Installation credentials identify the bot; user OAuth identifies the person confirming. Both current installation access and current user repository access are required.
3. Review repository, issue, exact amount and unfunded state. **Prepare confirmation** submits a CSRF-protected POST that creates a short-lived token stored only as a hash.
4. **Confirm cancellation** submits a second POST. Cancellation, activity, token consumption and the bot-sync job commit atomically. No payment or refund occurs. `/bounties/:id` and authenticated `/api/bounties/:id` show the saved result.
5. Reopening a consumed/expired/stale link rejects safely and offers a current status link. If a response is lost, open the bounty status page rather than attempting a new action. Revoked access, expired sessions, funding reservations or provider outages fail closed.

GET previews do not issue action tokens or change bounties. Login GET/callback routes maintain the OAuth handshake and session. Logout requires POST with Origin and CSRF validation; it invalidates the local session even if refresh is in progress. Do not put confirmation URLs in external logs, analytics or screenshots. Repopay redacts them and sends no-store/no-referrer headers; configure any reverse proxy to omit or redact them too.

Mutation forms require JavaScript: they submit with same-origin CORS-mode fetch so strict Origin validation works with no-referrer. Native form navigation under no-referrer sends Origin:null and is deliberately rejected. Logout checks local session/CSRF without contacting GitHub; provider outages do not block local sign-out.

For a collaborator outside the owning account to authorize a personally owned GitHub App, its visibility must be **public** (App settings → Advanced → Make public). Repository collaborator access alone does not allow authorization of that private App. Public App visibility permits other accounts to authorize/install it; repository visibility and credentials are separate. See [GitHub App visibility](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/making-a-github-app-public-or-private).

After editing PUBLIC_URL, stop and restart the actual `pnpm dev` server (and separate worker, if used). `docker compose restart` restarts only this repository's Postgres service. Existing comment links are not rewritten by a process restart: `/bounty status` refreshes the canonical comment, while a new `/bounty cancel` produces a new reply with the current origin. Old per-command replies retain their original links.

## Phase 3 sandbox funding

Apply all pending migrations with `pnpm db:migrate`, then restart the server and any separate worker. Do not overwrite your existing `.env`. Startup uses `parseFundingEnv`; it does not require the local Copilot probe token or payout-recipient data. Add the Phase 3 settings from `.env.example`:

- `PP_MERCHANT_ID`: the receiving **Business sandbox account's merchant ID**, associated with `PP_CLIENT_ID`/`PP_SECRET`. This is not a client ID or email. Confirm it from that account's PayPal settings.
- `PP_WEBHOOK_ID`: register `${PUBLIC_URL}/webhooks/paypal` on the same sandbox REST app, then save the returned webhook ID. Subscribe to `CHECKOUT.ORDER.APPROVED`, `CHECKOUT.PAYMENT-APPROVAL.REVERSED`, and the available `PAYMENT.CAPTURE.*` events. Never use a placeholder ID. Blank configuration rejects event verification; durable polling still performs recovery.
- `POLICY_CI_CONTEXTS`: JSON keyed by the stable GitHub repository ID, with an array of required check names and trusted producing GitHub App IDs. For example, the *shape* is `{"123456":[{"name":"test","appId":"15368"}]}`. Inspect the repository's actual successful check runs; these example values are not automatic approval. Missing required CI blocks funding. This initial implementation supports App-produced check runs; status-only provenance needs explicit support before use.
- `COPILOT_MODEL`: `auto` (default; works with Copilot Free) or a fixed model ID. Auto creates version 4 terms that freeze the sponsor and the Auto policy; each review records the serving model Copilot reports ([ADR 0007](decisions/0007-copilot-auto-model.md)). A fixed ID creates version 3 terms and requires the sponsor to list that model. The repository owner connects at `/bounties/{id}/copilot-sponsor`; version 1–3 terms remain unchanged.
- `POLICY_VERSION=repopay-v2-copilot`, `PP_SAFE_RETRY_SEC=18000`, `PP_VERIFY_CONCURRENCY=2`. The retry window is capped at five hours, below PayPal's documented six-hour request-key retention. `RECONCILIATION_INTERVAL_SEC` controls persisted polling cadence; `RECONCILIATION_RATE_PER_MIN` bounds polls per worker.

Use `/bounty fund` on the issue. The link requires GitHub login and current write permission. If no owner sponsor is connected, use the linked sponsor page and authorize the repository owner's GitHub account; fixed-model access is checked when a fixed profile is selected; Auto access is demonstrated by a live review. Then review the exact issue criteria, amount, sponsor and frozen verification policy; prepare and confirm the funding intent. The worker creates the checkout, and **Refresh funding status** exposes the stored PayPal sandbox approval link. Approval authorizes capture under that saved intent; the worker does not depend on a browser return or webhook to recover it. Use a sandbox Personal account for checkout. This is separate from the Phase 0 payout probe and its recipient.

Return and cancel pages only read stored state and require the provider `token` to match the scoped order. Visiting either is not payment evidence. Only a bound, full, completed USD capture to the configured merchant marks the bounty FUNDED. Provider fees/net are recorded separately when supplied; the gross promised bounty does not shrink to cover fees. Real balance/receipt confirmation remains a manual sandbox gate.

Recovery:

- `/bounty status` schedules a read of the existing funding attempt. Restarting the worker also resumes due attempts.
- A lost response preserves the order/capture key and original checkout origin. Do not delete attempts, change keys or pay again to clear an error.
- After a safe retry deadline, ambiguous operations are read/review-only. An unknown create response without a recovered order ID requires operator investigation; no generic recovery editor is provided in this phase.
- A provider-confirmed voided order with no capture submission can close an abandoned attempt. Pending, unknown and declined/failed capture attempts remain reserved for investigation; there is no automatic replacement payment.
- Receiver/amount/reference mismatches, unexpected multiple/partial captures, refunds/reversals and unknown capture statuses hold disbursement. Confirmed funding/history stays recorded. No refund or payout endpoint is enabled by this phase.
- Keep the original tunnel alive for existing checkout returns; changing `PUBLIC_URL` affects new attempts, not a saved request payload.

See [funding recovery decision](decisions/0004-funding-recovery.md) and [Phase 3 evidence](evidence/03-summary.md) for tested scope and outstanding live checks.

## Phases 4 and 5: contributor connection and PR review

Apply migration `0007_phase4_5.sql` with `pnpm db:migrate`. Keep `PAYMENT_DATA_ENC_KEY` stable and private; it encrypts contributor PayPal sandbox addresses. A contributor signs into GitHub and saves their own payout email at `/connect`. This is self-declared address data, not proof of PayPal ownership. The page masks the saved value; it neither reserves a bounty nor sends money. No award or payout exists before Phase 6.

For PR linking and Repopay Check Runs, update the GitHub App repository permissions to **Issues: Read and write**, **Metadata: Read-only**, **Pull requests: Read-only**, and **Checks: Read and write**. Subscribe to **Pull request**, **Check run**, **Check suite**, and **Status** events, in addition to existing Issues and Issue comment events. Approve the changed permissions on the App installation. GitHub documents that Check Run and Check Suite read needs Checks read access, while creating/updating Check Runs requires the GitHub App's Checks write permission ([Check Runs](https://docs.github.com/en/rest/checks/runs), [webhook event permissions](https://docs.github.com/en/webhooks/webhook-events-and-payloads)).

When a PR body/title refers to a funded issue, Repopay stores it as a candidate. Contributors can also comment `/bounty link <PR number>` on the bounty issue. Multiple PRs remain eligible. A verifier Check Run is neutral and advisory; it never selects an award or authorizes payment. Maintainers request a fresh review directly on the PR with `/bounty retry [#issue]`; use the bot’s full SHA-bound command when available. `/bounty status [#issue]` refreshes PR progress. Legacy authenticated retry pages remain compatible fallbacks. Status events trigger a fresh Checks API read, but commit-status records are not themselves accepted as trusted required CI in this implementation; configure required CI with successful external Check Runs and their producing App IDs.

Live permission/event configuration and the competing-PR/retry walkthrough remain acceptance requirements. New terms use owner-sponsored Auto; the operator's probe token is never a customer fallback. `pnpm eval:verifier` is report-only unless explicitly invoked with `--live`. SDK usage is not currency; GitHub billing settings remain authoritative. See [current Phase 5 evidence](evidence/05-summary.md).

### Bounded live Auto evaluation

First connect the personal repository owner's separate sponsor grant at `/bounties/{id}/copilot-sponsor`. A historical probe token in `.env` is not a substitute. Report-only `pnpm eval:verifier` makes no provider calls. With explicit approval to consume up to 30 sponsor requests, use a new output filename:

```sh
mkdir -p .local/evaluations
pnpm eval:verifier --live --repo-id <stable-repository-id> \
  --output .local/evaluations/auto-run-001.json --allow-30-requests
pnpm eval:verifier --report .local/evaluations/auto-run-001.json
```

The current v5 suite contains ten cases: six code/adversarial baselines, complete/missing/stale contributor-confirmation evidence, and a real multiline-regex defect. Live mode verifies current repository ownership/App access, uses the stored sponsor, and runs three requests per fixture through the application adapter. It creates no payments or GitHub comments/checks. Every completed observation is synced to a private file; an existing output file is refused. A provider failure stops the run without retrying. Partial output is not a pass, and starting a new run needs a new approved budget because failed calls may consume allowance. Auto's concrete serving model, result, elapsed time and usage totals are retained. Report validation also requires current prompt/SDK versions.

Inspect connection metadata without printing credentials:

```sh
docker compose exec -T postgres psql -U repopay -d repopay -c \
"SELECT sponsor_login, model_id, CASE WHEN revoked_at IS NOT NULL THEN 'disconnected' WHEN refresh_expires_at <= now() THEN 'reconnect required' ELSE 'connected' END AS status FROM copilot_sponsors;"
```

Zero rows means no saved grant. A connected row is local state, not proof that GitHub still accepts the token; live requests revalidate access. User-authorization revocation is processed immediately from signed GitHub webhooks; duplicate deliveries cannot revoke a later reconnected grant. Delayed first-time revocation deliveries conservatively require reconnection. Organization sponsorship remains blocked until its separate onboarding and acceptance are implemented.

## Phase 6 local awards and payouts

Back up the development database and stop workers before running `pnpm db:migrate`, then restart the app/workers. Migrations `0010_awards.sql`, `0011_payouts.sql` and `0012_payout_account.sql` add immutable awards and delivery intents, encrypted destination snapshots, observation fencing and account binding. Keep `PAYMENT_DATA_ENC_KEY` stable; existing intents must never be redirected by editing contributor addresses or changing PayPal accounts. These migrations were exercised in isolated test schemas; applying them to your development database is a separate setup step.

The local worker resumes committed claims and reconciles payout items, including a daily revisit after PAID. Automatic candidate selection defaults off until SETTLEMENT_ENABLED=true. It then follows each bounty independently under ADR 0027. Payout polling currently provides recovery without payout-webhook scheduling.

`PP_SAFE_RETRY_SEC` also limits retries of the same immutable payout batch. Its five-hour maximum is conservatively below the payout endpoint's 30-day sender-batch deduplication window. Once the persisted deadline expires, an unknown submission stays reserved for investigation; it cannot create a fresh batch. A known provider batch is read even after the POST window expires. Failed, returned, unclaimed and unknown items retain the award and require attention. See [Phase 6 evidence](evidence/06-summary.md) for acceptance limits.

### Automatic settlement activation

Set `SETTLEMENT_ENABLED=true` on the web/worker process that runs settlement and restart it. There is no per-bounty allowlist or amount/hash environment scope. Remove the obsolete `SETTLEMENT_DEMO_SCOPE` setting. Current transports remain PayPal sandbox and explicitly enabled Solana devnet; this setting cannot enable real-money providers.

The scheduler rotates through funded, unawarded bounties, skipping funding holds. Each bounty is checked against its own frozen identity, amount, currency and merchant/treasury; current sponsor, exact-revision evidence, current v6 review/SDK, accepted serving model, merge, CI and deterministic award policy remain required. See [ADR 0027](decisions/0027-automatic-bounty-settlement.md).

Stale evidence still requires a new review under the existing sponsor/request limits. Errors and partial verdicts never become qualifying verdicts just because settlement is enabled. Setting `SETTLEMENT_ENABLED=false` stops new awards while preserving delivery/reconciliation for committed awards. No funded terms or payment identities should be edited for activation.

### Maintainer review (Phase 7)

Apply migration 0013 using `pnpm db:migrate` after backing up the local database and stopping workers, then restart them. `/bounty approve` on a NEEDS_REVIEW issue opens the authenticated review page. Select the proposed split or a verified recipient, give a reason, review the full amount/revision and confirm. `/bounty reject <reason>` on a linked PR records rejection of its reviewed revision before merge, without clearing evidence or refunding. Do not merge a PR merely to reject it. PR commands accept an explicit linked issue (`/bounty approve #12`, `/bounty reject #12 <reason>`), required when ambiguous. The browser review page handles financial approval only; rejection feedback belongs on the PR. New evidence, lost access, expired/used tokens and committed awards block stale actions. The same settlement profile and service-wide switch also apply to manual approval; this is not unrestricted payment activation.

## Phase 8 local cancellation/refund verification

Apply migration 0014 after backing up Postgres and stopping workers, then restart. Keep `FUNDED_CANCELLATION_ENABLED=false`; no live refund exercise is authorized now. Future explicitly authorized isolated activation also requires `CANCELLATION_SANDBOX_REPO_ID` and independent `CANCELLATION_OPERATOR_GH_IDS`. Only new version 5 Auto terms disclose cancellation; existing terms/hashes stay intact. The notice is always 72 hours from confirmed publication. Local tests inject time and mock providers; they do not satisfy live notice/refund acceptance.

Run `pnpm typecheck`, `pnpm lint`, `TEST_DATABASE_URL=postgresql://repopay:repopay@127.0.0.1:5433/repopay_test pnpm test`, and `pnpm build` using the pinned Node version. Follow the cancellation operations guide for state inspection; never reset an uncertain refund or create a replacement key.

## Phase 9 dashboard and local browser verification

Run `pnpm install`, `pnpm db:migrate` (migration 0015), and `pnpm build`. Start the server normally and visit `/dashboard/` on `PUBLIC_URL`; sign in using GitHub. The dashboard uses the same session and repository authorization as confirmation pages. `pnpm dev` does not rebuild web assets; use `pnpm --filter @repopay/web build` after web changes. `pnpm dev:web` is an optional Vite development proxy, not an alternate OAuth callback origin.

`SSE_HEARTBEAT_SEC` defaults to 30 and controls permission refresh plus independent browser refetch. Access/provider failures hide private data. LISTEN/NOTIFY only wakes reads; all financial work remains durable server jobs. Keep cancellation and settlement activation scopes unchanged when testing visibility.

For local browser tests, install Chromium once with `pnpm exec playwright install chromium`, then run:

```sh
TEST_DATABASE_URL=postgresql://repopay:repopay@127.0.0.1:5433/repopay_test pnpm test:e2e
```

The harness builds web assets, binds loopback port 4317, migrates/seeds a unique test schema and mocks provider boundaries. It does not load `.env` or start a worker. Keep 4317 free. Traces and responsive screenshots are ignored under `test-results/`. Root `pnpm test` includes server and web DOM tests; `pnpm typecheck` and `pnpm build` include both packages. Live role/provider walkthroughs remain on the final checklist.

## Phase 10 recovery

Apply migration 0016 with `pnpm db:migrate`. Leave `RECONCILIATION_DISCOVERY_ENABLED=false` during deferred live testing; enabling it can discover PRs and enqueue sponsored reviews. Explicit interval/page/rate/attempt configuration remains required. Existing financial polling uses saved due times and is not disabled by this flag. New scheduler checkpoints and job insertion commit together; ordinary status replies remain visible while redundant refresh work is coalesced.

`pnpm ops:retry-job <failed-job-id>` is an operator CLI for safe read/projection retries, not a resend endpoint. See [operations](operations.md) before use. `pnpm test` includes a subprocess kill/restart harness against a uniquely named test schema; no production worker or provider is used. CI also installs Chromium and runs the isolated browser suite without fork secrets.

## Phase 11 deployment preparation

`pnpm db:check` compares database migration hashes/timestamps with the artifact. Server and worker startup now require a fully migrated compatible database; run `pnpm db:migrate` before starting a fresh local checkout. `/healthz` checks compatibility as well as connectivity.

`RECOVERY_MODE=normal` preserves local development behavior. Use `hold` on every restored service before connecting restored data; this blocks worker processing and HTTP mutations until provider effects since backup have been reconciled. The Render Blueprint starts held, with discovery/cancellation off and no settlement scope.

Hosted commands `pnpm start:hosted`, `pnpm start:worker:hosted` and `pnpm db:migrate:hosted` use environment settings directly, without requiring a local `.env`. Build first. The single web pre-deploy process migrates, then the same worker release starts after compatibility verification. Nothing is provisioned by these files alone; follow [deployment](deployment.md).

The deploy-compatibility test rehearses PostgreSQL 16 dump/restore only in a generated schema of the validated local test database. Locally it uses the existing Docker Compose `postgres` service; CI uses a matching PostgreSQL 16 client container against its local test service. Docker must be available. No personal credentials or actual providers are used.


## Final demo tooling

`pnpm demo:seed` previews two preparation issues without credentials or writes. Explicit issue creation is restricted to the isolated detached demo repository and requires the confirmation flags in [the demo guide](demo.md). It creates fresh ordinary issues, never a payment. No new environment variables are needed; GitHub CLI authentication is separate from the application and runtime sponsor.

Import the [Postman collection](../postman/repopay.postman_collection.json) for read-only local inspection. Its optional signed ping is inert, loopback-only and disabled by default; follow [the collection guide](../postman/README.md). Do not export a populated environment or cookies. Remaining live exercises stay deferred in the [final checklist](phases/live-walkthroughs.md).

## Exact-revision test context

The GitHub App needs **Contents: read-only** for bounded changed-test context. Existing demo access was verified October 31; no permission update was required. If installing a new App or upgrading permissions, approve the installation update after configuring it. Missing Contents access produces incomplete evidence, not a replacement token fallback. No additional environment variable, migration or increased model allowance is required for file reads. Limits and behavior: [ADR 0014](decisions/0014-exact-revision-test-context.md).

After pulling the pre-merge rejection update, run `pnpm db:migrate` before restarting the server/worker. Migration 0017 retains all existing review records and permits unmerged rejection records. No new environment variables or provider permissions are required.

PR-local feedback requires the demo installation to permit comment publication on pull requests. For the pre-merge rejection workflow set **Pull requests: Read and write**, retain Issues write/Checks write, and approve the installation permission update. The October 31 live installation with Pull requests read could read comments but received 403 when publishing the rejection acknowledgement. Permission changes must be approved on the installation, not only saved in App settings.

Prompt v3/source-context update needs no new environment variable or migration. Existing Contents read access is reused. New awards remain gated until v3 is explicitly accepted; do not change the evaluated profile constant merely to continue a demo. Model retries need an unexhausted approved allowance.

### Additional contributors

Apply migration 0018 with `pnpm db:migrate`. Before merging a multi-author PR, each additional API-identified commit author copies the `/bounty contribute [#issue] <head SHA> <base SHA> <reason>` command from the Repopay PR comment/check and posts a new PR comment. The bot supplies `/bounty confirm-contributor [#issue] @login <head SHA> <base SHA> <reason>` for a different write-authorized maintainer to post. Both commands require full current revision hashes and a reason of 10–2000 characters. Do not edit an old command or paste it in a quote/code fence. `/submissions/<submission-id>/contributors` remains an authenticated fallback. Any head/base change requires both confirmations again. Request a fresh review after confirmation within the approved sponsor allowance; confirmation alone does not invoke Copilot or authorize payment. Existing awards cannot be changed.

### GitHub-native work actions (ADR 0019)

After deploying this release, contributor declarations/maintainer confirmations, fresh review requests, status and rejection run through new PR comments. `/bounty cancel` cancels an unfunded draft on its issue directly; it cannot refund funded work. Funding, payouts and account/sponsor consent retain authenticated pages. No environment variable or migration is added. Prompt v4 retains contribution evidence; keep new settlement disabled until separately evaluated and accepted. Existing v3 evaluation results are not v4 acceptance.

### First-visit dashboard tour

Install the locked dependencies and run the existing `pnpm db:migrate` before starting this release (migration 0020). No new environment variables are required. The tour is shown at most once per GitHub account across browsers. Existing accounts are eligible on their first dashboard visit after this release. Presentation is recorded before display, so a lost response or mid-tour refresh can suppress the tour permanently. There is no replay/reset control.

Optional crypto funding: `PP_CRYPTO_ENABLED` defaults to false and requires migration 0023 plus PayPal sandbox merchant onboarding. Bounties and contributor payouts remain in USD through the existing PayPal flow. See [crypto setup](crypto-payments.md).

## PYUSD devnet development

The optional direct PYUSD route uses pinned `@solana/web3.js`, `@solana/spl-token` and `bs58` dependencies and migration 0024. Run `pnpm install --frozen-lockfile` after updating source. `pnpm pyusd:wallet` creates an ignored `.local/pyusd/treasury.json` test key with exclusive creation; it does not fund or broadcast. Configuration is `PYUSD_DEVNET_ENABLED=false`, `PYUSD_TREASURY_KEY_FILE=`, and `PYUSD_REFUNDS_ENABLED=false` by default. Keep private keys out of tracked files. Web and settlement worker must share the same database and treasury configuration.

Follow [crypto-payments.md](crypto-payments.md) for setup and limitations. Unit/integration tests use mocked providers and isolated SQL schemas; no live chain acceptance is implied. Never enable mainnet, replace an ambiguous transaction, or run a paid model/financial walkthrough as part of routine tests.

PYUSD devnet wallet signing uses the pinned Wallet Standard app/features packages. Use a current Phantom or Solflare extension exposing `solana:devnet`; no mainnet or network-unspecified transaction-signing fallback is offered. Expired preparations stop before the wallet prompt and retain their original transfer for reconciliation.

PYUSD checkout recovery requires migration 0025 through the existing migration command before restarting the local server. It adds immutable expired-attempt history; it does not clear holds or alter signed transfers. See [recovery design](decisions/0025-expired-pyusd-funding-recovery.md).

An explicitly approved isolated review retry can use `VERIFIER_REVISION_OVERRIDE` on the broker: a JSON object with `repoId`, `submissionId`, exact 40-character `headSha`, total `maxAttempts` (1–10), and UTC ISO `expiresAt`. It applies only to that revision until expiry; daily limits and settlement gates stay unchanged. Preserve prior attempts, including unknown outcomes, and remove the override after the authorized run. Workflow and broker releases must use matching verifier code; update the pinned Render task version when releasing the executor.
