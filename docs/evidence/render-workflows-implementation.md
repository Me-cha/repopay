# Render Workflows implementation and verification

## Hosted user journey — November 9 follow-up

The authorized hosted walkthrough uses contributor `Mecha-Test-Account` and maintainer `Me-cha` on `deepakA18/gitpay-demo-http`: issue #14, PR #15, bounty 3, $1 PayPal sandbox only. Funding completed with order `32D22623C20785305` and capture `6TD59709CP4666807`. Both real Demo CI checks passed. Existing funded terms have CI enforcement disabled; passing CI alone does not change that policy.

Workflow `wfl-dboqnubl550s73ak1a7g` was deployed in the GitPay project with version `1fef39b`; the web service used Render backend generation 2. Capture automatically created dispatch `544b807c-d532-4873-aab3-52242e925317` and run `trn-0bd4gdbor2s9jo0lc73cudh6g`. The run returned `ignored`, while its first execution had already claimed the dispatch. Reconciliation safely marked `FAILED_BEFORE_INFERENCE`; no verification, award or payout was created.

Root cause: SDK 1.7.0 schedules automatic startup during task registration, while `review-workflow.ts` also called `startTaskServer()`. Two executions raced; the duplicate's early completion stopped the owning execution. The entrypoint now disables automatic startup before registration and retains one explicit start. `review-runtime.test.ts` launches the real SDK/entrypoint against local daemon/broker stand-ins with the automatic-start environment variable absent. Before the fix both registration and run tests observed two requests/callbacks; afterward both observe exactly one. The compiled registration smoke no longer masks this defect by setting the environment variable in its harness.

Fix `6345c3e` was deployed as workflow version `wfv-dbor6l9srm7s73cs5rsg` and web deploy `dep-dbor78bm5ojs738aj0ng`. Maintainer `/bounty retry #14` launched run `trn-0bd4gdbor8g11p6cs739irj80`, which completed in about 22 seconds with `result_saved`. Review 31 used Copilot Auto serving `gpt-6-luna`, returned RESOLVES (0.99 confidence), and published GitHub Check `129144632585` plus a PR summary. The maintainer then merged through GitHub's UI.

The post-merge run `trn-0bd4gdbor94n9o2pc73ecrir0` saved review 32 as PARTIAL: `Object.keys` omits non-enumerable own header names. No award/payout occurred. The maintainer rejected that exact submission via `/bounty reject`, preserving its evidence, and the user authorized two additional reviews for a correction PR. This demonstrates an inconsistent pre/post-merge model assessment, not guaranteed model correctness.

The merge also exposed a second integration defect: settlement rebuilt the fresh prompt before JSONB normalization, while the isolated executor hashed the persisted JSONB representation. Identical evidence with reordered CI object keys failed the prompt binding. Settlement now reconstructs that same JSONB representation from **current** evidence while preserving original shared-mode hashes. No stored verdict or financial guard is bypassed. A real PostgreSQL regression failed for unchanged remote input before the fix; the fixed check accepts unchanged content and continues rejecting changed criteria, diff/context and CI. Fix `551c40c` went live in web deploy `dep-dborcjks728c73ai0hb0`; the Workflow remains pinned to `6345c3e` because its executor did not change.

### Completed hosted result

Correction [PR #16](https://github.com/deepakA18/gitpay-demo-http/pull/16) uses `Object.getOwnPropertyNames` and tests non-enumerable own properties, unchanged descriptors, reference identity and inherited-property exclusion. Its head is `74c4c339ca2f1dcb05b794fdfd10e47cebe46ea6`. Both real GitHub CI checks passed. Maintainer `Me-cha` merged it through the browser after its passing review. All actions used the hosted application; local tests only verified the discovered code fixes.

| Stage | Observed evidence |
| --- | --- |
| Contributor and maintainer identities | Separate authenticated browsers: `Mecha-Test-Account` and `Me-cha` |
| Repository sponsorship | `deepakA18`, Copilot Auto; stored access expiry advanced to November 9 19:37 UTC, token generation 2; no ambient operator token used |
| Corrected pre-merge review | Review 34, RESOLVES, confidence 0.98, serving model `gpt-6-luna`; run `trn-0bd4gdbord2pjo0lc73cudh7g`; Check `129148917241` |
| Corrected post-merge review | Review 35, RESOLVES, confidence 0.98; run `trn-0bd4gdbore21jo0lc73cudh80`; Check `129149823537` |
| Award | Award 2 binds submission 4 / review 35; 100 cents allocated to GitHub ID `350676467` (`Mecha-Test-Account`) |
| Payment | One payout item, ID 3, 100 cents, provider item `QLFG7SAWDSU6E`, SUCCESS; bounty 3 PAID, no attention or funding hold |
| User-visible result | Contributor detail: `Disbursed to Contributor`, `Paid $1.00`; maintainer dashboard: Settled; PR bot: `Repopay award · PAID` |
| Recipient receipt | User explicitly confirmed the new $1 receipt in the receiving PayPal Sandbox account |
| Duplicate protection observed | One later dispatch ended ALREADY_REVIEWED without inference; subsequent polling still showed exactly one award and one payout item |

Seven Render task runs occurred: four completed real model calls, two stopped before inference, and one duplicate suppression. The second pre-inference stop produced ERROR review 33 and a published unavailable Check; subsequent GitHub events led to successful review 34. Its precise stopping reason was not retained beyond EXECUTOR_STOPPED, so do not call that failure fully diagnosed. Total actual model use was four requests, within the user's extended allowance; no rerun was used to replace PARTIAL with a passing result for unchanged code. Local verification after the fixes: 439 server tests + 8 web tests, typecheck, lint and server build passed on Node 22.23.4; the compiled real-SDK registration smoke passed.

### Limits and follow-ups

- This proves the bounded hosted sandbox journey, not real-money production acceptance, a concurrency/load target, always-on uptime, or cost advantage. Free web sleep remains relevant; Render tasks use metered `flex` compute.
- CI passed for the test revision, but the existing funded terms had CI enforcement disabled. A required-CI rejection journey was not exercised live here.
- The first pre-inference failure had no verification record and did not publish a PR failure comment/Check. The dashboard showed the failure, but GitHub failure feedback should be improved. Later failures with a verification record did publish correctly.
- Final dashboard status was checked after refresh; automatic SSE delivery latency was not independently established.
- The pre/post-merge verdict change remains evidence of model variability. Full model evaluation, organization sponsorship and broader historical phase gates remain deferred, not passed.

## Earlier implementation record

November 9, 2026. Initial local implementation was based on `20832101f884760cc2dce58035bc862860d093c7`. The user subsequently committed and deployed `b57deaeb0bdec7717745b823ef38899d72c77eed`. The follow-up hosted checks below supersede the earlier deployment/configuration observations; no live model call or payment was performed during these checks.

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

## Earlier Render browser inspection (historical)

Signed-in Brave confirmed the existing `repo-pay` service, `Me-cha/repopay` on `main`, Singapore, and deployed base `20832101f884760cc2dce58035bc862860d093c7`. It currently uses Free compute and starts with hosted migrations/checks. The `repopay-reviews` workflow form is prepared with source, region, build and start commands; it was not submitted. The account settings page confirmed no provisioned API keys or CLI tokens. No key was generated or secret copied. Local configuration has no Render API key or executor key, and backend remains shared.

## Hosted HTTP and API checks

November 9, 2026, after the user's deployment. All application requests targeted **https://repo-pay.onrender.com**. No local application server or local product test suite was run. No computer use was used; Render inspection used the authenticated REST API. Secrets, OAuth state and cookie values were omitted from reports.

Render reports deployment `dep-dboq0fjm5ojs7389f0e0` live at commit `b57deaeb0bdec7717745b823ef38899d72c77eed`, finished at `2026-11-09T10:30:52.493709Z`. The service remains Singapore / Free / inline worker / normal recovery mode. Hosted `PUBLIC_URL` is correct. The hosted Render API key is present and matches the local key; its API requests succeeded.

| Hosted check | Observed result |
| --- | --- |
| Health | 200, `ready`; deployed health handler checks database connectivity and migration compatibility |
| Public application shell and referenced JS/CSS | All three requests 200; shell contains React root. Rendering/interactions were not browser-tested |
| Login initiation | 303 to GitHub authorization; callback is `https://repo-pay.onrender.com/oauth/github/callback`, state present; binding cookie Secure, HttpOnly, SameSite=Lax |
| Dashboard, connect, funding and review pages without a session | Four requests redirect to hosted sign-in |
| Callback without code/state/binding | Redirects to sign-in; no session created |
| Private APIs: me, bounties, payouts, connect, onboarding, stream | All six return 401 without a session |
| Connect and onboarding POST without a session | Both return 401 |
| Unsigned GitHub / PayPal webhook POST | 401 / 400 respectively; rejected |
| Executor claim POST with random nonexistent dispatch UUID | **404**, rather than authenticated broker's 401: broker is not mounted |
| Render workflow/task/version inventories | Each list endpoint returned HTTP 200 with JSON `null`; no resources were returned |

**Result: 20 hosted HTTP smoke checks passed; one executor availability check is blocked by missing configuration.** `REVIEW_EXECUTOR_KEY`, `RENDER_REVIEW_TASK`, `REVIEW_BACKEND` and `REVIEW_GENERATION` are unset on the web service, which therefore uses shared reviews / generation 1. An API key alone does not activate Render review execution. No task was launched and no provider configuration was changed.

These tests do not establish successful OAuth completion, authenticated user/operator journeys, valid provider webhook delivery, Copilot inference, financial settlement, or Render subprocess/recovery behavior. No authenticated user session was available to this HTTP test session. Raw sanitized reports are local ignored artifacts under `.local/hosted-*.json`; the observations above are the durable evidence.

Configuration follow-up: the isolated executor now reuses the existing `PUBLIC_URL` as its broker origin. The redundant `REVIEW_BROKER_URL` setting was removed from the runtime contract, workflow Blueprint and executor example. A workflow release registers a versioned `verifySubmission` task; task runs receive new run IDs without changing the dispatcher's pinned task slug.

After the user's environment update, the Render API reported desired web-service settings `REVIEW_BACKEND=render`, `REVIEW_GENERATION=2`, correct hosted `PUBLIC_URL`, and an executor key. `RENDER_REVIEW_TASK` remained unset; workflow, workflow-version and task inventories were empty. Deployments `dep-dboq923bc2fs73ctcg50` and `dep-dboqbr0u01pc7383kfeg` both reached `update_failed`, while the prior successful deployment remained live. This matches the startup guard: Render mode requires an exact versioned task and cannot be activated by environment settings before the workflow is released.

The `PUBLIC_URL` refactor passed 19 focused executor/broker tests, all 433 server tests and 8 web tests. Typecheck, ESLint and build also passed; the build retained the existing non-failing React Joyride module-directive warning. No hosted task, Copilot inference or payment was initiated.

## Pending hosted gates

1. Source deployment and dispatcher API credential are now confirmed. Create the workflow and configure the separate shared executor secret on the web service and workflow; keep broad application credentials off the workflow. Record its deployed version in `RENDER_REVIEW_TASK` on the web service.
2. Confirm a finite hosted test-compute allowance before task execution. Keep the web backend shared during initial smoke tests; use a nonexistent dispatch for a no-inference connectivity check once the broker is mounted. No monthly spend ceiling has been approved.
3. Prove actual hosted task startup, broker connectivity, subprocess lifecycle, secrets isolation and revocation behavior. Real Copilot smoke needs its own request allowance.
4. Collect the plan's local/dedicated/hosted latency, queue scheduling, connection headroom and cost comparison (50 controlled observations per backend, 20 hosted starts). No measured cost or latency advantage is claimed yet.
5. Choose and activate the backend after those results. The current free web service's sleep behavior must be resolved before any always-on reliability claim.

Local implementation and tests do not mark the historical deferred phase exits or Render adoption passed.

## November 12: PR32 executor repair

Confirmed mismatch: web service had prompt v6 / diagnostic commit `f9cecdd`, but `RENDER_REVIEW_TASK` still selected November 9 prompt-v5 release `6345c3e`; workflow auto-deploy was off. Historical runs 40–42 have no stage diagnostics, so their exact original exception remains unknown. No counters, failed attempts or financial records were cleared.

Deployed repair `028a60c`, workflow version `wfv-dbqmkgqfngtc7382v0qg`, task `tsk-dbqml2tdr6bs73ffvdo0`, broker deploy `dep-dbqmkm9kph1s73a0faa0`, generation 3. Authentication key and origin matched without exposing them. User approved up to two requests and a revision-only total cap of five; an expiring exact-repository/submission/head override retained the normal 25/day and 3/revision defaults.

The first retry, dispatch `3b4a5457-6aad-4441-a86b-764bcb53eb86`, Render run `trn-0bd4gdbqmmh1du03g00cnh6r0`, verification 44, saved DONE / RESOLVES / 99%, model `gpt-6-luna`, on PR32 head `278027638684690eda9fb08909103853ea07f633`. Capacity released normally. One of two approved requests was used. GitHub's advisory Check remains neutral by design; its saved verdict is RESOLVES. The temporary override was removed from desired Render configuration after the success; the next broker release removes it from runtime.

Local repair verification: 495 server tests and 32 web tests passed; typecheck, lint, server build and executor registration smoke passed. Separate scoped payment acceptance is recorded in ADR 0026; payment completion must be independently confirmed.
