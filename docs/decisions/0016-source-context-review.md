# ADR 0016: Exact-head source context and prompt v3

Date: 2026-10-31
Status: Implemented locally at user request; live semantic validation pending.

PR #9 contained scalar omission inherited from main plus a new array omission change. Patch-only source evidence hid the scalar guard. Prompt v2 also overlooked scalar regression tests already present in supplied test context. The existing PARTIAL records are not rewritten.

Extend ADR 0014 retrieval to changed, non-deleted source files with a bounded source-extension allowlist. Collect at most four test files plus four source files, 16 KiB per file, sharing the smaller runtime/frozen total diff budget. Preserve original patches; label full contents as exact-head context containing unchanged lines. Use the same installation-token Contents adapter, exact commit/blob identities, hash/UTF-8 checks and final revision fence. Missing identities, unavailable or excessive context fail closed. No repository-wide retrieval or worker-side code execution is added; unmodified files not listed by the PR API are still outside retrieval.

Prompt version is now `gitpay-verifier-v3`. It assesses the resulting revision using both patch and full context, does not require an added diff line for existing fulfilled criteria, and must read supplied tests before calling them missing. Relevant changes are still necessary; unrelated changes cannot earn a bounty from existing functionality. CI is not proof of every requirement. All payload text remains untrusted evidence.

Historical v2 evaluation does not accept v3. The existing settlement profile gate remains pinned to evaluated v2, so new automatic and manual awards remain blocked until a v3 profile is explicitly evaluated/accepted. Existing committed awards and delivery reconciliation are unaffected. No funded terms, historical verdicts, request budgets or attempt limits are rewritten. A focused new live review requires additional bounded authorization; a pass is not a full semantic evaluation.

Local regression reproduced missing scalar source before the fix; context collection and negative bounds are tested. Semantic model behavior is not proved by mocked/local tests. See Phase 7 evidence for the read-only PR probe and actual live results when authorized.
