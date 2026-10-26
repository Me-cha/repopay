# Plan review remediation TODO

**Status:** Documentation review complete; ready for Phase 00 when implementation is authorized. This checklist tracks corrections from the pre-build review of the implementation plan. It is documentation work only; it does not authorize Phase 00 or any provider operation.

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

This remediation list is complete only when every item and checkpoint is checked, the final verification commands have fresh output, and the phase index still says implementation has not started.


## Final cross-phase review — 2026-10-26

Reviewed README, the full canonical architecture/schema/state machines, ADR 0001, all 13 phases and 57 tasks, configuration, contribution instructions and module placeholders. The working tree was clean before review. This review changes planning documents only; no packages, accounts, runtime or payment operations were created.

**Outcome:** Ready to start Phase 00 when authorized. No additional general planning review is required for the unchanged scope. This is design readiness, not proof of runtime correctness or provider feasibility. Phase tests and real integration gates remain required.

### Findings resolved in the canonical plan and owning phases

| Finding | Impact if left unresolved | Resolution / owners |
| --- | --- | --- |
| Retry identity outlives provider dedupe retention | Same-key POST can duplicate a transfer after retention | Persist submission boundaries/deadlines; expired ambiguity is read/review-only (03, 06, 08, 10) |
| Missing payout uniqueness and outcome fencing | Duplicate recipient rows or stale reads overwrite returns | Unique award/recipient intent; immutable batch; observation-version CAS; history (03, 06) |
| Successful payouts excluded from recovery | A missed return webhook leaves a false PAID status | Rotate through completed deliveries; preserve award and reopen attention (06, 10) |
| Notice clock starts before publication | Failed bot delivery consumes the contributor objection window | Confirm App-authored notice and publication time before starting 72 hours (08, ADR clarification) |
| Refund reservation disagrees with request state | APPROVED/EXECUTING divergence and stale state restoration | Atomic EXECUTING/REFUNDING reservation; save immediate prior state; abort only proven unsent work (08) |
| Cancellation enablement requires a refund while refunds are disabled | Phase gate cannot be completed | Isolated authorized sandbox validation after local safety checks; broader enablement after real gate (08, config) |
| CI ignores synthetic merge SHA, producer identity and completion wakeups | Ordinary PR CI gets stuck, or unrelated success qualifies a payout | Freeze CI contexts/provenance; bind tested head/base; completion events; pagination/fork cases (00, 03, 05–07) |
| Filtered/missing patches and API author association treated as proof | Incomplete evidence or spoofed attribution can auto-pay | Explicit sufficiency/provenance; uncertain attribution remains review; no code execution (05–07) |
| Same-minute connection dedupe suppresses needed work | A committed award remains stranded after connection | Connection-activity keys plus periodic awaiting-claim scan (04, 06, 10) |
| GET return captures; browser absence not covered | Navigation becomes an action trigger or checkout never completes | Read-only return and durable independent approval polling (03) |
| Floating arithmetic sketch conflicts with exact allocation | Invalid weights, rounding or locale changes affect recipients | Fixed-precision integer weights, BigInt remainders, deterministic byte-order ties and properties (06) |
| Mutable preview and rotating OAuth token races underspecified | Recipient substitution or valid session destroyed on refresh | New token for changed allocation; serialized refresh/CAS; privacy headers (02, 07) |
| Marker spoofing and SSE commit-order assumptions | False notice/receipt or missed live updates | App-author checks; serialized projections; periodic authoritative scoped refetch (01, 08, 09) |
| Backup can omit already-sent provider operation | Restore can reissue money | Disable new financial submission until provider history since backup is reconciled (11) |
| Community dashboard calls for Enterprise Master Detail | Unplanned paid dependency | Separate React detail panel, Community-only imports (09) |
| Missing optional skills and incomplete target module map | Implementation stalls or invents ownership | Direct task execution; corrected planned module groups; 57 tasks retained (00–12) |

### Phase disposition

| Phase | Review result / implementation gate |
| --- | --- |
| 00 | Ready: isolated tooling/database and actual GitHub/Anthropic/PayPal capability evidence; no assumption that credentials exist |
| 01 | Ready: atomic intake/jobs, permission-checked drafts and trusted projections |
| 02 | Ready: browser-bound auth, serialized refresh, immutable previews and current authority |
| 03 | Ready: frozen displayed terms, independent capture recovery and endpoint-specific retry safety |
| 04 | Ready: encrypted self-declared destination and reliable claim wakeups; no ownership-verification claim |
| 05 | Ready: complete revision/provenance evidence, meaningful CI, bounded Claude verification and real evals |
| 06 | Ready: exact allocation, stable winner, unique immutable award/intents and later-return detection |
| 07 | Ready: full-amount review through the same guards, no mandatory-CI bypass or mutable allocation |
| 08 | Ready: published notice, independent review, precise reservation boundary and isolated real validation |
| 09 | Ready: Community-only read UI, scoped DTOs and eventually correct live updates |
| 10 | Ready: cross-phase fault/reconciliation cases including completed and awaiting operations |
| 11 | Ready: hosted sandbox and restore reconciliation; deployment/account authorization still required |
| 12 | Ready: W01–W16 evidence matrix and accurate demo; no partial success presented as complete MVP |

### Remaining implementation gates, not another planning cycle

- Owner-provided GitHub App/demo identities, Anthropic access/model and PayPal sandbox Payouts capability. Phase 00 must prove these; a failed capability check can require a specific design decision.
- Independent operator and a genuinely elapsed 72-hour published notice for the real refund gate. This is a scheduling constraint, not something a test clock can satisfy.
- Runtime tests, database concurrency tests, model evaluations, sandbox receipts and hosted restore evidence. None have run because no application exists.
- Payment destination ownership is self-declared. GitHub author association is not cryptographic proof. Maintainer review is a trust boundary; the system cannot prove unseen work, force merges or recover completed refunds automatically.
- Fees are platform sandbox-balance costs; the promised principal is unchanged. Unexpected capture reversals/out-of-band refunds remain held incidents, not automatic debt collection or live-money guarantees.
- Hackathon deadline/eligibility and hosting capacity remain explicit Phase 11/12 checks; this review does not verify contest participation or buy hosting.

### Official references checked for this review

- PayPal documents bounded sender-batch deduplication and an original-batch link; this supports the explicit expiry guard, not indefinite idempotency. [Payout batch header](https://developer.paypal.com/api/payments.payouts-batch/v1/definitions/payout_batch_header/).
- GitHub documents PR workflow merge-SHA behavior; CI must bind the tested revision rather than assume every result lives on the PR head. [Workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
- GitHub associates commits using the supplied email; API attribution alone is not proof of who authored the change. [Email addresses](https://docs.github.com/en/account-and-profile/concepts/email-addresses).
- AG Grid labels its built-in Master Detail feature Enterprise. The planned detail panel uses ordinary React instead. [Master Detail](https://www.ag-grid.com/react-data-grid/master-detail/).

### Documentation verification

Verification checks relative Markdown links and anchors, all numbered task IDs/counts and handoffs, environment names against the canonical table, changed-file whitespace, phase status and absence of runtime manifests. Final checks passed: 26 tracked Markdown files, 162 local links/anchors, 13 phases, 57 unique sequential task IDs, 12 phase handoffs and all 39 environment keys. `git diff --check` passed. Runtime manifest/lockfile absence was confirmed. No product test or external sandbox result is implied.
