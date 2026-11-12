# ADR 0027: Automatic settlement across funded bounties

Date: November 12, 2026. Status: user-authorized; locally verified; hosted rollout pending.

## Problem and decision

PR34 resolved issue33 and passed postmerge review, but no award was created:
the deployment selected bounty8 while the code separately accepted only two
named v6 cases. The user explicitly requested removing these demo restrictions.

Remove `SETTLEMENT_DEMO_SCOPE` and all hardcoded bounty/issue/amount/hash acceptance
exceptions. `SETTLEMENT_ENABLED` is a single deployment-level switch, false by
default. Once enabled, automatic selection considers every funded, unawarded,
unheld bounty. It needs no configuration for each issue, PR, amount or repository.
A bounded round-robin scan advances before external calls so blocked bounties do
not starve later ones. Restart/repeated scans remain protected by award locks and
unique committed-award identities. Within a bounty, existing stable qualifying
merge ordering is unchanged.

This supersedes the exact-bounty restrictions in ADRs 0008, 0021 and 0026; their
records remain historical. The currently reviewed contract is v6 / Copilot Auto /
SDK 1.0.28 with the existing accepted serving-model check. This is user-directed
foundation acceptance, not a claim of full model evaluation or production readiness.
Future prompt/SDK changes still require explicit validation; no request limits
or telemetry are altered and no new model request budget is granted here.

## Guards and lifecycle

Each bounty must match its own validated frozen terms (repository, issue, creator,
amount and currency). PayPal merchant binding remains required. PYUSD requires
explicit devnet enablement, pinned chain/mint and the live configured treasury
check. The provider boundary still rejects PayPal live endpoints and Solana mainnet.

Current sponsor authority, captured funding, complete exact-revision evidence,
CI, valid qualifying verdict, current merge, eligible contributor allocation,
rejection/cancellation guards, immutable recipient intents and idempotency remain
mandatory. Manual award approval uses the same profile switch. Unknown outcomes
stay pending reconciliation. No existing funding, review or payment record is
rewritten to satisfy the new configuration.

Disabling SETTLEMENT_ENABLED stops new awards; existing committed awards and
payout intents continue reconciliation. RECOVERY_MODE=hold retains its separate
restore-wide behavior. Legacy terms unsupported by the current verifier remain
blocked. Old failed reviews are not automatically converted into successful ones.

## Deployment

Remove the obsolete environment variable from web and worker configuration;
set SETTLEMENT_ENABLED=true on the runtime executing settlement and redeploy the
verified release. Executor configuration/prompt protocol are unchanged. No schema
migration is required. Inspect outstanding funded bounties first: this enables
all qualifying existing bounties, not only the last PR, and can resume their normal
sandbox payouts. Provider receipt must be independently checked afterward.

## Local verification

November 12: 503 server tests and 32 web tests passed (535 total); typecheck,
ESLint and the web/server build passed. Tests exercise different bounty IDs,
repositories and amounts, frozen-term mismatches, provider/chain restrictions,
round-robin scheduling and wraparound, held/draft/already-awarded exclusions,
concurrent single-award creation, missing captures, disabled settlement,
PARTIAL/error reviews and failed CI. Existing sponsor, recipient, refund and
payout idempotency regression suites remain passing. External providers were
mocked; this result does not prove hosted delivery or production readiness.
