# ADR 0005 — Copilot SDK with repository-sponsored verification

Status: accepted by the user October 28, 2026. Supersedes ADR 0003's Nemotron runtime selection; historical probe evidence and unrelated scoped preflight rules remain valid.

Repopay uses the official Copilot SDK for semantic verification. Native Copilot PR reviews remain a separate optional integration; their approval is not our financial verdict. The user chose repository-owner or organization sponsorship. Opening a PR does not charge the contributor or require their Copilot subscription.

## Authorized migration

Replace the existing NVIDIA adapter/configuration/model probes with a pinned Copilot SDK adapter. The current model implementation is a provider boundary and Phase 0 probe, not a complete PR verifier. The later Phase 5 collector, evaluations, Check Runs and settlement integration remain their own implementation scope.

Each request supplies an explicit sponsored credential and model. Disable ambient CLI credentials, host tools, skills, plugins and repository instruction discovery. Run in an isolated temporary workspace with a filtered environment; do not expose the app's PayPal credentials, GitHub private key or database URL. Validate structured output with Zod, bound input/output and elapsed time, stop the runtime on failure/timeout and never silently retry using another identity/model.

Personal testing uses an eligible consenting repository owner's GitHub App user/OAuth token. Organization automation requires the organization's enabled Copilot Requests permission and installation token. The SDK charges the authenticated identity under GitHub policy, not the PR's author field. The local Phase 5 verifier now selects the stored personal-owner grant bound into new v3 funding terms. Per-repository attempt caps and persisted SDK usage metrics are implemented locally; these metrics are Copilot billing units, not a monetary cap. Organization authentication, sponsor-revocation handling in the verifier and live validation are still open. Browser login sessions alone are insufficient; logout cannot silently substitute a developer's CLI account.

New funding terms identify Copilot and the explicitly configured model. Previously accepted Nemotron terms remain readable and retain their original hash and meaning. They must not be automatically evaluated under the new provider; require a compatible explicitly reviewed migration or keep verification pending. No rewriting of historical bounties or Phase 0 passing evidence.

The provider switch is accepted. The Phase 5 local PR evidence/verifier/Check Run pipeline now uses the separately stored repository-owner sponsor grant for v3 terms. Live fixed-model access, model quality, organization billing and complete sponsor-revocation handling remain unverified or unimplemented. SDK usage telemetry is stored in Copilot billing units; no hard app-specific monetary cap exists. No fallback inference uses the operator probe credential. Payment behavior and the existing payout-probe identity are unchanged.

## October 29 experiment scope

The user authorized a non-payment Auto prototype after the personal sponsor authenticated but returned an empty fixed-model catalog. Three live synthetic samples returned schema-valid expected verdicts. Usage events identified `gpt-6-luna`, while `model.getCurrent()` remained `auto`. This establishes limited Auto feasibility, not fixed-model access or production verifier acceptance. See [evidence](../evidence/copilot-migration.md#auto-prototype--october-29-2026).

The proposed first low-cost fixed model and customer sponsor flow are documented in [ADR 0006](0006-fixed-lightweight-copilot-and-sponsorship.md). Auto remains unselected for funded reviews. No existing funded terms may be silently migrated.

## Billing distinction

Native automatic Copilot reviews may attribute usage to the PR author; manual reviews attribute it to the requester, with organization-policy exceptions. Bot-requested native reviews are organization-billed. Copilot SDK requests use the credential supplied by Repopay. Our selected sponsorship therefore continues to use the owner/organization when an outside contributor opens a PR. Sourcery is a separate product with its own subscriptions; its billing must not be inferred from Copilot's rules.

## References

- [Copilot SDK OAuth](https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/github-oauth)
- [Organization authentication](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/server-to-server-tokens)
- [Native code review billing](https://docs.github.com/en/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/code-review)
- [SDK research](../copilot-verifier-research.md)
- [Migration plan](../phases/copilot-migration.md)
