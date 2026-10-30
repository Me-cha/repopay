# Phase 02 evidence — authentication and action confirmations

Date: October 28, 2026. Branch: `feat/phase-02-auth-confirmations`, uncommitted working tree based on `c07e62d39dfe95b601d328672839f693daceb15c`. User authorized Phase 2; no commit, push or deployment requested.

## Status

Implementation, local verification and the live owner-account login/cancellation/replay walkthrough are complete. Independent review found three Important issues, all fixed with failing-then-passing regression tests. The live second-account permission-revocation walkthrough remains pending, so Phase 2 is not yet declared fully complete.

## Implemented behavior

- Signed, expiring, single-use OAuth state bound to a browser cookie, PKCE S256, verified GitHub user identity and local-only return paths.
- Opaque hashed session cookies; AES-256-GCM encrypted access/refresh tokens with context AAD; serialized refresh, token-generation CAS and logout invalidation. Confirmed invalid refresh deletes the session; transient provider failures preserve it and deny the request.
- Current installation access plus current user-token repository read/write checks. No cached writer fallback or installation-only human authority.
- Stable read-only cancellation preview, CSRF/Origin-protected token preparation, hash-only action tokens, exact version/action/params binding, escaped HTML, no-store/no-referrer and redacted URLs.
- OPEN-only draft cancellation, excluding capture reservations/funded evidence. Cancellation, activity, token consumption and projection job commit together. Expiry is rechecked after lock waits. Safe scoped status polling supports recovery from a lost POST response.
- Bot `/bounty cancel` links to the preview. Cancelled projections explain no payment/refund and remove the open badge. No PayPal call is part of this implementation.

## Automated evidence

Node 22 and pnpm 10.29.3; PostgreSQL 16 with `gitpay_test`. Tests use isolated schemas and block unmatched external HTTP calls. All GitHub/OAuth provider behavior here is mocked, not live evidence.

Baseline before changes: 110 passing tests. Initial implementation: 143 passing tests in 19 files plus typecheck, lint and build. An additional lock-wait expiry regression was demonstrated failing (HTTP 303 instead of 409), then passing after checking the current time inside the transaction. Aggregate run before independent review: **144/144 tests in 19 files passed**, plus typecheck, lint and build. Nine affected Markdown documents passed local target-path checks; `git diff --check` passed. Final run after all review and browser fixes: **148/148 tests in 19 files passed**, plus typecheck, lint, build and `git diff --check`. Nine affected Markdown files had no missing local link targets. The review regressions reproduced a retained advisory lock after timeout, blocked browser logout, leftover prior sessions on login and missing browser recovery links; all passed after fixes.

Commands:

```sh
pnpm typecheck
pnpm lint
TEST_DATABASE_URL=postgresql://gitpay:gitpay@127.0.0.1:5433/gitpay_test pnpm test
pnpm build
```

Focused suites: `oauth.test.ts`, `permissions.test.ts`, `confirm.test.ts`, `cancel-draft.test.ts`, `oauth-provider.test.ts`, `log.test.ts`. Cases cover wrong browser/state replay/expiry/open redirects, failed exchange, token encryption/context swaps, concurrent refresh, logout during refresh, confirmed revocation vs outage, read/write separation, private repository scope, expired sessions, token replay/double POST, stale versions, CSRF/Origin/body tampering, HTML escaping, safe DTOs, capture reservation serialization and funded-state rejection. Capture fixtures simulate the reservation boundary; the real capture worker is Phase 3.

Migrations 0002 and 0003 applied successfully to the existing local development database. Session TTL/state TTL configuration added locally without replacing credentials. The schema-qualified generated FK was corrected to follow the existing migration convention and preserve isolated-schema tests.

## Live evidence and remaining gates

User explicitly authorized cancelling the existing $30 unfunded draft on [Me-cha/Razix issue #2](https://github.com/Me-cha/Razix/issues/2), updating its bot comment and granting GitPay-dev OAuth consent. Verified in Brave against the actual GitHub App and local Postgres/server on port 3000:

1. GitHub consent, code exchange and current user/repository access succeeded. Preview showed the correct repository, issue, $30.00 and OPEN state.
2. Followed the canonical bot comment's review link. GET retained OPEN and issued no token; Prepare confirmation produced the final preview; Enter activated Confirm cancellation.
3. Status page showed CANCELLED and its poll reported “Status is up to date.” Local database: version 1, exactly one `draft_cancelled` activity and one consumed action token; sync job done with no attention flag.
4. Reopening the consumed URL rejected with current CANCELLED state and a working status link. No second mutation occurred.
5. GitHub canonical comment [6463878655](https://github.com/Me-cha/Razix/issues/2#issuecomment-6463878655) showed CANCELLED, no payment/refund and retained history. Issue metadata showed no labels after `bounty-open` removal. The GitHub issue itself remains open.
6. Deliberately expired the local walkthrough session; authenticated status returned “Please sign in again.” Fresh OAuth restored status access. Browser Sign out succeeded and showed the signed-out page.
7. Desktop screenshot and keyboard submission verified readable controls, pending state and result. No application console warnings/errors were observed; unrelated wallet-extension warnings were excluded.

A real browser caught an additional integration issue: no-referrer causes native form POSTs to send `Origin: null`. Temporary safe diagnostics proved CSRF matched while Origin did not. Native submission failed; same-origin CORS-mode fetch succeeded with strict Origin/CSRF and no-referrer retained. Diagnostic code was removed. Mutation forms explicitly require JavaScript; no-JavaScript pages explain the limitation. See [MDN's Origin/referrer-policy behavior](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy#effect_on_the_origin_header). Only mock tests use synthetic Origin headers.

Local screenshots: `/tmp/gitpay-setup/phase2-preview.png` and `/tmp/gitpay-setup/phase2-cancelled.png` (not tracked; no bearer URLs). OAuth/action tokens and provider payloads are not retained in this evidence.

Permission removal and refresh races are automated with controlled provider fixtures. The owner account's write permission cannot be removed through ordinary repository collaborator settings; do not silently treat mocks as a live second-account revocation test. Real token rotation requires provider expiry and is not claimed from a fresh login.

## Provider references checked

- [GitHub user token flow, state and PKCE](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [Expiring user token refresh](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens)
- [GitHub App best practices](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/best-practices-for-creating-a-github-app)

No later phase is complete or authorized by this evidence. Production deployment, full rate limiting/session cleanup, funding, payouts and funded-cancellation review remain outside this slice.

## Review dispositions

- Important, fixed: an uncertain refresh-lock acquire/unlock now destroys the connection instead of pooling it. A real PostgreSQL timeout regression validates lock release.
- Important, fixed: browser logout and previous-session replacement validate local identity/CSRF without provider refresh. Provider outage cannot keep a valid local session signed in after logout.
- Important, fixed: used/stale/expired confirmations offer authorized current status and a fresh preview where applicable. Reauthentication preserves the action destination.
- Minor, fixed October 29: cancellation, token preparation and funding confirmation now lock the installation row before the bounty row (`lockBounty` in `actions/guards.ts`), matching installation reconciliation. Regression `confirmation and installation reconciliation lock rows in the same order` failed with HTTP 503 (deadlock) before the fix.
- Minor, fixed October 29: bounty projections serialize per issue, and a cancelled bounty's projection leaves the badge alone while a replacement draft exists on that issue. Regression `delayed cancelled projection keeps the open badge` failed before the fix.

The reviewer did not assess later funding/capture/payout/refund implementations, production cleanup/rate limiting, or unobserved real provider token rotation. Those are not claimed by this phase. The real collaborator-revocation walkthrough remains an explicit gate; automated negative coverage does not substitute for that observation.

## Collaborator walkthrough follow-up — October 28, 2026

With the user's explicit approval, GitPay-dev was changed from private to public so an external collaborator could authorize the personally owned App. GitHub confirmed the visibility change. Private app authorization had blocked the collaborator with a GitHub 404 before the callback. The local HTTP/inline worker was restarted after PUBLIC_URL changed; its loaded callback was verified against the HTTPS tunnel. Docker Compose runs only Postgres and does not restart that process.

Observed at 15:11 IST: bounty 3 on [Me-cha/gitpay-test issue #2](https://github.com/Me-cha/gitpay-test/issues/2) changed from OPEN to CANCELLED (version 1). The cancellation actor differs from the owner's earlier walkthrough actor. There is exactly one cancellation activity and consumed token for this bounty; the sync job completed, attention is false, the canonical bot comment shows $30.00 CANCELLED and no payment/refund, and the open badge is absent. This proves collaborator OAuth and completed cancellation, not rejection after permission removal. The user confirmed that the collaborator still had repository access, so this was an authorized positive test. The user subsequently deferred the live revoked-write test and authorized moving forward; it remains unverified.
