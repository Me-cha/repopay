# ADR 0004 — Bound sandbox funding and conservative recovery

Status: accepted implementation refinement of the authorized Phase 03 contract, October 28, 2026. No change to open participation or refund authority.

A confirmation saves the exact issue criteria and policy hash, funding actor, merchant, amount, request keys and checkout origin before any provider call. Criteria are fetched outside transactions and their displayed hash is checked when preparing confirmation. The final confirmation consumes a hashed token and creates one active historical attempt under the bounty lock. Any currently authorized maintainer may confirm; the executing identity is saved as funder.

The bounded REST adapter uses PayPal Orders v2 `CAPTURE` intent, one purchase unit referenced by `gitpay:<attemptId>`, the terms hash as `custom_id`, and an explicit merchant. Return/cancel routes are `/bounties/:bountyId/funding/:attemptId/{return,cancel}`. They require a scoped session and matching `token`; GET never starts capture. The original origin is stored so retries do not change the order payload after a tunnel/configuration change.

Each order and capture POST has a separately persisted submission boundary and retry deadline. The configured maximum is five hours, leaving a margin below PayPal's six-hour request-key retention. The adapter checks the deadline again after authentication. An expired unknown operation can only be read/investigated. Missing order identity after an expired create is an explicit operator gap, not permission to replace the payment.

Funding attempts store the next reconciliation time. Worker polling recovers them without browser navigation or webhook delivery; verified events and `/bounty status` enqueue reads of the same identity. Session advisory locks serialize external operations without SQL transactions across the network; observation versions fence stale database commits. Bounty locks serialize capture reservation against draft cancellation.

Only one full, final, completed USD capture matching the purchase-unit reference, terms hash and receiving merchant funds the bounty. Gross principal, provider fee and net are distinct evidence; fees do not reduce the promise. Unexpected capture structures freeze disbursement. External refund/reversal or unknown capture status preserves confirmed funding and its history while setting a funding hold. Later award/payout modules must honor that hold; no award table exists in this phase.

The master sketch allowed confirmed declined/failed captures to return to OPEN when no principal existed. This implementation conservatively retains those attempts and capture reservations for investigation. It cannot issue a replacement charge automatically. Cost: recovery needs an operator workflow in a later phase. A voided, unsubmitted-to-capture order may close and be replaced without erasing history.

Required CI is configured by stable repository ID, exact check names and trusted producing App IDs, then frozen with policy version, thresholds, evidence limits, model identity, selection ordering and notice duration. Missing required CI blocks funding. Status-only provenance is not silently accepted. The model is not called by this phase.

PayPal signature verification embeds the original raw JSON event in `webhook_event`; only SUCCESS allows a minimal receipt and reconciliation job to be persisted atomically. Provider outages are retryable; no capture happens in intake. Per-worker polling and per-process verification concurrency are bounded. Multi-worker aggregate rate coordination remains an operational limit.

Sources checked October 28, 2026:

- [PayPal Orders OpenAPI](https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/checkout_orders_v2.json): request fields, six-hour key retention, order/capture states and seller-receivable breakdown.
- [PayPal webhook integration](https://developer.paypal.com/api/rest/webhooks/rest/): verification, original event content and retry behavior.
