# ADR 0008: Scoped Phase 6 sandbox acceptance

Date: 2026-10-30

Status: Accepted for the existing isolated demo by the user's instruction to proceed with Phase 6 and defer the remaining Phase 5 work. This supersedes the earlier instruction to finish all Phase 5 gates before activation; it does not mark those gates passed.

## Decision

Enable the existing default-off settlement scope only for bounty 1, repository `deepakA18/gitpay-demo-http` (1435468752), 5,000 USD cents and its exact frozen terms hash. Keep PayPal sandbox and the configured merchant binding. This accepts the evaluated Auto/prompt-v2/SDK-1.0.28 profile with the observed serving model `gpt-6-luna` for this demo only. No global profile acceptance or production rollout is authorized.

The application-adapter evaluation passed 18/18. The live PR has current RESOLVES evidence and successful external CI; real sponsor revocation blocked a review, and reconnection enabled successful review on a later revision. The second eligible contributor is unavailable; same-revision ERROR-to-success retry and other unchecked Phase 5 acceptance remain deferred, not passed. Organization support remains blocked.

## Settlement constraints

The existing capture, complete candidate scan, eligible-author checks, stable merge ordering, current evidence and sponsor checks, exact allocation and immutable award/payout identity remain mandatory. Scope activation alone creates no award: a qualifying merged PR is required. No funding terms, attempt limits or review history are rewritten. Removing the scope stops new automatic selections but does not void committed awards or stop their delivery reconciliation.

The $50 demo may proceed through merge, award and sandbox payout. Additional live funding/recipient scenarios still require concrete setup; unavailable delayed-claim or two-author walkthroughs cannot be reported as completed. Phase 6 completion remains tied to its recorded definition of done.

See [Phase 6 evidence](../evidence/06-summary.md) and [Phase 5 evidence](../evidence/05-summary.md).
