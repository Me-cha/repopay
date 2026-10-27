# Phase 01 evidence — October 27, 2026

Status: Phase 01 COMPLETE — local implementation and live draft/status/replay/label, process-crash recovery, access suspension/restoration, unauthorized creation rejection and visible per-command status replies verified. Limitations are recorded below. Changes remain uncommitted on baseline `aaf4043` in the GitPay working tree. Phase 0 was reviewed against its retained provider evidence and its 82-test baseline passed before Phase 1 work.

## Local checks

Using pinned Node 22.23.4 and pnpm 10.29.3, with PostgreSQL 16 on localhost:5433 and isolated schemas in `gitpay_test`:

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS, zero warnings.
- `TEST_DATABASE_URL=postgresql://gitpay:gitpay@127.0.0.1:5433/gitpay_test pnpm test`: PASS, 110 tests across 14 files after the status-reply change.
- `pnpm build`: PASS.

These are real local database tests with mocked GitHub responses, not live GitHub workflow evidence. No payment was sent during Phase 1 verification.

Coverage includes raw-byte HMAC rejection, oversized payload rejection, duplicate-delivery races and receipt/enqueue rollback; normalized payload retention; safe stable IDs; installation/repository binding; current write permission; bot/edited/quoted/code-block command rejection; exact USD cents and cap checks; concurrent label/comment creation; lease reclaim and stale-owner fencing; attempt exhaustion; App removal preserving drafts; forged comment markers; serialized projection writes; reconciliation after a lost comment-create response; and pagination bounds.

## Demo isolation

Created [deepakA18/gitpay-demo-http](https://github.com/deepakA18/gitpay-demo-http) from [paypal/paypalhttp_node](https://github.com/paypal/paypalhttp_node), source commit `3ae86251a596c0b9152caa488b8e7ffc92939299`. Original MIT license and attribution retained. Independent root commit `ba2d5f4`; GitHub API reports `fork: false`. Its only remote is its own origin. Demo CI runs two dependency-free Node tests; both passed locally. No PayPal-org issues, comments or pull requests were created.

The existing `gitpay-dev` App belongs to Me-cha and had no configured permissions/events. The user selected a separate private App under deepakA18. Registered private App `gitpay-demo-deepak` under deepakA18 with Issues read/write and Metadata read-only. GitHub confirmed registration. The user generated its private key, which is configured only in the ignored local `.env`. Installation access was verified by an installation-token repository listing: only `deepakA18/gitpay-demo-http`. Issues and issue_comment subscriptions and signed webhook configuration are active. Credentials remain local.

## Live walkthrough

- [Demo issue #1](https://github.com/deepakA18/gitpay-demo-http/issues/1), [create command](https://github.com/deepakA18/gitpay-demo-http/issues/1#issuecomment-6437847260), [bot projection](https://github.com/deepakA18/gitpay-demo-http/issues/1#issuecomment-6437849926).
- GitHub delivered create, status, label and removal events with HTTP 202. Initial setup ping/installation events returned 401 before the webhook secret was configured; later signed deliveries succeeded.
- Requested real redelivery of the create webhook: 202, with one persisted bounty and no duplicate bot comment.
- Added and removed `bounty:$50`, then issued `/bounty status`. Final state: one OPEN bounty, amount 5000 cents, needs_attention=false, one App-owned status comment. All six resulting jobs completed on attempt one.
- Local primary migration completed; receiver runs on port 3107 behind a temporary Cloudflare Quick Tunnel. This is a development endpoint, not deployment evidence. It requires the local server and tunnel processes to remain running; a new tunnel requires updating the App callback URL. No money moved.

## Live recovery and access loss

- Stopped the identified demo receiver/inline worker, then used the real queue and projection handler in a separate process. The initial three-second lease expired during network calls and correctly rejected the stale database write. Repeated with a 15-second lease, wrote the existing GitHub projection, and killed the process with SIGKILL before job completion (exit 137).
- Restarted the standard compiled receiver/inline worker. The expired job was reclaimed and completed on attempt three (initial short lease, killed attempt, successful recovery). The additional queued projection also completed. GitHub still contains exactly one bot projection, comment 6437849926, and the database still has one 5000-cent OPEN bounty.
- Suspended only the demo installation through GitHub's authenticated App API (204). Its signed `installation.suspend` delivery returned 202. The installation suspension timestamp was persisted, the bounty remained OPEN at 5000 cents, and needs_attention became true with an access-restoration instruction.
- Restored the same installation (204); signed `installation.unsuspend` returned 202. Refresh/projection jobs completed, needs_attention cleared, and the existing comment was retained. No refund or payment path ran.
- During the deliberate receiver downtime, bot edit deliveries received 502; one further edit delivery reported 500. Explicit redelivery of that event succeeded with 202. These are recorded interruption outcomes, not claims of uninterrupted availability. Edited bot comments do not enqueue business actions.
- Prepared [authorization test issue #2](https://github.com/deepakA18/gitpay-demo-http/issues/2). It has no bounty. The second-account result is recorded below.

## Final authorization check and limitations

- Unauthorized-account live walkthrough passed: Me-cha posted `/bounty create 25` on issue #2; the current GitHub collaborator permission endpoint returned `read`. The bot rejected creation with a write/maintain/admin requirement. [Rejection reply](https://github.com/deepakA18/gitpay-demo-http/issues/2#issuecomment-6442728519). Database verification found no bounty for issue #2; the original issue #1 remained OPEN at 5000 cents.
- The temporary tunnel had become unavailable before these comments arrived; GitHub recorded 502, so absence of a bounty initially did not establish rejection. Restored the tunnel, configured its new URL and matching secret, and redelivered the three missed comment events. All redeliveries returned 202 and all three command jobs completed on their first attempt. Two replies on issue #2 correspond to its two distinct commands (the initial malformed `/bounty 50` and the valid test command), not duplicate processing.
- Live suspension/restoration is verified below; permanent App uninstallation remains covered by the local deletion test rather than uninstalling the configured demo App.
- Phase 02 and later remain unimplemented. No funding links, checkout, payout or refund paths are enabled.

## Implementation notes

GitHub REST uses the existing bounded fetch transport with Zod schemas instead of a new Octokit dependency. Intake returns 202 after atomic receipt/job commit. Phase 1 startup validates only consumed settings with `parseGitHubRuntimeEnv`; full future application validation remains strict. Bounty creation is an internal leased-worker service after live permission checks, not an externally callable authenticated action. Badge operations are in `github/app.ts` rather than a separate labels module. Database time governs leases. Scheduled recovery remains Phase 10; failed jobs retain generic safe reasons and require investigation/reconciliation.

Provider contracts checked against [GitHub webhook signatures](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries), [App REST endpoints](https://docs.github.com/en/rest/apps/apps), and [collaborator permissions](https://docs.github.com/en/rest/collaborators/collaborators).

## Status reply usability change

At the user's request, each new `/bounty status` comment now receives a visible reply with the exact USD amount and current draft state. The existing summary is still synchronized. Replies remain keyed to the durable command job, so retry/redelivery does not create duplicate replies.

Added a regression covering a read-only participant, two distinct status commands, repeated handler execution and a lost create-comment response. It failed before the change and passes afterward. Full verification: `pnpm typecheck`, `pnpm lint`, `pnpm test` (110 tests, 14 files), `pnpm build`, and `git diff --check` all passed. Restarted the local demo receiver with the updated build.

Live verification: [new status command](https://github.com/deepakA18/gitpay-demo-http/issues/1#issuecomment-6442853745) produced a [fresh status reply](https://github.com/deepakA18/gitpay-demo-http/issues/1#issuecomment-6442857367) showing $50.00 USD, OPEN, unfunded.
