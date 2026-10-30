# Proposed ADR 0006 — Fixed lightweight Copilot model and repository sponsorship

**Status:** Fixed-model items 1–2 superseded by [ADR 0007](0007-copilot-auto-model.md) (Auto, October 29, 2026); sponsorship and telemetry items remain accepted. Original status: Accepted direction; owner-sponsor onboarding slice implemented locally October 29, 2026. `gpt-6-luna` is the fixed first candidate. This decision does not authorize subscription purchases or live payments, and the implementation has not been verified.

## Context

GitPay's current adapter and funded terms expect one explicit Copilot model. The sponsor account (`Me-cha`) is on Copilot Free, whose model access is Auto-only, so the fixed-model list is empty. In three authorized, non-payment synthetic probes, Auto selected `gpt-6-luna`; the structured output passed the local schema. These simple samples do not establish quality on real code reviews.

GitHub currently describes GPT-6 Luna as a lightweight, cost-efficient model and documents its availability on Copilot Pro and higher plans. Published default-context rates are $0.10 per million input tokens and $0.50 per million output tokens. Rates, included AI-credit allowances, model availability and additional-usage settings may change. A model multiplier in an SDK usage event is not a currency amount.

GitPay's `.env` currently has one Copilot sponsor token. Putting the developer's token there means all reviews on that server consume that account's Copilot allowance. Installing the GitPay repository App does not change which Copilot account pays. ADR 0005 already selected repository-owner or organization sponsorship for the eventual service; multi-customer credential handling is not implemented.

## Decision proposed

1. Use **fixed `gpt-6-luna`** as the first candidate for a controlled verifier evaluation. Do not use Auto for funded review terms. Confirm exact SDK model ID availability with the intended sponsor before enabling funding. If the model is not listed, fail closed and resolve sponsor access; do not silently use Auto.
2. Keep the existing funded-terms model binding. Each new bounty records the explicit model in its terms. Do not reinterpret or rewrite historical Nemotron v1 terms or any already-funded terms. Since no Auto terms have been accepted or funded, this proposal does not create an Auto terms version.
3. Evaluate GPT-6 Luna on Phase 5 fixtures before allowing its verdicts to participate in settlement: full fix, partial fix, unrelated change, fake fix/test removal, injected instructions, and incomplete evidence. Until these pass, show results as advisory and require the existing review gate. Three arithmetic examples are capability smoke tests only.
4. A model mismatch or missing provenance does not mean the contributor's PR is bad. Preserve any result for diagnostics, mark that verification attempt unavailable/untrusted, and leave settlement pending for review. A valid `DOES_NOT_RESOLVE` is a verifier verdict under the tested model/profile; it is distinct from provider/configuration failure. Neither model output nor error may move money directly.
5. For customer onboarding, support an explicit sponsor per repository. The personal repository-owner OAuth path now has a separate consent state, durable encrypted rotating credentials, owner/repository checks, fixed-model access validation, disconnect, and sponsor/model snapshots in new v3 funding terms. Organization installation billing remains to be implemented. Contributors' credentials are never used.
6. Treat the current single `.env` token as a development-only sponsor. Do not advertise per-customer billing or let that global token silently sponsor public customer repositories. If GitPay intentionally centralizes sponsorship later, disclose that the operator pays and implement product-side quotas/pricing before opening it to customers.
7. Persist per-verification usage metrics (model, token/cache counts, nano-AIU, premium-request cost, latency and request identity) against the repository, sponsor and PR revision. The SDK reports these as Copilot billing units, not USD. Deduplicate jobs by revision, cap evidence/output, bound attempts, and stop scheduling when authorization or configured limits are unavailable. SDK usage metrics do not guarantee a hard monetary cap; GitHub account/organization billing settings remain authoritative. See [Copilot SDK usage and billing metrics](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/usage-and-billing).

## Alternatives considered

- **Keep Auto.** It works with the tested Free account, but the serving model can vary and the user wants a predictable lower-cost model. It also provides no pre-call model restriction through the current integration.
- **Use a fixed higher-cost model.** This improves neither access nor validated review quality enough to justify the cost before evaluations.
- **Keep one global personal token for all repositories.** This is simple for a private prototype, but bills Me-cha for every review and does not meet the selected repository-owner/organization sponsorship design.

## Consequences and gates

For the personal live test, Me-cha needs an account/authorization that exposes GPT-6 Luna as an explicit model; GitHub documents Copilot Pro as eligible. Do not upgrade or enable extra AI-credit spending without the account owner's choice. Otherwise, use an eligible organization sponsor. A fixed-model probe and the full semantic evaluation still need to run under the intended sponsor before verifier results can support payment decisions.

The personal owner OAuth slice and local PR verifier are implemented but unverified against a real fixed-model sponsor. The adapter persists SDK usage telemetry and enforces per-repository UTC-day/per-SHA request limits; organization sponsor authentication, sponsor-revocation handling, semantic evaluation, terms review and live model capability proof remain open. The SDK metrics are Copilot billing units, not currency and not a hard spend cap. GitHub's organization Copilot Requests permission is read-only in GitPay's code scope but can incur organization AI-credit usage; its budgets are controlled by the organization's Copilot settings, not per app installation. Until the remaining prerequisites are complete, GitPay is not ready to advertise production Copilot sponsorship. Existing v1/v2 funded terms remain unchanged.
