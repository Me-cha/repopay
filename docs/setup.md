# Local setup and provider feasibility

Phase 0 provides a health server and database foundation. Bounty creation, authentication pages, workers, funding and product payouts are later phases. See [phase status](phases/00.md) and [verification evidence](evidence/00-summary.md).

## Install and run locally

Use the Node 22 version in `.node-version` and pnpm version in the root `packageManager` field. Install/activate those with your normal version manager. Docker Desktop or another working Docker Compose daemon is required.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
chmod 600 .env
docker compose up -d
# Once Postgres is healthy; run this once for a new volume:
docker compose exec -T postgres createdb -U gitpay gitpay_test
pnpm db:migrate
```

Do not overwrite an existing `.env`. Compose exposes PostgreSQL 16 only on `127.0.0.1:5433`, with development-only credentials. The primary database is `gitpay`; tests use `gitpay_test`. `createdb` reports an error if the test database already exists; retain the existing database. Migrations are versioned and rerunnable. Test migrations use `TEST_DATABASE_URL` and an isolated schema through the test helper, never the primary migration command.

Populate the blank secrets/model in `.env` before `pnpm dev` or `pnpm start`. Both startup and preflight validate configuration. `GH_PRIVATE_KEY` can contain literal `\n` escapes in one quoted line; the probe converts them to line breaks. Generate separate 32-byte base64 values for `TOKEN_ENC_KEY` and `PAYMENT_DATA_ENC_KEY`, and random 32-byte or longer session/webhook secrets; keep them local. The encryption keys must differ. Funded cancellation stays disabled.

```sh
pnpm dev
# In another shell:
curl --fail http://localhost:3000/healthz
# Or build, then run the compiled server:
pnpm build
pnpm start
```

Health responds with `{status,version}`: HTTP 200 when Postgres is reachable and 503 when unavailable. SIGINT/SIGTERM stops HTTP and closes the pool. The health route does not call GitHub, PayPal or NVIDIA.

## Offline checks

Tests do not load `.env` or use provider credentials. Unit fixtures use explicit synthetic configuration; integration tests require real local Postgres. Each fixture creates a unique schema and drops only that schema. Remote URLs, database names without `_test`, and URL query options are refused before fixture creation/reset.

```sh
export TEST_DATABASE_URL=postgresql://gitpay:gitpay@127.0.0.1:5433/gitpay_test
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Missing database configuration fails integration tests. Nock rejects unmatched external HTTP requests. CI supplies PostgreSQL and the test URL; it needs no provider secrets and does not run feasibility probes. GitHub-hosted CI itself is not verified until this branch is pushed under separate authorization.

## Configure provider accounts

1. **GitHub:** create the App/demo installation described in [architecture section 3](../IMPLEMENTATION_PLAN.md#3-external-setup-human-does-this-codex-documents-it-in-readme). Put its App ID, slug, private key, client ID/secret and webhook secret in `.env`. The Phase 0 probe signs a JWT and reads `/app`; installation access and user OAuth are verified in later phases. No bot comments are posted.
2. **PayPal:** use a sandbox REST app and business account with Payouts enabled and sufficient sandbox balance. Set `PP_CLIENT_ID`, `PP_SECRET`, `PP_WEBHOOK_ID`; keep the exact sandbox `PP_BASE`. Prepare a personal sandbox recipient account. A successful OAuth token alone does not establish Payouts capability.
3. **NVIDIA:** set `NVIDIA_API_KEY`. The template pins `NVIDIA_PRIMARY_MODEL=deepseek-ai/deepseek-v4.1-flash`, `NVIDIA_FALLBACK_MODEL=nvidia/nemotron-3-ultra-550b-a55b`, and `NVIDIA_BASE=https://integrate.api.nvidia.com/v1`. See [ADR 0002](decisions/0002-nvidia-runtime-models.md). The current application does not read Anthropic credentials.

Never paste credentials into chat or evidence files.

## Explicit probes

From the repository root, `pnpm preflight` reads GitHub App metadata and NVIDIA's model list, and obtains a PayPal OAuth token. It does not submit a payout or generate model output. Model-only mode needs just the NVIDIA fields and response-size bound, so it works while GitHub/PayPal setup is pending.

```sh
pnpm preflight
pnpm preflight --model-only
pnpm preflight --model-only --model-probe
# Run model generation checks alongside the other configured providers:
pnpm preflight --model-probe
```

The explicit model probe calls **both models independently**, with synthetic text only. It uses OpenAI-compatible Chat Completions, `response_format.type=json_schema`, non-streaming output, temperature 1 and top_p 0.95. Nemotron enables thinking, but raw reasoning is not returned/logged. `NVIDIA_MAX_TOKENS` bounds generated output (template: 2048); `NVIDIA_TIMEOUT_MS` bounds each attempt (template: 120000 ms). The probe requires a completed, non-refused response from the requested model whose content parses to exactly `{confirmed:true}`. It exits nonzero if either model fails. A listed model alone does not establish inference or structured-output capability.

The application adapter tries DeepSeek first and Nemotron once after a timeout/network failure, HTTP 429 or server error. Other HTTP errors and malformed/truncated model output stay errors. A valid negative answer never triggers fallback. The independent probe deliberately bypasses fallback to expose each model's capability. These are bounded requests using the owner's NVIDIA account allocation; do not assume unlimited free availability. The former `--anthropic-probe` / `--tool-choice` flags have been replaced by `--model-probe`.

For the sandbox payment probe, set `PREFLIGHT_SANDBOX_RECIPIENT` in local `.env` to an explicitly selected **sandbox** recipient address, then run:

```sh
pnpm preflight --sandbox-payment
```

This sends one 100-cent USD payout operation and repeats the same `sender_batch_id` to observe provider duplicate handling. The request body is identical on repeat. It then reads the batch/item status. Only an observed item `SUCCESS` and the corresponding sandbox recipient receipt establish delivery; `PENDING`, `UNCLAIMED`, errors or a batch-level `SUCCESS` alone do not. Run the same command again to reconcile/recheck the same identity while inside its safety window.

The ignored `.data/preflight/payout.json` contains immutable operation IDs, amount, creation time, hashes binding account/recipient and a recovered batch ID. It is written/fsynced before the request, with restrictive file permissions and an exclusive lock. Raw recipient addresses and access tokens are not persisted. Keep this state: deleting it can create another payout. Do not change accounts/recipients, rename the state, or run from a fresh checkout to retry an ambiguous operation. These local files are only for the single-machine Phase 0 probe; product intents will live in Postgres.

The CLI refuses resubmission at 29 days, providing margin before PayPal's documented 30-day deduplication window. If a process crashes, inspect its state and provider history before removing a stale `.lock`; never erase the identity. After expiry, use PayPal's sandbox portal or authenticated read-only batch lookup for reconciliation, not another send. Missing/untrusted recovery links or unexpected response schemas fail closed. Actual retention/duplicate behavior remains an external evidence requirement.

Record redacted request/batch/item IDs, HTTP statuses, actual duplicate response shape, recipient receipt and model profile in [00-preflight.md](evidence/00-preflight.md). Provider response bodies, emails, keys and tokens stay out of tracked evidence and logs. All external gates must pass before Phase 01.

## Configuration bounds

`.env.example` contains explicit values; `src/env.ts` is the validation source of truth. Timeout, body/response size, job lease and reconciliation settings are bounded positive integers. `PROVIDER_RESPONSE_MAX_BYTES` bounds streamed probe responses; `PROVIDER_TIMEOUT_MS` bounds GitHub/PayPal requests; `NVIDIA_TIMEOUT_MS` separately bounds each model request/read. Money is bounded integer cents; keys decode to exactly 32 bytes; stable IDs remain strings. Cancellation operator IDs are required only when enabled, and the notice value is fixed at 72 hours.

## Provider references checked

- [GitHub App JWT authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app) and [authenticated App endpoint](https://docs.github.com/en/rest/apps/apps#get-the-authenticated-app).
- [PayPal create payout and deduplication](https://developer.paypal.com/api/payments.payouts-batch/v1/payouts-post), [batch lookup](https://developer.paypal.com/api/payments.payouts-batch/v1/payouts-get), and [official OpenAPI schema](https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/payments_payouts_batch_v1.json).
- [NVIDIA DeepSeek API](https://docs.api.nvidia.com/nim/reference/nvidia-deepseek-v4_1-flash-infer) and [NVIDIA Nemotron API](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-ultra-550b-a55b-infer).
- [Drizzle migrations](https://orm.drizzle.team/docs/migrations).
