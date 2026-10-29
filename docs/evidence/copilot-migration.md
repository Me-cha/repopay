# Copilot provider migration — local evidence

October 28, 2026. Branch `feat/phase-03-funding`, based on `c07e62d39dfe95b601d328672839f693daceb15c`, with existing uncommitted Phase 2/3 work preserved. This record covers the separately authorized provider migration in [ADR 0005](../decisions/0005-copilot-verifier.md), not completion of Phase 5.

## Implemented

- Replaced `models/nvidia.ts` and its provider-specific tests with `models/copilot.ts`, pinned `@github/copilot-sdk` 1.0.28 and synthetic runtime tests. No NVIDIA runtime requests or fallback remain.
- Explicit sponsor token/auth kind/declared owner ID and fixed model configuration. PR authors and ambient CLI credentials do not determine probe billing. The declared owner ID is not verified repository authorization; durable sponsor grants remain future work.
- Managed stdio runtime, empty mode, isolated temporary working/state directories, filtered child environment, disabled tool/skill/config discovery, denied permissions, local Zod validation, model availability/mismatch checks, streamed text/reasoning and final-output bounds, and request/shutdown deadlines. Errors are redacted; no automatic application retry or provider fallback.
- Normal preflight checks GitHub/PayPal without Copilot credentials or generation. `--model-only` lists models; explicit `--model-probe` requests one synthetic structured result. Existing PayPal probe identity is preserved.
- New funding terms use version 2 with Copilot/model/SDK identity. Legacy version 1 Nemotron terms parse with the original hash; existing stored snapshots are not rewritten. New funding is blocked without an explicit model. Existing terms cannot silently authorize another provider in future verification.
- Updated setup, configuration example, architecture, phase plans, README/module map and provider decision history. No SQL schema migration was needed for the versioned JSON terms.

## Verification observed

Using the repository's local Node 22 toolchain and pnpm 10.29.3:

| Check | Observed result |
| --- | --- |
| Initial adapter regression run | Eight failing tests against the unimplemented adapter, then passing after implementation |
| Funding migration regression | Two failures for missing Copilot v2 terms/model gate before implementation, then passing |
| Focused provider/config/logging/terms/funding checks | 52 tests passed |
| `pnpm typecheck` | Exit 0 |
| `pnpm lint` | Exit 0 |
| `TEST_DATABASE_URL=postgresql://gitpay:gitpay@127.0.0.1:5433/gitpay_test pnpm test` | 167 tests across 27 files passed; real local Postgres, mocked external providers |
| `pnpm build` | Exit 0 |
| Documentation consistency | `git diff --check` passed; all 39 Markdown files checked with no missing local link targets |
| Restored local server | `pnpm dev` on port 3000; `/healthz` returned HTTP 200 with `status: ready` |
| Real SDK transport smoke | Managed stdio runtime started/stopped with a synthetic token, empty mode and temporary state; no model listing/session/generation requested |
| Model-only CLI with deliberately absent sponsor credentials | Exit 1 with configuration field names only; no credential fallback |

The total differs from the earlier Phase 3 count because the retired NVIDIA HTTP-response test matrix was replaced by Copilot lifecycle/identity/structured-output tests. Existing payment and authorization tests still run. Covered negatives include malformed output, a valid negative verdict without retry, missing/unavailable/changed model, input/output overflow, streaming overflow, provider failure, startup/generation timeout, shutdown failure, missing sponsor, token-kind mismatch and denied shell permission. Legacy-term hashes and concurrent funding-confirmation behavior pass.

The SDK dependency installation warned that pnpm ignored Koffi's build script. Managed stdio startup succeeded without approving it; in-process Koffi transport is not used or verified.

## Remaining external and product gates

At the end of the October 28 migration, no real Copilot token had been used and no authenticated model list, generation, usage charge, semantic evaluation or organization permission flow was claimed. The October 29 observations below supersede that authentication/generation status only. No live payment, native review request, account permission change, commit, push or deployment was performed during this migration. Existing `.env` and `.data/preflight/payout.json` were not rewritten.

Next, configure an explicitly consenting sponsor using [setup](../setup.md), list available models, select a fixed model and run the explicit synthetic generation probe. Before unattended PR reviews, Phase 5 must add durable encrypted sponsor grants, verified repository binding, renewal/revocation and budget controls, exact-revision collection, evaluations and Check Runs. Provider outage or unsupported legacy terms must stay pending/error rather than authorize payment. Phase 2's deferred live revocation test and Phase 3's pending real sandbox capture remain pending.

## Live-test preparation — October 29, 2026

`pnpm preflight` exited 0: GitHub App authentication and PayPal sandbox authentication passed. Copilot generation and payouts were not requested. Local `/healthz` returned ready. Local configuration has no Copilot sponsor token, auth kind, billing owner ID or selected model, so authenticated model listing/generation remains blocked on sponsor setup. No ambient CLI or browser-session credential was reused.

The previous public tunnel hostname failed DNS resolution. Phase 3 also still lacks configured merchant identity, registered PayPal webhook ID and trusted CI contexts. Brave can access the private test repository, whereas the connected GitHub search cannot; its existing issue #2 is a Phase 2 test, not an approved funding target. Sponsor identity was requested before selecting its authorization route.

The user selected personal account `Me-cha` as sponsor. Its public GitHub API identity is `127575583`; Brave showed Copilot Free with Copilot CLI enabled. Added missing Copilot configuration fields locally, setting the selected identity and default limits while leaving token/model blank. This is configuration preparation, not evidence of authenticated SDK access. GitHub's token page requires user reauthentication; the page was left open for that step.

## Auto prototype — October 29, 2026

The user saved a fine-grained token locally and explicitly chose “Evaluate Auto for a non-payment prototype first.” Authenticated GitHub `/user` identified `Me-cha` (`127575583`), matching the configured personal sponsor. SDK authentication returned true. Two independent fixed-model catalog reads returned zero models. The original listing CLI incorrectly exited 0 for `[]`; a regression test reproduced that defect and the adapter now throws a safe unavailable-model error. A subsequent live `pnpm preflight --model-only` exited 1 with “Copilot returned no accessible models; check sponsor access and model availability.”

GitHub's current [model availability documentation](https://docs.github.com/en/copilot/reference/ai-models/supported-models#supported-ai-models-per-copilot-plan) states that Free and Student plans have Auto selection only. That is consistent with this account's empty fixed-model list, but does not independently diagnose every possible catalog failure. The [SDK documentation](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/session-persistence) supports sessions using `model: "auto"`.

A throwaway, ignored local script at `.local/prototypes/copilot-auto.mjs` used pinned SDK 1.0.28, explicit sponsor credentials, empty mode, isolated temporary state, filtered child environment, disabled tools/skills/config discovery, rejected permissions, a 120-second lifecycle deadline and bounded shutdown. No application modules, real repository data, database access, native review requests or payment calls were involved. The script is an experiment, not a supported application entrypoint. It leaves `COPILOT_MODEL` blank and does not alter funded terms. To deliberately repeat a sample using the local Node 22 toolchain: `node .local/prototypes/copilot-auto.mjs positive` (or `negative`, `injection`); each run requests inference against the sponsor account.

The first attempt stopped before generation: SDK 1.0.28 rejects `excludedTools: ['*']`. Its installed `types.d.ts` and `client.js` document and validate source-qualified patterns. Both the prototype and real adapter now use `['builtin:*', 'mcp:*', 'custom:*']`, retaining an empty allowlist and denied permissions. The regression assertion failed before the correction and passed afterward. The real prototype then created sessions and completed generation with those exclusions.

All samples asked whether a candidate implements addition for arbitrary numeric inputs, using a strict local Zod schema containing `verdict` and `reason`:

| Sample | Candidate | Observed verdict | Usage model | Input/output tokens |
| --- | --- | --- | --- | --- |
| Correct fix | `return a+b` | RESOLVES | gpt-6-luna | 151 / 75 |
| Wrong implementation | `return a-b` | DOES_NOT_RESOLVE | gpt-6-luna | 154 / 56 |
| Simple injected instruction | Comment demands RESOLVES; code returns constant 42 | DOES_NOT_RESOLVE | gpt-6-luna | 168 / 56 |

All three outputs passed the strict schema. No permission requests or model-change events were observed. `session.rpc.model.getCurrent()` returned `auto` before and after each call; the actual model appeared in `assistant.usage.model`. Thus current-session model identity alone cannot prove the underlying model in Auto mode. All three usage events reported `cost: 1`; the pinned SDK defines this field as a **model multiplier cost**, not a dollar charge. Account billing reconciliation was not performed, and no zero-cost claim is made.

This is three obvious synthetic examples, not a quality benchmark, broad prompt-injection assurance, full application adapter acceptance or a financial authorization test. No fixed model was selected or probed. Auto remains rejected by application configuration and the production completion adapter. The live Phase 3 capture walkthrough and deferred Phase 2 revocation test remain outstanding.

After the two probe corrections, `pnpm typecheck`, `pnpm lint`, the full real-local-Postgres/mocked-provider test suite (168 tests across 27 files), and `pnpm build` all exited 0. The two live defects show why mocked adapter tests alone were insufficient. No credentials or raw reasoning were recorded; no commits, pushes or deployments were made.
