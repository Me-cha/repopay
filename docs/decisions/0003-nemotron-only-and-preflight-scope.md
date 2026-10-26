# ADR 0003 — Nemotron-only runtime and provider-scoped preflight

**Status:** Accepted October 27, 2026, following the user's instruction to drop DeepSeek and complete Phase 0. Supersedes ADR 0002's model selection and fallback policy; its historical rationale and probe results remain preserved.

## Decision

Use only `nvidia/nemotron-3-ultra-550b-a55b` at `https://integrate.api.nvidia.com/v1`, configured with `NVIDIA_MODEL`. Remove `NVIDIA_PRIMARY_MODEL` and `NVIDIA_FALLBACK_MODEL` from active configuration. Each `completeNvidia` call makes one bounded attempt. Errors remain errors; there is no alternate model or automatic retry. This removes the repeatedly unavailable DeepSeek dependency instead of treating a failed primary as a passed gate.

Preserve the existing Nemotron request profile: Chat Completions, non-streaming JSON-schema request, temperature 1, top_p 0.95, explicit token/time/response limits, and `chat_template_kwargs.enable_thinking=true`. Validate the model, finish reason, refusal, JSON and caller-provided Zod schema. Never expose raw reasoning. A supplied schema and successful narrow probe do not establish provider-enforced schema guarantees or verifier quality. Phase 05 must evaluate Nemotron before automatic settlement; deterministic financial policy remains outside the model.

`parsePreflightEnv` validates only the settings consumed by GitHub App JWT authentication, NVIDIA and PayPal sandbox probes. It excludes webhook IDs/secrets, OAuth client secret, database and session/encryption settings. These are unrelated to the provider feasibility calls. `parseEnv` for application startup remains strict and still requires the future webhook/OAuth configuration. Provider-only parsing is not permission to disable webhook verification or use placeholder IDs. The existing logger also accepts the narrower validated configuration and preserves redaction.

The alternative of registering a nonfunctional webhook or inserting a dummy ID solely to pass preflight would misrepresent readiness. Keeping the full application schema as the CLI boundary would also unnecessarily block otherwise valid provider probes. Narrow validation addresses the actual dependency mismatch without implementing later phases.

## Evidence and limitations

See [Phase 0 provider evidence](../evidence/00-preflight.md) for actual command results, the successful sandbox payout and receiver receipt. Keep the existing durable payout identity; completing preflight must not create a new payment. The full documented 30-day duplicate window is not empirically elapsed, and the sandbox wallet balance discrepancy remains recorded despite the completed recipient receipt. Neither is silently represented as tested beyond the observed evidence.

Phase 0 completion does not authorize Phase 1, deployment or live payments. Webhook delivery, OAuth journeys and product verification evaluations remain owned by their later phases.

## References

- [Superseded NVIDIA decision](0002-nvidia-runtime-models.md).
- [NVIDIA Nemotron inference API](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-ultra-550b-a55b-infer).
- [Phase 0](../phases/00.md) and [setup](../setup.md).
