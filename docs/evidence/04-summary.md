# Phase 4 — implementation and live walkthrough evidence

Date: October 29, 2026. Base commit: `c07e62d39dfe95b601d328672839f693daceb15c`. The worktree already contained uncommitted Phase 2/3 and Copilot migration work when this scope began; no existing changes were discarded. Phase 4 was authorized by the user's request to complete Phases 4 and 5.

## Implemented

- Migration `0007_phase4_5.sql` adds identity-keyed contributor payout data and Phase 5 submission/evidence/verification records. The migration keeps foreign keys unqualified so the project's isolated per-test schemas work.
- `/connect` uses the authenticated GitHub session ID, CSRF protection, email validation, AES-256-GCM encryption with a versioned `v1` envelope and identity-bound associated data, masked output and escaped page content.
- Each saved/updated connection increments a durable version and enqueues a distinct claim-resume job. The job intentionally does nothing until Phase 6 creates authoritative award records; it cannot create an award or payment.
- The endpoint explains that the address is self-declared and does not reserve a bounty or send money.

## Local verification

Executed with the repository-pinned Node 22.23.4 and pnpm 10.29.3:

- `pnpm test` — 36 files, 194 tests passed. Phase 4 focused integration coverage includes `connect.test.ts`, `connect-status.test.ts`, and `claim-readiness.test.ts`.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm build` — passed.
- `git diff --check` — passed.

The integration tests use a synthetic authenticated GitHub identity and isolated local PostgreSQL schemas. They prove encryption, masking, CSRF, stable identity, version-scoped resume events and no payment side effect. No actual contributor GitHub browser login or PayPal ownership verification was performed.

## Live walkthrough

- Signed in as the contributor through the GitHub App OAuth callback on the stable Ngrok domain and returned to `/connect`.
- Saved the sandbox recipient from local `.env` and corrected the earlier saved value. A local database check found one contributor row for Me-cha, confirmed a `v1` encrypted envelope, and compared the decrypted value to `PREFLIGHT_SANDBOX_RECIPIENT` in memory (`matchesConfiguredRecipient: true`, connection version 4). The address itself was not printed or recorded.
- The page displayed only a masked destination. No payout or payment request was made. The tunnel health endpoint returned `ready`, and Ngrok request inspection was disabled.
- The captured server output contained no configured recipient. Automated tests also cover log redaction and prevent another contributor's address from appearing in the signed-in user's response.

## Final verification

Using Node 22.23.4 and pnpm 10.29.3:

- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm test` with the explicitly configured local `gitpay_test` database — 36 files, 194 tests passed.
- `pnpm build` — passed.
- `bash -n ngrok.sh`, `git diff --check`, and `GET /healthz` — passed; stable Ngrok tunnel reports `inspect: false`.

Phase 6 must snapshot connected payout destinations into immutable payout intents before any transfer exists. The connected destination remains self-declared and does not prove PayPal account ownership.
