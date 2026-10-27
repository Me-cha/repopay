# GitPay server

`@gitpay/server` provides the Phase 0 foundation and Phase 1 unfunded draft workflow. [Setup](../../docs/setup.md) covers installation, local Postgres, configuration and provider probes. [Evidence](../../docs/evidence/00-summary.md) separates local verification from outstanding provider checks.

- `src/env.ts` validates explicit configuration; `src/log.ts` redacts secrets.
- `src/main.ts` owns startup/shutdown; `src/http/routes.ts` exposes `GET /healthz` and signed raw-body `POST /webhooks/github`.
- `src/domain/types.ts` defines integer cents, stable IDs and shared action contracts.
- `src/db/` owns the pool, transaction type, Drizzle schema and versioned migrations. Tables include deliveries, jobs, installations, bounties and activity.
- `src/models/nvidia.ts` owns bounded, validated NVIDIA Nemotron JSON-schema requests with one attempt.
- `src/preflight/` and `src/paypal/client.ts` implement isolated feasibility probes. Probe identity lives in ignored `.data/preflight/`, not product payment tables. These are not a production settlement service.
- `scripts/` provides migration/preflight entrypoints. `test/helpers/` owns synthetic configuration, network denial and unique-schema test fixtures; `test/unit/` and `test/integration/` hold behavioral coverage.

`src/github/` owns parsing, current access checks and serialized App-owned comments; badge operations live in `app.ts`. `src/jobs/` owns leased execution with heartbeat/fencing. `src/actions/` owns draft creation and status. `src/worker.ts` is the separate worker entrypoint.

Later phases add authenticated actions, contributor connection, verification and settlement. Business actions will own state transitions; transports delegate to them and external calls stay outside transactions. Update [AGENTS.md](../../AGENTS.md) and the plan target layout when adding modules.

Provider probes use `parsePreflightEnv` and need only their consumed provider settings. Phase 1 startup uses `parseGitHubRuntimeEnv` for consumed GitHub/database settings. Full `parseEnv` remains strict for later capabilities; see [ADR 0003](../../docs/decisions/0003-nemotron-only-and-preflight-scope.md).
