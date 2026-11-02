# Phases 0–5 review and Phase 6 readiness

Review date: October 30, 2026. Starting commit: `32798c5`; worktree was clean. Scope: local implementation, phase contracts, recorded provider evidence, authorization/financial boundaries, and the automated suite. No new live provider evidence, payments, deployment, commit or push is claimed here. Copilot **Auto** remains the accepted runtime profile under ADR 0007; v1–v3 funded terms are preserved.

## Findings fixed in this worktree

Each behavioral finding below was reproduced by a failing regression before the fix.

| Finding | Fix and regression |
| --- | --- |
| A session revoked after HTTP authentication could still overwrite a payout destination | Lock and revalidate the session in the connection transaction, including expiry after waiting. `connect.test.ts` |
| Runtime diff configuration could exceed the cap promised at funding | Bound collection by both frozen terms and the current operational cap; truncation remains insufficient evidence. `collect.test.ts` |
| Successful CI reruns remained blocked by an earlier failure of the same app/context | Evaluate the latest check ID per app/context and exact SHA; retain other-context failures, missing contexts and pagination uncertainty. `ci.test.ts` |
| Auto evaluation could never pass; an empty fixed-model suite could pass | Require concrete serving-model provenance for every Auto run, nonempty fixtures and at least three runs; retain actual model IDs. Reject stale prompt/SDK reports in the CLI. `eval-report.test.ts` |
| A cancelled bounty prevented linking a replacement on the same issue | Select accepting bounties and preserve historical cancelled-bounty submissions without attempting to mutate them. `linking.test.ts` |
| Unknown advisory-lock acquisition outcomes could return locked connections to the pool | Destroy uncertain funding/verifier connections; verify successful unlock before reuse. `capture.test.ts`, `verification-checks.test.ts` |
| Sponsor reconnection reset token generation, allowing an old refresh to overwrite new consent | Increment grant generation atomically on reconnection; stale refresh cannot write or revoke the replacement. `sponsor.test.ts` |
| In-flight collection could overwrite the submission's evidence revision after a new PR update | Lock bounty/submission, check collected head/base and expected revision, and advance evidence versions monotonically. `verification-checks.test.ts` |
| An old review could clear attention for a newer PR revision | Preserve historical attempt results but clear warnings only for the current exact revision/evidence version. `verification-checks.test.ts` |

## Phase assessment

| Phase | Assessment |
| --- | --- |
| 00 | Foundation and migration/type/config tests pass locally. Existing provider feasibility evidence is historical; Nemotron evidence is not Copilot evidence. |
| 01 | Signed intake, durable jobs, projections and per-command replies have tests and recorded live evidence. No new live replay performed in this review. |
| 02 | Auth, CSRF, confirmations, permission checks and transactional cancellation are covered locally. The previously deferred live collaborator-revocation check remains unverified. |
| 03 | Durable funding keys, capture reservations, observation fences and hold behavior are covered locally. The appended evidence records a real $40 capture; older summaries saying no capture occurred are stale. Receipts/balances, abandoned checkout and live restart/replay remain open. |
| 04 | Recorded live connection exists; the revoked-session race is now fixed. Claim resumption is intentionally inert until awards exist. |
| 05 | Advisory pipeline exists and the fixes above pass locally. It is **not complete**: the Auto pilot matched 14/18 expected verdicts and omitted required usage metrics; it was not run through the application adapter. New Auto evaluation and remaining sponsor/access/recovery coverage are required. |

## Unresolved findings and implementation prerequisites

1. **Before awards/payouts:** funding reconciliation currently promotes every non-`FUNDED` status to `FUNDED` after observing a completed capture, and protects only `FUNDED` from nonterminal observations. When adding settlement states, restrict initial funding transitions and preserve later award/delivery states. Add state-transition regressions with that migration; do not enable payouts first.
2. **Before award selection:** no complete reconciled candidate scan, immutable award, merged-revision binding, or latest-evidence selection guard exists. The current reference parser is narrower than GitHub closing references and accepts bare numbers. PR observations can also arrive out of order. Phase 06.02 must reconcile rather than treating webhook arrival or a stored verdict as authoritative.
3. **Before automated settlement:** pass the application-adapter Auto evaluation with three observations per fixture, concrete serving models and usage metrics. Store/enforce acceptance for the current prompt/profile; a valid report file alone is not authenticated provider evidence. Do not weaken expected verdicts to make the recorded 14/18 pilot pass.
4. **Phase 5 remaining coverage:** organization sponsorship and complete sponsor-revocation handling, additional-author eligibility, provider/access-loss acceptance, job lease fencing at verifier writes, and lost Check Run create-response reconciliation remain incomplete. The collector conservatively marks additional commit authors unverified; a two-author payout cannot be claimed supported.
5. **Operational recovery:** failures before an attempt row may reuse the same retry key; review attention is set before job exhaustion, and failure-cause diagnostics remain limited. These are recorded in the earlier Phase 5 evidence as well.
6. **Live acceptance:** do not convert historical sandbox probes, mock integrations or fixture catalog validation into Phase 5–12 completion. Hosted deployment and the real 72-hour refund notice require their own observed evidence.

## Checks

Use repository-pinned Node 22.23.4 and pnpm 10.29.3. Database tests use isolated temporary schemas in local `repopay_test`; provider calls are mocked and unmatched calls denied. Initial failures were due to a missing locked SDK dependency and stopped Docker; `pnpm install --frozen-lockfile` restored dependencies and the existing Docker/Postgres service was started. No application database migration was applied by this review.

Final command results are recorded in [Phase 6 evidence](06-summary.md). All newly reproduced failures are resolved; the unresolved findings above are not declared fixed.

### Continuation resolution

The subsequent [Phase 5 continuation](05-summary.md#october-30-2026--phase-5-continuation) fixes the verifier-write lease gap, lost Check Run response recovery, retry-key recovery, premature attention, safe failure diagnostics and signed personal sponsor revocation. It adds the live evaluation harness but does not establish a passing live result. The other readiness findings remain open; organization support is explicitly blocked by user direction.
