# ADR 0010: Cancellation evidence and refund boundaries

Date: 2026-10-30

Status: Accepted implementation of ADR 0001 for local Phase 8 verification. Live activation remains deferred by the user.

## Frozen terms and activation

Versions 1–4 explicitly disabled funded cancellation. Preserve their data and hashes: no existing bounty gains a refund option retroactively. New version 5 retains sponsored Copilot Auto and freezes cancellation enabled with a 72-hour notice. Creation requires `FUNDED_CANCELLATION_ENABLED=true`, independent operator IDs and a matching `CANCELLATION_SANDBOX_REPO_ID`. The runtime defaults remain disabled. General enablement still requires the real independent review/refund acceptance gate.

## Ownership and review

`cancellation/service.ts` owns authenticated requests, notice publication/recovery, evidence versions and reviewer-bound confirmation tokens. This consolidates the plan's proposed cancellation action modules without duplicating authorization. `cancellation/evidence.ts` reads bounded open/closed PRs, patches, current issue comments, same-repository claimed-fix references and saved submission evidence. It conservatively presents all repository PRs to the reviewer; absence of a closing link cannot prove irrelevance. Closed/edited/removed observations remain in append-only evidence. Changed or missing evidence invalidates approval. No AI output can clear a claim.

Authenticated comments by non-writers are retained. Human operators must assess every observed claim with a concrete evidence-bound dismissal reason; unknown access or truncated collection blocks approval. Conflict checks include creator, requester, funder and observed authors. Operators must verify chronology and no copied work. A checkbox is an accountable human attestation, not automated proof of an independent fix. Holds name a reviewer and future update time.

An App-authenticated notice marker recovers a lost comment response. The entire 72 hours starts at confirmed publication/recovery, never at request creation. The notice links to its persisted deadline. Worker polling collects objections even before review. Separate session advisory locks serialize publication and provider operations without keeping SQL transactions open across network calls.

## Refund allocation and provider uncertainty

Migration 0014 adds requests, append-only evidence/decisions and historical refund intents. Reservation locks the bounty using the same ordering as awards, checks fresh evidence, current independent reviewer, no award and full original capture, and moves APPROVED → EXECUTING / REFUNDING. It saves the immediate pre-reservation state/version. Only RESERVED with no submission boundary may be aborted and restored; changed evidence requires fresh review and a new audited intent.

Before POST the intent becomes MAY_HAVE_SUBMITTED with immutable request key, original capture, full integer cents and retry deadline. New evidence afterward never releases funds for an award. Known provider IDs use GET even when feature activation is disabled. Lost responses can retry the same identity within the saved conservative `PP_SAFE_RETRY_SEC` window only while authorization/evidence remain valid. Unknown, expired-window and failed outcomes retain their reservation; no automatic replacement operation exists. Completed refunds alone mark CANCELLED. Late evidence after submission remains an investigation, including after a completed refund; no automatic recovery is claimed. Funding history is retained and its old capture poll is deactivated when refund completion is confirmed.

PayPal documents [refund idempotency for up to 45 days](https://developer.paypal.com/api/rest/requests/) and [PENDING, COMPLETED, FAILED and CANCELLED outcomes](https://developer.paypal.com/api/payments/v2/definitions/refund/). Repopay uses its shorter configured window (at most five hours). The [sandbox capture refund endpoint](https://developer.paypal.com/api/payments/v2/captures-refund) receives no caller-selected replacement destination. These API shapes are validated locally with mocked responses; this is not live provider acceptance.

## Limits

GitHub and PayPal do not share a transaction. Last-moment unseen/deleted work and off-platform copying still require investigation. Bounded pagination, missing patches, unsupported references and access loss stop approval instead of proving absence. Evidence links currently accept exact issue/PR/commit URLs in the same repository; mirror an upstream fix into the isolated repository with provenance for review, rather than fetching arbitrary URLs. A failed or ambiguous refund requires investigation of the saved provider identity; there is no generic recovery/replacement endpoint.
