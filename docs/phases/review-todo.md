# Plan review remediation TODO

**Status:** Pre-build review complete; Phase 00 subsequently authorized October 26, 2026. This checklist tracks corrections from the pre-build review of the implementation plan. It is documentation work only; it does not authorize Phase 00 or any provider operation.

**Loop contract:** Work on one item at a time. Inspect the affected contract, update the canonical plan and phase files, run the focused documentation/consistency checks, then mark the item complete. Do not mark an item complete because a sentence was added without reconciling the dependent schema, state machine, phase gate and environment documentation.

## Ordered remediation

- [x] **R01 — Establish one canonical contract set.** Reconcile the master schema, shared vocabulary, phase refinements and repository maps. Remove contradictions instead of leaving the phase plan as an overlay. The phase refinements are now explicitly accepted as the pre-build contract; schema and module reconciliation continues in R02–R10.
- [x] **R02 — Repair durable operations and evidence history.** Add lease fencing, funding-attempt history, immutable submission evidence versions, refund-intent history and explicit financial intent states.
- [x] **R03 — Repair money and identity boundaries.** Encrypt payout destinations, snapshot them before submission, standardize stable IDs and define payable-author eligibility without trusting arbitrary co-author trailers.
- [x] **R04 — Freeze verification and payment policy.** Make CI semantics, truncation/insufficiency handling, model capability assumptions and funded policy terms explicit and immutable.
- [x] **R05 — Make the PayPal contracts executable on paper.** Specify return-token binding, webhook body preservation, provider status mappings, idempotency behavior and required negative cases.
- [x] **R06 — Complete the bounty and refund state machines.** Add later payout returns/reversals, refund reservation boundaries, request/base-state relationships and all recovery transitions.
- [x] **R07 — Define cancellation review operations.** Turn “credible,” “empty,” “copied,” “independent” and “unresolved” into an operator rubric with evidence, conflict and access rules.
- [x] **R08 — Reconcile dashboard scope and live updates.** Keep the dashboard read-only, remove deferred features from MVP architecture, choose Community Grid scope and define SSE behavior across processes.
- [x] **R09 — Complete configuration and operational gates.** Add test/reconciliation/provider limits to the environment contract and ensure setup, contribution and deployment docs name them consistently.
- [x] **R10 — Make the phase execution and schedule honest.** Separate demo-first sequencing from full MVP acceptance without weakening the final gates, and make cross-phase dependencies explicit.
- [x] **R11 — Run final documentation verification.** Check links, paths, headings, status claims, schema/state references and the working-tree diff; confirm no runtime implementation started.

## Checkpoints

- [x] **Checkpoint A:** R01–R04 complete; canonical domain, schema, identity and policy contracts agree.
- [x] **Checkpoint B:** R05–R08 complete; provider, state, cancellation and dashboard contracts agree.
- [x] **Checkpoint C:** R09–R11 complete; repository documentation is internally consistent and ready for user approval before Phase 00.

## Completion rule

This remediation list is complete only when every item and checkpoint is checked, the final verification commands have fresh output, and the phase index accurately reflects the state at the review checkpoint. Runtime work was not started at that historical checkpoint; current implementation status belongs to the numbered phase files.
