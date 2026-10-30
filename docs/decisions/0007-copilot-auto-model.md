# ADR 0007 — Copilot Auto model for funded review terms

**Status:** Accepted by the user on October 29, 2026. Supersedes the fixed-model part of [ADR 0006](0006-fixed-lightweight-copilot-and-sponsorship.md) (decision items 1–2). ADR 0006's per-repository sponsorship, usage telemetry and attempt limits remain in force.

## Context

The project sponsor uses Copilot Free, which offers Auto only and returns an empty model catalog. The fixed `gpt-6-luna` policy made funding impossible on that account. The user decided to continue with the Free subscription and Auto.

Observed SDK behaviour (prototype, `@github/copilot-sdk` 1.0.28): a session created with `model: 'auto'` keeps reporting `auto` from `model.getCurrent()`. The serving model appears only in `assistant.usage` events (`data.model`; earlier probes reported `gpt-6-luna`).

## Decision

1. `COPILOT_MODEL=auto` is valid and is the funding default. New sponsored funding under Auto creates **version 4** terms, whose policy freezes `model: "auto"` together with the sponsor. Versions 1–3 and their hashes are unchanged; v2/v3 still reject Auto.
2. The sponsor callback and funding page skip the model-catalog check for Auto, because Free lists nothing. The first review proves access.
3. Each review requests `auto` and accepts a result only when exactly one concrete serving model is reported in usage events. Missing, `auto`-only or multiple serving models are a provenance error: no verdict is recorded and settlement stays pending. The persisted verification row stores the actual serving model.
4. Verdicts remain advisory. Auto does not change payment authority or the deterministic policy.

## Consequences

- The serving model can change between reviews of the same bounty, so quality is not pinned to one model. Each verification records its model, so drift is visible.
- GitPay cannot restrict which model Auto chooses before the call. A provenance failure may still consume sponsor usage.
- The Phase 5 evaluation gate must be redefined for Auto: three runs per fixture, recording the actual serving model per run. The 18-run Auto prototype (14/18) is the current baseline and does not pass that gate.
