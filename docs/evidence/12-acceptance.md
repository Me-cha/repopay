# Foundation MVP acceptance and broader evidence matrix

Updated 2026-10-31 · **Acceptance incomplete. Local implementation plus recorded scoped live results; hosted acceptance remains pending.**

The user narrowed current acceptance to the basic sandbox journey under [ADR 0021](../decisions/0021-foundation-mvp-scope.md). The [active foundation checklist](../phases/live-walkthroughs.md#active-foundation-mvp-checklist) controls this milestone; the broader matrix below is retained as deferred evidence/backlog, not a requirement to finish every scenario first. Local tests use real disposable PostgreSQL schemas with mocked GitHub/PayPal/Copilot boundaries. Browser tests use a local synthetic fixture server. Historical real observations remain valid only for the recorded scenario, scope and revision. See [local command results](12-summary.md) and the authoritative [deferred checklist](../phases/live-walkthroughs.md). No new live evaluator, payment, issue or hosted deployment was run for Phase 12.

Tests below are under `packages/server/test/integration/` unless qualified. “Local pass; live pending” is not workflow acceptance.

| Workflow | Automated evidence | Real/manual evidence and result | Remaining limitation / gate |
| --- | --- | --- | --- |
| W01 App/draft | `github-webhooks.test.ts`, `drafts.test.ts`, `permissions.test.ts` | [Phase 1](01-summary.md): real draft, unauthorized command and status behavior recorded | Hosted replay/access validation pending |
| W02 capture/checkout | `checkout.test.ts`, `capture.test.ts`, `funding-intent.test.ts`, `funding-recovery.test.ts`, `paypal-webhooks.test.ts` | [Phase 3](03-summary.md): $40 capture; [demo](05-demo-walkthrough.md): $50 funded and subsequently paid | Abandoned checkout, capture restart/replay and remaining Phase 3 receipt/CI-required funding cases pending |
| W03 unfunded cancel | `cancel-draft.test.ts`, `confirm.test.ts`, `funding-intent.test.ts` | [Phase 2](02-summary.md): real cancellation, consumed token, expiry/login and collaborator positive flow | Collaborator write-revocation negative case still pending; owner sponsor revocation is a different test |
| W04 competing PRs | `linking.test.ts`, `candidate-scan.test.ts`, `award-selection.test.ts` | [October 31 live case](05-demo-walkthrough.md#funded-competing-pr-acceptance--pass-october-31): $1 captured; Me-cha PR #5 RESOLVES, Mecha-Test-Account PR #6 PARTIAL; both exact-head CI pass, open/unmerged, zero awards | Narrow competing-link/review case passed; both pre-funding submissions reviewed on capture. Does not establish two-author attribution or all Phase 5 gates |
| W05 exact revision/CI/retry | `verification-checks.test.ts`, `verification-retry.test.ts`, `sponsor.test.ts`, verifier unit tests | [Verifier](05-verifier.md), [demo](05-demo-walkthrough.md): Auto v2 18/18, revision change, owner revocation/reconnection and real Check Runs | October 31 same-revision ERROR-to-RESOLVES recovery passed (verifications 14 → 15, unchanged head, history preserved). Expiry/refresh and remaining live event cases deferred. Organization sponsorship blocked; historical evaluation is not a new run |
| W06 award/payment | `award-selection.test.ts`, `payout.test.ts`, `concurrency.test.ts`, `settlement-profile.test.ts` | [Phase 6](06-summary.md): PR #3 → one $50 award → PayPal SUCCESS → PAID → recipient receipt confirmed | Scoped sandbox success only; broader merge modes/recovery and activation acceptance remain open |
| W07 co-author split | `unit/policy.test.ts`, `payout.test.ts` | Local exact-cent/prepared multi-author award cases pass; no real split | **Implementation and account blocker:** current automatic evidence supports only PR author; revision-bound co-contributor attribution is not verified. Third account now available; actual two-author evidence remains pending |
| W08 delayed claim | `connect.test.ts`, `claim-readiness.test.ts`, `payout.test.ts` | [Phase 4](04-summary.md) connection; [Phase 6](06-summary.md) local resumption | October 31: PR #6 merged, verification 31 RESOLVES; award 2 for $1 is AWAITING_CLAIM, recipient unconnected, zero payout batches. Mecha-Test-Account subsequently connected; same award 2 resumed through one batch/item, recorded provider SUCCESS and GitPay PAID. User confirmed recipient receipt October 31; delayed-claim case passed; 14/14 model requests used |
| W09 approve/reject | `review-approve.test.ts`, browser journeys | [Phase 7](07-summary.md): local authorization, stale confirmation, immutable decision and ordering cases pass | Historical merged rejection recorded; corrected pre-merge rejection (ADR 0015) passed live on unmerged PR #9, including bot acknowledgement and no award. Partial approval and actual-role walkthrough remain pending |
| W10 genuine refund | `cancellation-request.test.ts`, `cancellation-review.test.ts`, `refund-authorization.test.ts`, `refund-submit.test.ts` | [Phase 8](08-summary.md), [matrix](08-cancellation.md): local pass only | Independent operator, explicitly scoped new v5 bounty, real 72-hour notice, refund completion and payer receipt pending. Activation stays off |
| W11 protect work | `cancel-then-merge.test.ts`, `cancellation-matrix.test.ts`, `cancellation-evidence.test.ts` | [Phase 8](08-cancellation.md): local attack/evidence guard cases pass | Real valid-PR cancellation attack must visibly fail; cannot guarantee discovery of unseen work or prevent off-platform copying |
| W12 objections | `cancellation-evidence.test.ts`, `cancellation-review.test.ts` | Local non-writer evidence and reasoned disposition tests | Actual non-writer objection/independent disposition pending; no automatic release on silence |
| W13 uncertain/failed money | `capture.test.ts`, `payout.test.ts`, `refund-submit.test.ts`, `concurrency.test.ts`, `crash-recovery.test.ts` | [Recovery](10-recovery.md), [operations](../operations.md): local failure/restart tests and action guidance | Real ambiguous/returned outcomes and hosted restore pending. Failure never refunds/voids earned award; no replacement-transfer shortcut |
| W14 event/access gaps | `github-webhooks.test.ts`, `reconciliation.test.ts`, `operations.test.ts`, `crash-recovery.test.ts` | [Phase 10](10-summary.md): local replay, checkpoint, missed-event and access-loss cases | Bounded live discovery/App removal/recovery and hosted evidence deferred; discovery stays default-off |
| W15 scoped views | `read-scope.test.ts`, `sse.test.ts`, web DOM/security/Chromium suites | [Journeys](09-user-journeys.md): local desktop/mobile, auth, private cache and hostile markup checks | Actual maintainer/contributor/operator roles and worker updates/permission loss pending |
| W16 reproduce/deploy/demo | `deploy-compatibility.test.ts`, `migrations.test.ts`, seeder/Postman guard unit tests; full build/browser suite | [Phase 12 rehearsal](12-summary.md), [deployment preparation](11-summary.md), [outline](../demo.md) | Hosted services not provisioned; provider-connected clean startup, real seeder rerun/Postman GUI, final recording/rules and user acceptance pending |

## Final review traceability

The [plan review](../phases/review-todo.md) was a planning review, not runtime acceptance. Its additional failure cases are owned as follows:

| Review item | Implementation/evidence owner | Open acceptance boundary |
| --- | --- | --- |
| R01 canonical workflow contract | Phase index W01–W16; this matrix | Broader acceptance deferred by explicit foundation scope decision |
| R02 durable operations/evidence | Phases 5/8/10; `crash-recovery`, `cancellation-evidence` | Real missed events/access gaps |
| R03 financial identity/privacy | Phases 3/4/6; `funding-intent`, `connect`, `payout`, `security` | Real return/recovery and role inspection |
| R04 frozen review/payment policy | Phases 3/5/6; `settlement-profile`, verifier/policy tests | Sponsored live retry, organization support, co-author attribution |
| R05 PayPal contract | Phases 3/6/8; capture/payout/refund suites | Genuine refund receipt and unknown-outcome observations |
| R06 state transitions | Phases 6/7/8/10; concurrency and crash recovery | Hosted restore cannot infer provider state from backup alone |
| R07 cancellation rubric | Phase 8 matrix; cancel-then-merge and independent reviewer tests | Independent operator and full real notice |
| R08 read-only dashboard/SSE | Phase 9 scope/SSE/browser suites | Actual-role access loss and hosted updates |
| R09 configuration/operations | Phases 10/11; operations, migration hash and recovery hold tests | Render resources, costs, secrets and deployment approval |
| R10 honest completion gates | Phase summaries, live checklist and this matrix | All deferred checks retain incomplete status |
| R11 documentation verification | Phase 12 clean install, link/secret checks and outline | Recording privacy review and official event rules before submission |

## Final sign-off — unfulfilled

- [ ] All mandatory W01–W16 evidence complete; no required blocker hidden as a limitation.
- [ ] Valid submitted work visibly blocks cancellation; genuine reviewed refund has a real payer receipt.
- [ ] Failed/returned delivery remains actionable without refunding earned awards.
- [ ] Hosted acceptance and safe restore recorded; deferred Phase 2–3 cases reconciled.
- [ ] Final recording reviewed for accurate claims/privacy; official event rules checked before submission.
- [ ] User accepts the completed evidence. Publication remains a separate action.

Personal-repository demo acceptance, if later requested, must be explicitly scoped and must not mark organization support, two-author allocation or the full MVP complete.

## October 31 — remaining work resumed

User requested completion of remaining work except the real 72-hour refund walkthrough. This is a deferral, not refund acceptance. Current build passed (existing large frontend chunk warning remains); all **11 Chromium journeys passed** with the disposable test database, covering responsive widths, keyboard navigation, role paths, permission-loss/private-cache clearing and hostile markup. These provider-mocked journeys do not replace actual-account/hosted validation. The first browser invocation lacked TEST_DATABASE_URL and failed before tests; configured rerun passed.

User approved 18 v3 evaluation requests, preparation of a Render quote (not provisioning), and two-party revision-bound contributor attribution. Evaluation completed 17/18 and failed its gate; see [result](05-auto-v3-result.md). Attribution is locally implemented; live split remains pending. Existing Phase 7 review allowance is exhausted at 7/7.

October 31 verification: 367 server + 4 web tests passed; typecheck/lint/build passed. Migration 0018 applied and compatibility verified. Attribution requires both real-account confirmations and a new live split case; Render resource preview is blocked by its loading/blank page. No hosting provisioned.
