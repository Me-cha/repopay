# Copilot provider migration implementation plan

**Status:** Local migration implemented and checked. Personal sponsor authentication and three live non-payment Auto samples passed October 29; fixed-model availability and production verifier compatibility remain pending. See [evidence](../evidence/copilot-migration.md).

**Goal:** Replace the existing NVIDIA provider implementation with Copilot SDK, preserving financial rules and historical evidence.
**Architecture:** Explicit repository-sponsored credentials; isolated tool-free runtime; bounded schema-validated results. Funding terms retain provider/model identity. The full Phase 5 pipeline remains future work.
**Tech stack:** TypeScript, Node 22, Zod, pinned @github/copilot-sdk 1.0.28, Vitest/Postgres.
**Spec:** [ADR 0005](../decisions/0005-copilot-verifier.md), accepted October 28, 2026.

## Scope and checks

- [x] Adapter/config: replace models/nvidia.ts with models/copilot.ts; use explicit credentials/model, no ambient identity, empty mode and no tools, isolated cwd/environment, bounded lifecycle and schema output. RED→GREEN tests for valid/negative results, schema failure, missing model, provider outage, timeout, denied tools, output size and cleanup.
- [x] Preflight: migrate model listing and explicit model-probe to Copilot; GitHub/PayPal-only preflight must not require Copilot credentials or generate output. Preserve durable payout identity. Test no accidental model generation or payment.
- [x] Terms: create version 2 Copilot terms while keeping version 1 Nemotron terms and hashes readable; do not mutate historical snapshots. Test new provider/model binding and legacy parsing/hash preservation.
- [x] Documentation: supersede ADR 0003, update architecture, Phase 5, environment examples, setup, READMEs and repository map. Retain historical evidence and disclose live Copilot verification pending.
- [x] Run relevant tests, typecheck, lint, full tests and build; record actual outcomes. No commits/pushes/deployment/account changes included.

Review focus: token or environment leakage into runtime, unbounded pending SDK start/send/stop, implicit model/credential fallback, billing identity changing with PR author, old funding terms silently changing providers. Live provider probe requires an explicit sponsor credential and available model; do not fabricate success or insert placeholder secrets.

## Authorized Auto experiment — October 29, 2026

The user chose “Evaluate Auto for a non-payment prototype first.” The isolated throwaway experiment passed correct-fix, incorrect-fix and simple injected-instruction samples with strict JSON validation. Usage events reported `gpt-6-luna`; session model queries still reported `auto`. This does not authorize Auto in funding terms or the production adapter. See the [live evidence and limits](../evidence/copilot-migration.md#auto-prototype--october-29-2026).

Local regressions now total 168 passing tests. Empty model catalogs fail preflight, and tool exclusions use the SDK-supported source-qualified patterns. A real fixed-model probe, durable sponsorship and the full Phase 5 evaluations remain open.
