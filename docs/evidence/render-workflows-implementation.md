# Render Workflows implementation and verification

November 9, 2026. Local uncommitted work based on `20832101f884760cc2dce58035bc862860d093c7`; unrelated user edits retained. No hosted resource, production database migration, live model call or payment was performed in this implementation session.

## Implemented

- Migrations 0021–0022: immutable Check outbox, durable dispatch identity, backend generation, admission and inference boundary.
- One original queue job per dispatch; durable READY handoff survives launcher crashes. Ordinary workers exclude review work in isolated modes and honor persisted backend/maintenance state.
- Two globally reserved reviews, one per sponsor across repositories and one per submission; busy-sponsor queues do not block other sponsors.
- Authenticated HTTPS broker for scoped evidence, one sponsor grant, heartbeat and guarded result persistence. The executor has no database, GitHub private key, PayPal or encryption credentials. No arbitrary job/financial-operation endpoint exists.
- Shared dedicated/Render executor: one inference grant, bounded calls, shutdown/ownership-loss abort, no re-inference on ambiguous outcomes, conservative unknown-use accounting, and UTC-day allowance attribution at inference start.
- Render adapter: metadata-only arguments/results, pinned task version, bounded start/status calls, original idempotency key, lost-acknowledgement reconciliation and no new launch beyond the retention margin. Terminal-state proof releases Render capacity.
- Independent Check publication, including missing-create marker recovery. Failed publication never re-runs Copilot. Current summaries retain existing GitHub-native commands and author guidance.
- Operator status, pause/resume, drained generation switches, known and recovered terminal-run reconciliation, and explicit dedicated-process-exit recovery.
- Separate workflow Blueprint, executor environment example, pinned Render SDK 1.7.0, commands, architecture/ownership docs and [deployment runbook](../review-execution.md).

The [reviewed plan](render-workflows-plan.md) remains the design and adoption contract. [ADR 0022](../decisions/0022-review-publication-and-execution.md) records two concrete refinements: narrow broker operations instead of task database roles, and acknowledging the original job when its durable READY dispatch takes ownership. The earlier redundant research/proposal drafts were removed; historical phase evidence remains.

## Verification

Real PostgreSQL tests use isolated schemas in the existing local test database. GitHub, Render API and Copilot inference are controlled/mocked, with outbound provider traffic denied in the test suite.

Coverage includes concurrent claims and admission, sponsor fairness, expired heartbeats retaining capacity, generation/pause fencing, changed revisions/CI/access/sponsors, daily/revision budgets, crash/response loss around inference, atomic outbox rollback, duplicate completion, task-side claim before launch acknowledgement, launch-window expiry, recovered-run input validation, failed Check creation/update and unknown create reconciliation. Existing funding, award, allocation, payout and authorization regression suites continue running.

`review-isolation.test.ts` holds the remote start call behind a barrier while 50 ordinary projection jobs finish. This proves loop independence under a controlled blocked provider. It is **not** the 30-second p95 comparison or the required hosted benchmark dataset.

`pnpm smoke:reviews` runs the real compiled workflow entrypoint and pinned SDK against a local Unix-socket Render-daemon stand-in. It registers exactly `verifySubmission`, `max_retries=0`, `timeout_seconds=300`, `plan=flex`, then exits and cleans up. This establishes local packaging/registration, not hosted subprocess, networking or authenticated Copilot inference compatibility.

| Check | Evidence |
| --- | --- |
| Typecheck and ESLint | Passed on Node 22.23.4 |
| Full server/web tests | 76 server files / 433 tests and 3 web files / 8 tests passed |
| Build | Passed; existing non-failing Joyride `use client` warning |
| SDK registration smoke | Passed with the real compiled task and SDK |
| Workflow Blueprint | Validated against Render's official JSON schema |
| Documentation paths / diff whitespace | Checked locally |

## Render browser inspection

Signed-in Brave confirmed the existing `repo-pay` service, `Me-cha/repopay` on `main`, Singapore, and deployed base `20832101f884760cc2dce58035bc862860d093c7`. It currently uses Free compute and starts with hosted migrations/checks. The `repopay-reviews` workflow form is prepared with source, region, build and start commands; it was not submitted. The account settings page confirmed no provisioned API keys or CLI tokens. No key was generated or secret copied. Local configuration has no Render API key or executor key, and backend remains shared.

## Pending hosted gates

1. Publish the reviewed source and perform a coordinated additive-migration deployment. These uncommitted changes are not on the hosted site.
2. Authorize/create the dispatcher API credential, provision/configure the workflow and approve a finite test-compute allowance. No monthly spend ceiling has been approved.
3. Prove actual hosted task startup, broker connectivity, subprocess lifecycle, secrets isolation and revocation behavior. Real Copilot smoke needs its own request allowance.
4. Collect the plan's local/dedicated/hosted latency, queue scheduling, connection headroom and cost comparison (50 controlled observations per backend, 20 hosted starts). No measured cost or latency advantage is claimed yet.
5. Choose and activate the backend after those results. The current free web service's sleep behavior must be resolved before any always-on reliability claim.

Local implementation and tests do not mark the historical deferred phase exits or Render adoption passed.
