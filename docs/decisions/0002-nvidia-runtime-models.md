# ADR 0002 — NVIDIA-hosted DeepSeek with Nemotron fallback

**Status:** Superseded October 27, 2026 by [ADR 0003](0003-nemotron-only-and-preflight-scope.md). The decision below was accepted by the user October 26, 2026 and is retained as history. Supersedes the earlier v3/v4 selection of Claude through Anthropic for runtime verification. The prior selection is preserved here as history; ADR 0001's participation/cancellation policy is unchanged.

## Decision

Use NVIDIA's OpenAI-compatible hosted endpoint `https://integrate.api.nvidia.com/v1`, authenticated with `NVIDIA_API_KEY`:

1. Primary: `deepseek-ai/deepseek-v4.1-flash`.
2. Fallback: `nvidia/nemotron-3-ultra-550b-a55b`.

Codex remains the development assistant. No Anthropic key or SDK is required by the application. Existing unrelated values in the owner's local `.env` are preserved but unused.

The Phase 0 adapter uses Chat Completions JSON-schema requests (`response_format`) with non-streaming responses, temperature 1, top_p 0.95 and an explicit bounded output-token budget. Nemotron receives `chat_template_kwargs.enable_thinking: true`, as requested; its reasoning content is neither returned nor logged. Non-streaming collection allows validation of the complete result and finish reason before any caller can use it. Zod validates both the response envelope and final JSON; a supplied schema is not evidence of provider-enforced constraints.

`completeNvidia` attempts DeepSeek first. Only a network failure/timeout, HTTP 429 or server error can trigger one Nemotron attempt. Authentication, quota/payment-required responses, invalid request parameters, invalid/truncated output, refusals and model mismatch are errors. A valid negative verdict remains the result; never seek a more favorable fallback verdict. There are at most two generation attempts per call. A shared NVIDIA outage or account rate limit may affect both models.

`probeNvidiaModels` tests each model independently and reports failures individually, so a working fallback cannot conceal an unverified primary. Model-only probes work without GitHub/PayPal credentials. Full preflight remains read-only unless explicit generation/payment flags are supplied.

## Consequences and gates

The owner selected NVIDIA's available free API allocation. Availability, throughput and ongoing zero cost are not guarantees of this architecture. Calls use explicit timeout/response/token bounds and fail safely when service access is unavailable.

Phase 05 must reuse this bounded adapter, store the actual model/profile and attempt information, and evaluate **both** models separately for full/partial/fake/injected/unrelated/insufficient-evidence cases before either can support automatic settlement. The Phase 0 `{confirmed:true}` probe proves a narrow protocol path, not financial-verification accuracy. Model output remains advisory; existing policy and authorization guards control money.

The master plan's former Anthropic `input_schema`, forced-tool and one-retry recipe is superseded by this JSON-schema profile and one transient-failure fallback. Invalid model output stays an error/review case; it cannot cause payment. Bounty/award/refund guarantees are unchanged.

## References and evidence

- [DeepSeek NVIDIA inference API](https://docs.api.nvidia.com/nim/reference/nvidia-deepseek-v4_1-flash-infer).
- [Nemotron NVIDIA inference API](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-ultra-550b-a55b-infer) and [model usage](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-ultra-550b-a55b).
- [Current Phase 0 capability evidence](../evidence/00-preflight.md). Live results and unresolved provider gates belong there.
