# ADR 0015: PR feedback before merge; separate financial approval

Date: 2026-10-31
Status: Accepted by user direction; supersedes ADR 0009's merge-first rejection and browser rejection flow.

Copilot Check Runs are advisory feedback on the current PR revision. Contributors address unmet requirements before merge; maintainers may comment, request changes, or close a PR regardless of Copilot's verdict. Normal GitHub comments are not financial instructions and do not automatically become Repopay decisions.

A maintainer can record `/bounty reject <reason>` on a specific linked PR before merge. Current repository write permission, installation access, complete candidate reconciliation and a current saved assessment are required. Ambiguous linked issues require an explicit issue number. The append-only decision binds head/base, evidence and assessment; it retains a null merge SHA for an unmerged PR. No award or refund is created, claims/evidence are retained, and unrelated candidates are not rejected. Replaying the job is idempotent. Unchanged rejected evidence remains excluded if later merged; changed material evidence is reconsiderable. Rejection of a committed award remains forbidden.

The payment-review page provides approval only. Its former rejection POST returns 410 without mutation. Legacy merged rejection records remain immutable and valid. Approval still requires a merged candidate, stable ordering, current evidence/CI, eligible recipients, accepted exact scope and explicit full-amount confirmation. Closing a PR never clears a financial claim automatically.

Migration 0017 permits null rejection merge SHA, keeps approval merge SHA mandatory and preserves unique rejection identity even with null merge SHA. It does not rewrite history. Candidate collection additionally reads the explicitly targeted unmerged PR; it does not collect every open contributor diff merely to reject one.

For partial demo PRs use `Refs #N` plus explicit bounty linking, not `Fixes #N`: GitHub closing keywords close issues on merge independently of Repopay. Repopay rejection neither reverts source commits nor reopens issues automatically. The historical Phase 7 merge-first walkthrough does not prove this new pre-merge path.
