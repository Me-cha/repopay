# Phase 06 — implementation started

October 30, 2026; base `32798c5`. Authorized by the user's request to review Phases 0–5 and proceed through the remaining phases, retaining Copilot Auto.

## Implemented: 06.01

- `policy/allocate.ts`: positive bounded integer cents, unique canonical GitHub IDs, finite nonnegative shares with at most six decimal places, integer millionths and BigInt largest-remainder arithmetic. Byte-order ID ties; zero-cent rows omitted; exact sum checked.
- `policy/decide.ts`: validated model verdict, server-verified recipients, minimum share and confidence, CI and evidence gates. Uncertain results suggest the full fixed bounty for review; they do not authorize payment. Invalid output cannot be repaired silently by dropping malformed recipients.
- Tests cover maximum cents, one-cent ties, permutation invariance and 300 generated weight/amount combinations, invalid weights/precision/IDs, absent authors, CI/evidence blocks and uncertain verdicts.

The policy modules are pure and are **not connected to a payment path**. No awards, payout intents or transfers were created. Tasks 06.02–06.05 and Phases 07–12 remain unimplemented; Phase 6 is not complete. See the [review report](00-05-review.md) for unresolved prerequisite findings and external gates.

## Verification

- RED: policy/allocation suites initially failed because the modules did not exist.
- GREEN: focused policy/allocation suites — 7 tests passed.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` — passed.
- `TEST_DATABASE_URL=…/gitpay_test pnpm test` — 39 files, 223 tests passed.
- `pnpm eval:verifier` — fixture catalog ready; 18 live runs required, not executed. The first invocation was sandbox-blocked by the tsx IPC pipe and was rerun with local process permission.
- Changed-document relative link targets and `git diff --check` — passed.
- No real sandbox payout or claim-resumption loop was run. Historical Phase 0 probe evidence does not satisfy Phase 6 acceptance.
