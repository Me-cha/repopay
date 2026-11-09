# ADR 0022: Durable, isolated review execution and publication

Date: 2026-11-09

Status: local implementation authorized; hosted rollout, runtime acceptance, cost ceiling and backend adoption pending. Default backend remains `shared`.

## Context

The [reviewed plan](../evidence/render-workflows-plan.md) addresses the ordinary worker awaiting slow Copilot reviews before processing its next command or reconciliation tick. A separate reliability defect published a Check before committing the completed review. The first increment corrected that ordering; this decision now also specifies the isolated execution boundary.

## Decision

Migration 0021 adds the immutable `verification_publications` outbox. Terminal verification, saved Check output and typed publication/comment jobs commit together. `verifier/publication.ts` has no model dependency. It updates the exact historical Check, or reconciles an App-owned external marker before creating one. Migration 0022 adds a durable create boundary: an unknown create is scanned again, never blindly recreated. PR summaries continue using the existing serialized current-state projection.

Migration 0022 also adds `review_execution_control` and `review_dispatches`. `reviews/store.ts` serializes admission: at most two outstanding execution reservations, one per sponsor across repositories, and one per submission. Admission skips busy sponsors. The original job maps to one immutable dispatch. Its short lease completes after that record takes ownership, even if still READY; reclaiming an interrupted handoff finds the same record. This refines the plan's launch-acknowledgement handoff without losing pending work.

`reviews/dispatcher.ts` runs independently from the ordinary loop. Isolated modes exclude `verify_submission` from ordinary claims. Shared-mode claims also honor persisted pause/backend state. Existing pre-migration binaries must still be drained before deployment.

`reviews/service.ts` collects bounded evidence, persists the exact input and prompt hash, verifies owner consent and current access, reserves allowance and commits `INFERENCE_STARTED` before returning a sponsor grant. Only one owner can cross that boundary. Completion validates schema, author IDs, model/provenance, evidence, CI, installation, sponsor, revision and generation again. Validated late output becomes ERROR/SUPERSEDED history. Unknown inference is never automatically repeated and still consumes allowance. Existing money policy remains authoritative.

### Restricted access through an HTTP broker

The task has **no database credentials**. It uses fixed server operations over HTTPS with a separate HMAC key, timestamp, exact path/body signature and per-dispatch ownership token. This implements the plan's narrow-operations option instead of SQL roles in ephemeral task containers. No endpoint accepts arbitrary SQL, arbitrary jobs, financial writes or payout destinations. Startup rejects broad app/provider credentials. Evidence and a temporary sponsor grant go only to the authenticated executor. The Render API key stays on the dispatcher. Executors are trusted review compute; rotate their shared key after draining if compromised.

Postgres retains bounded source input as authoritative evidence; only Render arguments/results/logs exclude source. Render receives `{dispatchId}` and returns small status/ID objects. The existing collector and tool-free Copilot adapter are reused. JSONB normalization happens before computing the remote prompt hash, so the worker and record hash the same input.

`review-worker.ts` and `review-workflow.ts` share `reviews/executor.ts`. The dedicated worker is the warm comparison backend. Render uses SDK 1.7.0, `flex`, zero automatic retries and a 300-second deadline. Copilot retains its 120-second limit and gains an ownership-loss abort signal. Failed cleanup retains capacity. Render reservations release only after authoritative terminal status; dedicated reservations require completed cleanup or operator-confirmed process exit.

Launches are bounded and use the dispatch ID as idempotency key with the original versioned task. Task-side ownership can bind before the launch response. Lost acknowledgements reuse the same identity for at most 23 hours, below Render's documented 24-hour retention. Later uncertainty remains held for investigation. There is no automatic replacement inference or backend fallback.

## Maintenance and limits

`ops:reviews` provides sanitized status, pause, configure, resume and termination reconciliation. Switching requires a higher generation and no READY/active dispatches or running legacy review jobs. Drain before switching. Pause fences active results and returns never-launched reservations to READY. Recovery hold also pauses execution; returning to normal does not silently resume it.

Apply additive migrations first. Do not drop history during rollback. `render-workflows.yaml` is a separate optional workflow-only Blueprint and does not provision the older full-stack template. The observed deployment is the free `repo-pay` web service in Singapore. Continuous availability and paid-resource limits remain deployment decisions.

See [evidence](../evidence/render-workflows-implementation.md) and [runbook](../review-execution.md). Local PostgreSQL tests and SDK registration are distinct from hosted networking/subprocess acceptance and latency/cost comparisons. Only isolated modes gain the new inference boundary; shared mode retains the legacy execution path. No production SLA, model evaluation acceptance or Render cost advantage is claimed.
