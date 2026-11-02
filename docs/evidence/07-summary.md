# Phase 7 — local implementation; live acceptance pending

October 30, 2026. User authorized moving to Phase 7 with Phase 6's delayed-claim and two-author live checks still deferred. Existing paid bounty 1 and immutable award remain unchanged.

## Implementation

- `actions/approve.ts`: current candidate preview, full-amount allocation choice, required reason, expiring single-use confirmation, fresh authorization/evidence checks, attributed approval and revision-bound rejection.
- `actions/reject.ts`: current-permission comment rejection adapter. Atomic job receipts prevent replay advancing to the next candidate; PR-targeted rejection cannot reject another PR.
- `settlement/award.ts`: shared automatic/manual final guard and rejection-aware stable candidate ordering. One immutable award, exact cents and verified recipients remain mandatory.
- `http/review.ts`: review and exact confirmation pages, CSRF/Origin validation, strict final body, escaped output and same-origin navigation. Financial confirmation cannot substitute recipients or amounts.
- Migration 0013: append-only review decisions, revision-specific rejection uniqueness and approval action tokens. Applied to development after ignored local backup `.local/backups/repopay-before-phase7.dump`; worker stopped for migration and restarted afterward.
- GitHub approve/reject commands, linked-PR issue disambiguation, NEEDS_REVIEW projection link and authorized review history in the bounty API.

See [ADR 0009](../decisions/0009-maintainer-review-records.md) for schema and authority boundaries. No new model evaluation or payment was made by this implementation.

## Validation and limits

Database tests use isolated schemas; provider responses are mocked. Coverage includes partial approval with reason/full amount, missing merge, unknown recipient, stale evidence and assessment, lost permission, required CI, unverified authors, expired tokens, funding holds, duplicate confirmation, automatic/manual races, rejection preservation/next-candidate selection, committed-award rejection refusal, strict HTTP confirmation parameters, cross-origin denial and comment replay/PR-target binding. Initial tests exposed the action-token constraint missing `approve`; migration/schema were corrected without weakening the tests.

The live walkthrough still requires a new funded sandbox issue, partial merged solution, manual full-amount approval and a separate rejection case. The completed $50 bounty cannot be repurposed. The user deferred the proposed $1 sandbox setup and all remaining live walkthroughs until the final validation session. No live UI approval/rejection or new transfer is claimed. Co-contributor identity verification remains out of scope; choosing a recipient does not verify a new author. Runtime approval remains limited to the configured exact settlement scope.

## Final local verification

- `pnpm typecheck`, `pnpm lint`, `pnpm build`: passed.
- `TEST_DATABASE_URL=… pnpm test`: 47 files / 273 tests passed.
- `git diff --check`: passed.
- Development readback: bounty 1 remains PAID, exactly one award exists, and there are zero live review decisions. Migration applied and the separate worker started successfully.

No commits or pushes were made. Phase 7 is locally implemented, not live-acceptance complete.

The user accepted local-only verification for now. Remaining Phase 5 onward live cases are consolidated in [the final live checklist](../phases/live-walkthroughs.md). No new sandbox setup was started.

## October 31 — live case authorized and prepared

User authorized one new $1 sandbox bounty and two contributor PRs for rejection followed by reasoned partial approval, with up to 6 Copilot Auto requests. Zero requests used at preparation. Created [issue #7](https://github.com/deepakA18/repopay-demo-http/issues/7) with explicit scalar/array nullish omission, valid empty/zero/false preservation, immutability and regression-test criteria. Posted `/bounty create 1` through the normal command path. Checkout, contributor PRs, merge and authenticated decisions remain pending. Earlier awards are not reused.

### Contributor PRs received — October 31

PR #8 (Me-cha, head `f7c57592bb82f9d2ea2a74f6b0b8d26c83256af8`) documents scalar-only omission; PR #9 (Mecha-Test-Account, head `20e51d150ef52a8d710a0c1db6a34454b4f0011d`) documents array-only omission. Both remain OPEN/unmerged and exact-head external test checks passed. Bounty 4 remains OPEN; existing funding attempt 3 is CREATED, not captured. No verifier requests recorded for this bounty (0/6 used). PR #8 was linked automatically. PR #9 uses “Partially addresses #7”; an explicit `/bounty link 9` command was posted on issue #7 to request linkage without editing contributor-authored text. Existing checkout must be resumed rather than duplicated.

### Funding confirmed — October 31

Reconciled existing funding attempt 3 through the normal funding service; PayPal order `2S087208D4030392N` and its 100-cent capture report COMPLETED. Bounty 4 is FUNDED, with zero awards. Both PR #8 (submission 4) and PR #9 (submission 5) are linked. Verification 32 for PR #8 completed PARTIAL using one Auto request. The second review is queued; do not duplicate it. All prior paid awards remain separate.

### First merged partial candidate — October 31

PR #8 merged at `eda6f57b158571f25fe3ca6edea944614400ef22`, head `f7c57592bb82f9d2ea2a74f6b0b8d26c83256af8`. Verification 34 (attempt 2, Check Run 124533520063) is DONE/PARTIAL: scalar nullish values omitted, array nullish entries still encoded. PR #9 verification 33 also returned PARTIAL. Together with verification 32, usage is 3/6 approved Auto requests.

Applied scope only to the normal settlement invocation: bounty 4, repo 1435468752, 100 cents, frozen terms hash `a6e67ff2e13bdf33d469049428c8b4e86693ac904d35b3c8702a3e1aeeffdac0`. Policy returned “Solution requires maintainer review.” No persistent environment change or forced verdict was used. Next: owner reviews candidate #8 through `/bounties/4/review` and records a rejection reason; leave #9 unmerged until the rejection is verified.

### Authenticated rejection verified — October 31

User completed browser rejection as deepakA18. Readback shows review decision **1**, kind reject, submission **4** / PR #8, actor **96007304**, verification **34**, reason: “Scalar omission works, but required null/undefined array-entry omission remains unimplemented.” Bounty 4 returned to **FUNDED** with **zero awards**. Verifications 32–34 remain DONE and preserved. PR #9 is OPEN/unmerged, mergeable/clean, unchanged head `20e51d150ef52a8d710a0c1db6a34454b4f0011d`. Next: merge #9 using a merge commit, then reconcile evidence and verify ordering before authenticated full-amount approval. Usage remains 3/6; no new model call or payment in this check.

## October 31 — pre-merge rejection workflow correction

User rejected the merge-first demo design. ADR 0015 now separates PR feedback/rejection from payment approval. Maintainers can comment/request changes normally; `/bounty reject <reason>` must be posted on the specific linked PR and can persist a rejection before merge with current authorization and saved assessment. Issue-level rejection asks for a PR target. The bot replies on the PR. Payment review has no rejection form; its old rejection POST is retired (410, no mutation). Approval remains merge-gated and retains all award safeguards. Check Run summaries explicitly direct contributors to address unmet criteria and retain maintainer judgment.

Migration 0017 retains immutable historical records, allows null merge SHA for unmerged rejection only, and deduplicates null identities. Normal award ordering honors a pre-merge rejection when unchanged evidence is later merged. Targeted collection includes the selected unmerged PR without reviewing every open PR.

Validation: typecheck and lint passed; full suite **356 server tests / 67 files and 4 web tests / 2 files** passed. Added pre-merge cases cover permission loss, stale evidence, duplicate leased commands, preserved reviews, no award, approval refusal before merge, and later merge exclusion. Retired browser POST is tested. Tests use isolated PostgreSQL and mocked providers; this is not live pre-merge acceptance.

Local backup created at ignored `.local/backups/repopay-before-0017.dump`; migration applied and `pnpm db:check` reports matching artifact history. Restarted local server. Readback preserves bounty 1 and 3 PAID, bounty 4 FUNDED, historical rejection 1, and zero awards for bounty 4. Reopened demo issue #7; PR #9 remains OPEN/unmerged. No new review request, payout, PR merge or source revert was performed. Current live allowance usage remains 3/6.

### Live pre-merge rejection stored; PR reply blocked — October 31

User posted rejection on unmerged PR #9. Decision 2 persisted for submission 5 with the supplied reason; decision 1 remains intact. Job 212 retries only its projection after the recorded command receipt, preventing duplicate rejection. GitHub returns 403 on reply publication. Installation readback: Issues write, Checks write, Pull requests read, Metadata read; PR comment GET succeeds. Upgrade Pull requests to write and approve the installation update before considering visible PR feedback accepted. Do not repost the command. No additional model request or award was created.

### Pre-merge rejection and visible feedback confirmed — October 31

Installation 175753017 now reports Pull requests write. Recovered the already-authorized acknowledgement under `withProjectionLock(reply:212)` using the original `repopay:reply:212` marker after verifying the stored command receipt; no decision was replayed. Bot comment [6543538264](https://github.com/deepakA18/repopay-demo-http/pull/9#issuecomment-6543538264) is verified on PR #9. Restarted the application to discard old cached installation tokens; its queued job can reconcile the same marker normally. Decision 2 retains null merge SHA; PR #9 remains OPEN/unmerged; bounty 4 FUNDED with zero awards. No model calls or payments were made; allowance remains 3/6. This completes the narrow live pre-merge rejection/visible-feedback case, not pending approval, permission-loss and stale-confirmation live cases.

### Revised PR #9 inspected — October 31

PR #9 is OPEN/unmerged at `7ca01c4efaadcfeb7e3e87292085e1732c491705`; exact-head external test checks pass. Direct exact-head reads confirm scalar nullish omission, array nullish omission, scalar omission tests and retained empty/zero/false tests are all present. Verifications 35 (prior head after metadata update), 36 and 37 each consumed one request and returned PARTIAL. Total **6/6 approved requests used**. Latest reasoning incorrectly describes scalar code/tests as missing; the implementation file's unchanged scalar context is outside the patch. Do not ask the contributor to duplicate existing code/tests or treat the model verdict as authoritative correctness. Existing rejection 2 remains attached to the old head; no award created. Further verifier evidence diagnosis/local correction is needed before another authorized review; keep PR #9 unmerged.

### Source-context correction locally verified — October 31

Regression failed before implementation because the unchanged scalar guard was absent from collected evidence. Collector now includes bounded exact-head changed source files as well as tests (ADR 0016); missing/oversize/excess/missing-blob/budget cases fail closed. Prompt v3 explicitly considers resulting code and full test context while retaining relevant-diff and untrusted-data requirements. No verdict overwrite or new live request.

Full local suite passed: **363 server tests across 68 files and 4 web tests across 2 files**. A read-only live collection for PR #9 at `7ca01c4efaadcfeb7e3e87292085e1732c491705` returned sufficient=true, truncated=false, CI pass, 5,814 characters, scalar code and scalar tests present. Snapshot hash `ed637bed8490ad9de7501768a3508e8d3c9789c9285c1c0db29dbe7867a69781`. This probe did not persist a new review or invoke Copilot.

Existing v2 profile acceptance deliberately does not admit v3; a new test verifies closed settlement under an otherwise matching scope. No committed award changes. Phase 7 live allowance remains exhausted at 6/6; next step is one separately authorized v3 review, followed by the applicable profile-acceptance gate before any new award.

### Corrected v3 live review PASS — October 31

User authorized exactly one additional Auto request (7 total for Phase 7). Normal verifier invocation for submission 5 at unchanged head `7ca01c4efaadcfeb7e3e87292085e1732c491705` used one request and produced verification **38**, DONE / **RESOLVES**, coverage 100%, confidence 97%. Check Run **124546610761** is completed/neutral with exact-head CI pass. Reasoning explicitly recognizes existing scalar handling and scalar tests alongside the added array behavior. No revision-attempt override, historical verdict rewrite or merge. PR #9 remains OPEN/unmerged; bounty 4 FUNDED, zero awards. All **7/7 authorized requests used**.

This passes the focused false-PARTIAL regression on the real unchanged revision. It is not a full v3 semantic evaluation or profile acceptance; new v3 awards remain gated. Maintainer review remains required before merge, with any further model use separately bounded.
