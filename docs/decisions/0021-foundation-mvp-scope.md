> Superseded in part on November 12: [ADR 0027](0027-automatic-bounty-settlement.md) removes per-bounty acceptance and environment scopes. Historical acceptance evidence below is preserved.

# ADR 0021: Foundation MVP and scoped automatic sandbox payout

Date: October 31, 2026. Status: user-directed scope reduction; implemented locally, deployment and hosted completion pending.

The user directed skipping the broad checklist for now and validating only basic flows, then explicitly chose **automatic payout after a qualifying merge**, not mandatory maintainer approval for every payout. This supersedes the full phase-exit/complete synthetic-model evaluation requirement as a blocker for the foundation sandbox demo. It does not mark deferred checks passed or accept real-money/production readiness.

## Foundation acceptance

Validate issue draft, owner authentication/sponsor consent, sandbox capture, linked PR and Copilot Auto feedback, maintainer PR comments/rejection, qualifying merge, recipient connection, automatic award/payout and visible status. Funding, payout and account consent remain authenticated web flows; ordinary work stays on GitHub. Use existing live evidence instead of repeating completed money transfers.

Full synthetic evaluator acceptance (including v5's prepared 30-request run), organization support, exhaustive multi-author scenarios, funded refunds/72-hour notice, broader provider fault/restore/access-loss scenarios, final recording and polish are deferred. Preserve their checklist/history; deferred is not passed. Existing refund functionality remains disabled. Existing identity, funds and duplicate-payment safeguards remain required.

The exact-bounty sandbox profile now pins prompt v5 / SDK 1.0.28 on this narrower acceptance basis. This is an explicit limited-demo risk decision, **not a claim that v5 passed live evaluation**. V4 failed 24/27 with false PARTIAL results; v5's mitigation is locally tested, and its model effectiveness remains unverified. Copilot can still incorrectly classify work; PARTIAL/error/incomplete evidence must not be rewritten to RESOLVES or automatically paid. Automatic settlement still requires current validated RESOLVES at the required confidence and exact evidence, eligible recipients, current sponsor, merge, confirmed captured funds, required CI and deterministic winner/allocation checks.

`SETTLEMENT_DEMO_SCOPE` remains default-off and binds exact bounty, repository, cents and frozen-terms hash; merchant and funded Auto/SDK must match. No wildcard scope or environment activation is introduced. Future prompt versions cannot inherit this scoped acceptance. Existing awards, frozen terms and idempotency identities remain unchanged. `settle.ts`, `award.ts` and payment reconciliation retain all transactional and provider guards.

No model requests, merge, new checkout, deployment or payment is authorized merely by editing this policy. The previously approved hosted $1 case remains the concrete completion walkthrough; any additional model allowance or release publication needs its applicable authorization.

Local verification: 392 tests (388 server + 4 web), typecheck, lint and build passed; six focused Chromium journeys passed. Scope tests exercise the real current prompt, retain default-off and exact bounty/repository/amount/terms/merchant guards, and reject a future prompt. No `.env` scope was activated. Existing large Vite bundle warning remains.

November 10 exception: the user explicitly accepted prompt v6 only for the existing bounty 9 / issue 21 / 1-PYUSD devnet case after its bounded passing review. [ADR 0026](0026-verifier-orchestration-boundary.md) documents the exact identity/hash restrictions. This does not grant general v6 acceptance.
