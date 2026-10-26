# Phase 00 external feasibility

**Status: COMPLETE — Phase 00 verification gates and final review passed.** Updated October 27, 2026. Nemotron is now the sole model per [ADR 0003](../decisions/0003-nemotron-only-and-preflight-scope.md). GitHub authentication, Nemotron validated output, PayPal payout/duplicate/recovery and the recipient receipt are evidenced.

Initially, the user replaced the Anthropic selection with NVIDIA-hosted DeepSeek/Nemotron and supplied `NVIDIA_API_KEY` locally. [ADR 0002](../decisions/0002-nvidia-runtime-models.md) records the accepted change; [setup](../setup.md) documents commands. The original Anthropic probe was never run and is superseded.

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
| October 27 retry, `pnpm preflight --model-only --model-probe` | Exit 1; DeepSeek again reported transport failure/timeout under the configured 120-second limit; Nemotron validated in 1,581 ms |

October 27 Nemotron completion ID: `chatcmpl-18cb92a2-f4ab-47fa-ab35-d5ebc39561dc`; no request-ID header.

Earlier adapter completion ID: `chatcmpl-b38a094d-0fdf-4015-bda6-61e46c5ad9ee`. No request-ID header was returned. At that time, the two-model probe exited 1 when DeepSeek failed even if Nemotron succeeded. No conclusion about the cause or duration of DeepSeek's unavailability is proven by these observations; the plain request timeout shows this was not limited to the JSON-schema request.

**Observed Nemotron profile:** `nvidia/nemotron-3-ultra-550b-a55b`, Chat Completions, `stream:false`, `temperature:1`, `top_p:0.95`, `max_tokens:2048`, `chat_template_kwargs.enable_thinking:true`, JSON-schema response format with strict request flag, application Zod validation. Returned model matched the requested ID. This establishes one narrow request/result path, not general server-side schema enforcement or bounty-verifier quality.

**Retired DeepSeek profile:** `deepseek-ai/deepseek-v4.1-flash` never completed a validated inference in these probes. The user removed it from scope on October 27; it is no longer called or a completion gate. Its failures remain historical evidence, not a successful test. Nemotron still requires Phase 05 verifier evaluations before automatic settlement.

## Observed GitHub authentication — October 27, 2026

The owner created `gitpay-dev` and supplied its local RSA private-key file. The key and `.env` are ignored by Git and restricted to owner read/write permissions. App ID, slug, client ID and private key are configured locally; no secret values are recorded here.

An isolated read-only `GET https://api.github.com/app` returned HTTP 200 and matched App ID `5484420` and slug `gitpay-dev`. A second check loaded the saved `.env`, signed the JWT with `GH_CLIENT_ID` as issuer and used the same key normalization, request helper and API version (`2026-03-10`) as the preflight adapter. It again returned HTTP 200 with matching identity. Request ID: `C306:E75AA:2B52336:3F73B3D:6ADF9E08`.

This verifies App JWT authentication only. The combined `pnpm preflight`, installation access, OAuth and webhook delivery were not exercised. Webhooks were intentionally deferred during registration until the Phase 01 receiver is ready.

## Observed PayPal authentication — October 27, 2026

The owner configured sandbox client credentials and the recipient locally. An isolated call to the existing `paypalToken` adapter passed against `https://api-m.sandbox.paypal.com`: HTTP 200 with a validated Bearer access token. Credentials, token and recipient address were not printed or recorded. The recipient passed email-format validation; this does not prove account ownership or receipt. No payout was sent.

The local session secret, distinct encryption keys and a staged GitHub webhook secret were generated without exposing their values. The webhook secret has not been registered with GitHub. The owner subsequently saved a replacement `GH_CLIENT_SECRET`; presence is verified, but the OAuth flow has not been exercised. At that point, full application configuration reported only missing `PP_WEBHOOK_ID`, blocking the combined CLI. ADR 0003 subsequently separated provider preflight validation; application startup still requires the registered webhook ID.

The initial October 27 payout attempt was stopped locally by an unnecessarily restrictive Personal-account-only guard in an ad hoc probe command; this was not a PayPal rejection or a restriction in the application adapter. The owner clarified that the selected recipient is a sandbox Business account belonging to another developer. The restriction was removed from the probe command; the configured recipient was preserved. Business recipients are supported by PayPal Payouts; the Personal account remains the planned demo fixture, not a protocol requirement.

## Observed PayPal payout rejection — October 27, 2026

The existing `probePayout` adapter was invoked for the owner-selected sandbox recipient and 100 USD cents, using `.data/preflight/payout.json`. The identity was persisted before network calls. Token acquisition returned HTTP 200; payout creation returned HTTP 403 (request ID `f7815308dbdae`). A diagnostic retry reused the same persisted identity and again returned HTTP 403, request ID `f305999500e51`, error `PAYOUT_NOT_AVAILABLE`: "You live in a country that is not allowed to send this payout."

No batch ID, acceptance, duplicate-batch response, recovery snapshot or recipient receipt was obtained. This is a sender-country rejection, not evidence that Business recipients or recipients under another developer account are invalid. The earlier browser inspection showed the default sandbox sender region as IN; PayPal's [supported features](https://developer.paypal.com/payouts/supported-features/) lists India as receive/withdraw only. Its [sandbox account guide](https://developer.paypal.com/sandbox-testing/accounts) permits selecting a country for simulated test accounts. The next sandbox fixture needs a sending-supported region (for example US), with API credentials associated with that simulated Business account. This does not establish live-account eligibility.

Preserve the rejected probe state and evidence. Switching sender credentials must be treated as a new, explicitly identified test after recording these definitive rejections, not as a retry of an unknown payment. Do not delete the state to bypass its account-binding guard. The recipient owner will need to confirm receipt if a later payout succeeds.

## Observed PayPal payout success and duplicate format — October 27, 2026

The owner created a US Business sandbox account and its Merchant REST app, saved the new sender credentials, and selected their own Personal sandbox recipient. After verifying the new credentials, the previously rejected IN operation was preserved as `.data/preflight/payout-rejected-in-1a7ad32c.json`; it had two definitive HTTP 403 rejections and no batch ID. This was a new test with a different sender and recipient, not a retry of an ambiguous operation. The new durable identity is retained at `.data/preflight/payout.json`.

| Observation | Evidence |
| --- | --- |
| Amount and currency | 100 cents, USD |
| Persisted sender batch ID | `4d90081e-cabd-48f4-aaca-b41d3089b07f` |
| First payout creation | HTTP 201, request ID `f35314842c7e3` |
| Provider batch ID | `JYJ2VR5A7K2JA` |
| Immediate identical repeat | HTTP 400, request ID `f765520cfa1ab` |
| Read-only recovery | HTTP 200, request ID `ca50bd6d0aed7`; batch `SUCCESS`, single item `SUCCESS` |
| Item / transaction | `J5RA4W8PQYQ8Y` / `5PT77225AD003961F` |
| Corrected adapter replay | Exit 0; same saved batch, duplicate HTTP 400, item `SUCCESS`; lookup request ID `ca50bda114ffc` |

The actual duplicate body was `name=USER_BUSINESS_ERROR`, `message=User business error.`, with `details=[{field:SENDER_BATCH_ID, issue:Batch with given sender_batch_id already exists}]` and `links=[]`. A diagnostic repeat with the same identity confirmed this shape (request ID `ca50bd871ac47`). The original adapter expected a `DUPLICATE_BATCH_ID` code and rejected this response despite the already successful payout. Its parser now additionally recognizes this exact name/field/issue combination; unrelated errors still fail closed. No recovery link was supplied: the saved batch ID enabled lookup. If the original acceptance response is lost before its batch ID is persisted, this observed format still requires manual/provider-history reconciliation; it does not prove automatic recovery from that case.

Two new regression cases failed before the parser change, then passed. Three negative cases preserve rejection of wrong names, fields and issues. All 72 tests now pass; typecheck, lint and build pass. The first full-suite attempt had five `ECONNREFUSED` failures across health/migrations because Docker was stopped; after starting Docker/Postgres, all five and the complete suite passed. No production secrets were used by tests.

The user initially saw no change in the Personal account balance. A subsequent browser login to the configured Personal sandbox account independently confirmed Activity → Completed → Test Store → +$1.00, Payment Received, dated October 27. Its receipt shows Amount $1.00, Total $1.00 and recipient transaction ID `7M945748JT614432R` (distinct from the sender/API transaction ID). The Developer account-details page, recipient Summary and recipient Wallet all displayed $5,000 at inspection; the reason for that balance-display discrepancy is not established. No recipient email or login credential is recorded here. Immediate/recent duplicate rejection is observed, not a live test of the entire documented 30-day window.

## Final combined preflight — October 27, 2026

After the user dropped DeepSeek, the active configuration became `NVIDIA_MODEL=nvidia/nemotron-3-ultra-550b-a55b`. No alternate model is called. `parsePreflightEnv` validates only consumed provider dependencies; `parseEnv` retains full application requirements. No dummy webhook ID was added.

| Command | Actual result |
| --- | --- |
| `pnpm preflight` | Exit 0; GitHub auth OK, Nemotron listed, PayPal auth OK; no generation or payout requested |
| `pnpm preflight --model-probe --sandbox-payment` | Exit 0; GitHub auth OK, Nemotron validated in 1,557 ms, existing payout duplicate HTTP 400, recovered item SUCCESS |
| `pnpm typecheck`, `pnpm lint`, `pnpm build` | Passed |
| `TEST_DATABASE_URL=postgresql://gitpay:gitpay@127.0.0.1:5433/gitpay_test pnpm test` | 82 tests passed across 8 files |

Combined GitHub request ID: `C71C:350D96:2CC1608:4182324:6ADFACAC`. Nemotron completion ID: `chatcmpl-ae70a707-497b-419b-8a8e-930f21c3af52`. PayPal recovery request ID: `ca50beeee5feb`. The combined payout probe reused sender batch `4d90081e-cabd-48f4-aaca-b41d3089b07f` and provider batch `JYJ2VR5A7K2JA`; no new payment was created.

## Gate evidence and limits

| Required observation | Current evidence |
| --- | --- |
| GitHub App JWT accepted, expected App identified | Isolated identity checks and combined CLI authentication passed |
| Active model completed validated structured result | Nemotron passed through the combined CLI; DeepSeek explicitly retired |
| PayPal authentication and Payouts capability | US sandbox sender authenticated; 100-cent payout accepted and item reached SUCCESS |
| Duplicate identity response and recovery | HTTP 201 then duplicate HTTP 400; repeated combined CLI recovers the same saved batch |
| Recipient receipt | Independently viewed Personal sandbox Activity/Completed receipt for $1.00, transaction `7M945748JT614432R` |
| PayPal deduplication window | Immediate/recent repeats rejected; documented 30-day window and local 29-day cutoff, full retention duration not empirically elapsed |

The saved-batch recovery path is verified; recovery from a lost acceptance response without a saved batch ID remains manual because the observed duplicate response has no link. The recipient receipt is complete, although the sandbox wallet's unchanged $5,000 balance remains unexplained. Webhook registration/delivery, OAuth journeys, hosted CI/deployment and verifier-quality evaluations belong to later phases and are not claimed here. Phase 01 remains unauthorized and not started.
