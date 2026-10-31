# ADR 0014: Bounded exact-revision test context

Date: 2026-10-31
Status: Implemented locally for the user-authorized verifier-context fix; live observations are recorded separately.

## Problem

Demo PR #6 contains required array tests, but those tests also landed on its base branch. GitHub's patch omits their unchanged middle lines. The runtime verifier therefore received incomplete test context and reported missing tests even though exact-head CI passed. Asking contributors to add duplicate tests or cosmetic changes is not an acceptable remedy.

## Decision

Keep the original patch and append clearly labelled, JSON-encoded full-file context for changed, non-deleted test files only. Recognize test/tests/__tests__/demo-test directories and `.test.*` / `.spec.*` names. This is not repository-wide retrieval, and it cannot establish coverage in arbitrary unmodified files.

Fetch at the exact head commit through the installation-authenticated Contents API. Match the returned path and the PR file's blob SHA; independently recompute the Git blob hash. Require a regular file, strict base64, valid UTF-8, matching byte length and no NUL. Do not follow supplied download URLs. Reject missing identities, unexpected kinds, symlink metadata and invalid paths. A symlink response resolved by GitHub cannot match the PR's symlink blob hash.

At most four files and 16 KiB decoded bytes per file. Context and patches share the smaller of runtime and frozen funded `maxDiffChars` limits. More candidate files, missing permissions, failures or oversize context make evidence truncated/insufficient. Provider transport response/time limits remain in force. Re-read PR head/base after context fetching to reject revision changes.

The appended context is labelled as potentially unchanged lines, not additional changes. Existing untrusted-evidence instructions apply. Nothing is executed by the worker. The prompt version, funded terms, author identity rules, exact-SHA CI, limits, verdict validation and settlement authority remain unchanged. Context is persisted in the existing diff snapshot and included in snapshot/prompt hashes; earlier snapshots/verdicts remain immutable. No migration is needed.

## Provider and validation boundaries

The [official GitHub Contents API](https://docs.github.com/en/rest/repos/contents) supports a commit `ref` and requires Contents read permission for installation tokens. The existing demo installation successfully fetched and verified PR #6's file; no permission change was needed during the probe. New installations need Contents read-only for this feature; missing access holds evidence rather than falling back to ambient credentials.

Local tests cover omitted unchanged lines, bounded context, unavailable/invalid content and revision movement. A provider read confirms the real head's unchanged tests are supplied. Historical Auto evaluation results are not a fresh semantic evaluation of this enriched evidence. Any new live verdict and remaining release gates must be recorded explicitly.
