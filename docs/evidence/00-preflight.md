# Phase 00 external feasibility

**Status: PARTIAL — NVIDIA Nemotron verified for a narrow structured-output probe; DeepSeek inference and GitHub/PayPal gates remain open.** Updated October 26, 2026. No payout was sent.

The user replaced the Anthropic selection with NVIDIA-hosted DeepSeek/Nemotron and supplied `NVIDIA_API_KEY` locally. [ADR 0002](../decisions/0002-nvidia-runtime-models.md) records the accepted change; [setup](../setup.md) documents commands. The original Anthropic probe was never run and is superseded.

## Observed NVIDIA results

Endpoint: `https://integrate.api.nvidia.com/v1`. Only synthetic capability prompts were sent; no issue, diff, image attachment or repository content was uploaded. Secret values and reasoning traces were not logged.

| Check | Observed result |
| --- | --- |
| `pnpm preflight --model-only` (10-second read timeout) | Exit 0; exact DeepSeek and Nemotron model IDs both listed |
| DeepSeek initial JSON-schema request, 2048 tokens, 60-second timeout | Timed out after 60,005 ms; no completion received |
| `pnpm preflight --model-only --model-probe`, DeepSeek | Failed under a configured 120-second request limit; safe error reported transport failure/timeout, with no completion received (elapsed time was not recorded) |
| Plain DeepSeek request without response_format, “Reply with OK.”, 64-token cap | Timed out after 30,003 ms; no completion received |
| Nemotron initial JSON-schema request | HTTP 200, 1,451 ms, finish reason stop, validated `{confirmed:true}`; reported usage 32 prompt + 45 completion tokens |
| Nemotron implemented adapter probe | HTTP 200, 1,117 ms, finish reason stop, validated `{confirmed:true}` |

Adapter completion ID: `chatcmpl-b38a094d-0fdf-4015-bda6-61e46c5ad9ee`. No request-ID header was returned. The independent two-model probe exits 1 when DeepSeek fails even if Nemotron succeeds. No conclusion about the cause or duration of DeepSeek's unavailability is proven by these observations; the plain request timeout shows this was not limited to the JSON-schema request.

**Observed Nemotron profile:** `nvidia/nemotron-3-ultra-550b-a55b`, Chat Completions, `stream:false`, `temperature:1`, `top_p:0.95`, `max_tokens:2048`, `chat_template_kwargs.enable_thinking:true`, JSON-schema response format with strict request flag, application Zod validation. Returned model matched the requested ID. This establishes one narrow request/result path, not general server-side schema enforcement or bounty-verifier quality.

**DeepSeek profile remains unverified:** `deepseek-ai/deepseek-v4.1-flash` stays primary per the user. The adapter can fall back to Nemotron once on transient failures; mocked tests cover routing. A real end-to-end primary-timeout-to-fallback adapter call has not been separately run. Both models must pass the Phase 05 evaluation suite before automatic settlement.

## Remaining provider gates

| Required observation | Current evidence |
| --- | --- |
| GitHub App JWT accepted, expected App identified | Not run; credentials not configured locally |
| DeepSeek completed validated structured result | Not observed; model listing alone is insufficient |
| Nemotron structured result | Observed as above; Phase 05 verification evaluation still pending |
| PayPal sandbox authentication and Payouts capability | Not run |
| One 100-cent payout accepted, duplicate identity response | Mocked only; actual shape/status not observed |
| Recovery lookup, final item status and recipient receipt | Mocked only; no actual payout ID/receipt |
| PayPal deduplication window | Documentation says 30 days; local probe refuses sends at 29 days; account behavior not observed |

Phase 00 remains incomplete. Complete the remaining probes with locally configured credentials and retain redacted statuses/IDs. Do not record tokens, keys, recipient emails, reasoning traces or raw provider bodies here.
