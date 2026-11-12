<div align="center">

# Repopay

### Fund a GitHub issue. Merge a qualifying fix. Pay the contributor automatically.

[![Hosted on Render](https://img.shields.io/badge/Hosted_on-Render-111111?logo=render)](https://repo-pay.onrender.com)
[![GitHub App](https://img.shields.io/badge/GitHub_App-Install-181717?logo=github)](https://github.com/apps/repo-pay-app)
[![PayPal Sandbox](https://img.shields.io/badge/PayPal-Sandbox-003087?logo=paypal)](https://developer.paypal.com/tools/sandbox/)
[![PYUSD](https://img.shields.io/badge/PYUSD-Solana_devnet-9945FF?logo=solana)](https://github.com/deepakA18/gitpay-demo-http/issues/21)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[Open Repopay](https://repo-pay.onrender.com) · [Install the GitHub App](https://github.com/apps/repo-pay-app) · [Explore the demo repository](https://github.com/deepakA18/gitpay-demo-http) · [Watch the demo](https://youtu.be/NLSl8LVPmsw)

</div>

> **Hackathon safety boundary:** Repopay currently uses **PayPal Sandbox** and **PYUSD on Solana devnet**. It does not move production money, support PYUSD mainnet, or act as a regulated escrow provider.

![Repopay escrow overview showing bounty totals, lifecycle stages, repositories, and actionable work](assets/dashboard-overview.png)

## What is Repopay?

Repopay is a GitHub App that turns repository issues into funded code bounties without moving development into another platform.

A maintainer creates and funds a bounty from a GitHub issue. Contributors submit ordinary pull requests. Repopay collects the exact PR revision, trusted CI results, contribution evidence, and a repository-owner-sponsored GitHub Copilot review. When a qualifying PR is merged, deterministic settlement rules commit the award and deliver it through PayPal Sandbox or PYUSD on Solana devnet.

The AI review supplies evidence; it never gets authority to move money. Authorization, CI, revision matching, award ordering, allocation, idempotency, and payment reconciliation remain server-enforced.

Interface screenshots below use the current built UI with deterministic, non-secret demo data. The GitHub screenshots and linked examples come from the public demo repository.

### Useful links

| Resource | Use it for |
| --- | --- |
| [Hosted application](https://repo-pay.onrender.com) | Sign in, inspect bounties, connect payout details, and view the dashboard |
| [Repo Pay GitHub App](https://github.com/apps/repo-pay-app) | Install Repopay on a personal repository |
| [Public demo repository](https://github.com/deepakA18/gitpay-demo-http) | Inspect real issues, PR reviews, labels, and completed sandbox/devnet journeys |
| [Demo video](https://youtu.be/NLSl8LVPmsw) | Watch the end-to-end product walkthrough |
| [Completed USD example](https://github.com/deepakA18/gitpay-demo-http/issues/35) | See a GitHub issue reach a confirmed PayPal Sandbox payout |
| [Completed PYUSD example](https://github.com/deepakA18/gitpay-demo-http/issues/21) | See a qualifying merge reach a confirmed PYUSD devnet wallet payout |

<a href="https://youtu.be/NLSl8LVPmsw">
  <img src="https://img.youtube.com/vi/NLSl8LVPmsw/maxresdefault.jpg" alt="Watch the Repopay product demo on YouTube" width="800">
</a>

## How it works

```mermaid
sequenceDiagram
    actor M as Maintainer
    participant GH as GitHub
    participant R as Repopay
    participant AI as Render + Copilot review
    participant P as PayPal Sandbox / Solana devnet
    actor C as Contributor

    M->>GH: /bounty create 50
    GH->>R: Signed GitHub webhook
    R-->>GH: Unfunded bounty draft + funding link
    M->>R: Review frozen terms and fund
    R->>P: Capture USD or verify PYUSD transfer
    C->>GH: Open PR linked to the issue
    R->>AI: Review exact PR revision and trusted CI
    AI-->>GH: Repopay Check and evidence
    M->>GH: Merge qualifying PR
    R->>R: Apply deterministic award policy
    R->>P: Idempotent contributor payout
    R-->>GH: Paid status and delivery evidence
```

1. **Install the App.** A repository owner installs [Repo Pay](https://github.com/apps/repo-pay-app) on selected repositories.
2. **Sponsor reviews.** The personal repository owner connects a GitHub account that is currently entitled to Copilot requests. Review usage belongs to that sponsor, not to Repopay or the PR author.
3. **Create a bounty.** A write-authorized maintainer comments `/bounty create 50` on an issue.
4. **Fund it.** The maintainer follows `/bounty fund`, reviews the frozen issue criteria and policy, then chooses PayPal Sandbox or enabled PYUSD devnet funding.
5. **Submit normal GitHub work.** A contributor opens a PR with `Fixes #<issue>` or the issue uses `/bounty link <PR number>`.
6. **Review the exact revision.** Repopay verifies bounded source/test evidence, trusted CI, contributor attribution, and the Copilot verdict. The result appears on the PR and in GitHub Checks.
7. **Merge and settle.** The first qualifying merged PR under the frozen terms receives the committed award. Missing payout details move the award to `AWAITING_CLAIM`; they do not erase it.

## Try it on your repository

1. Open the [Repo Pay App page](https://github.com/apps/repo-pay-app) and select **Install**. The current sponsorship flow supports personal repositories; organization sponsorship is not enabled.
2. Choose the repositories Repopay may access.
3. Open [Repopay](https://repo-pay.onrender.com) and sign in with GitHub.
4. As the personal repository owner, connect the Copilot sponsor when prompted.
5. Create an issue with a reproducible problem, exact acceptance criteria, and the CI expectations for a valid fix.
6. Post:

   ```text
   /bounty create 50
   ```

7. After Repopay creates the draft, post:

   ```text
   /bounty fund
   ```

8. Review the immutable terms and use only the displayed Sandbox/devnet payment route.
9. Ask a contributor to open a PR containing `Fixes #<issue-number>`.
10. Follow the bot comment and GitHub Check. Merge only when the revision, CI, and review evidence are correct.

The Render free service can cold-start after inactivity, so the first hosted page or webhook response may take longer than later requests.

## GitHub command reference

Commands must be posted as a **new, unquoted GitHub comment**. Repopay ignores commands inside code fences, block quotes, indented code, edited comments, and comments from bots. Amounts use at most two decimal places; SHA arguments are full 40-character Git commit SHAs.

### Issue commands

| Command | Who can use it | Result |
| --- | --- | --- |
| `/bounty create <USD amount>` | Write, maintain, or admin | Creates an unfunded bounty draft. It does not collect money. |
| `/bounty fund` | Write, maintain, or admin | Returns an authenticated funding link. The comment itself cannot move money. |
| `/bounty status` | Any current repository participant | Refreshes reconciliation and reports the current bounty/payment state. |
| `/bounty link <PR number>` | Any current repository participant | Links a same-repository PR. Linking does not reserve or award the bounty. |
| `/bounty cancel` | Write, maintain, or admin | Cancels only a truly unfunded draft. It cannot directly refund captured funding. |
| `/bounty approve` | Write, maintain, or admin | For `NEEDS_REVIEW`, returns the authenticated maintainer decision page. The comment cannot approve payment by itself. |

You can also create a USD draft by adding a label in the exact form `bounty:$50` or `bounty:$50.00`. Label creation still requires a configured, running App and an authorized actor.

### Pull-request commands

| Command | Who can use it | Result |
| --- | --- | --- |
| `/bounty status [#issue]` | Any current repository participant | Refreshes the linked bounty and PR projection. Include `#issue` when a PR could match more than one bounty. |
| `/bounty retry [#issue]` | Write, maintain, or admin | Requests a fresh review of the current open revision, subject to sponsor allowance and attempt limits. |
| `/bounty retry [#issue] <head SHA> <base SHA>` | Write, maintain, or admin | Requests a fresh review only if the PR still matches both exact revisions. |
| `/bounty reject [#issue] <reason>` | Write, maintain, or admin | Rejects that reviewed revision from award consideration while preserving evidence. It does not authorize a refund. |
| `/bounty approve [#issue]` | Write, maintain, or admin | Opens the authenticated decision page for a linked `NEEDS_REVIEW` bounty. |

The bot prints a revision-bound retry command after each review. Copy that command instead of manually shortening SHAs.

### Multi-author contribution commands

Use these only when a contributor other than the PR author made an award-relevant contribution that is present in the PR's commit evidence.

```text
/bounty contribute #35 <full-head-sha> <full-base-sha> I implemented the UTF-8 decoder and its regression tests.
```

The contributor posts the declaration. A **different** maintainer then confirms it:

```text
/bounty confirm-contributor #35 @contributor <full-head-sha> <full-base-sha> I verified this contribution in the PR commit history.
```

Reasons must contain 10–2000 characters. Both confirmations are tied to the exact head and base revision; a force-push requires new evidence. Confirmation does not guarantee an award or choose an allocation by itself.

### Example: a complete USD issue flow

```text
# Maintainer, on the issue
/bounty create 80

# Maintainer, after the draft appears
/bounty fund

# Contributor, in the PR body
Fixes #35

# Anyone with current repository access
/bounty status #35

# Maintainer, only if a corrected open revision needs another review
/bounty retry #35 <full-head-sha> <full-base-sha>
```

## Review and GitHub states

Repopay publishes the verdict, reasoning, exact head/base SHAs, links to the Check Run, and safe next commands directly on the PR. A verdict is evidence—not an award. Trusted CI, repository access, frozen terms, contributor eligibility, merge state, and deterministic policy must still pass.

![GitHub PR comment showing a Repopay RESOLVES verdict, exact revisions, and retry/status commands](assets/github-review-result.png)

The dashboard gives the same state a compact inspection view without becoming a second work-management surface.

![Repopay contribution detail showing frozen criteria, a partial review, exact allocation posture, and next action](assets/contribution-review.png)

After confirmed delivery, Repopay updates the GitHub issue and replaces `bounty-open` with `bounty-paid`.

![GitHub issue comment showing a confirmed paid Repopay bounty](assets/github-paid-comment.png)

## Funding and payout routes

| Funding route | Maintainer funds with | Contributor receives | Current boundary |
| --- | --- | --- | --- |
| PayPal USD | PayPal Sandbox checkout | USD through PayPal Sandbox Payouts | Supported hosted demo route |
| Direct PYUSD | PYUSD from a Solana devnet wallet | PYUSD to the contributor's saved devnet wallet | Supported devnet test route; no mainnet |
| PayPal Pay with Crypto | PayPal Sandbox crypto checkout, converted by PayPal | USD through PayPal Sandbox Payouts | Optional, merchant-gated, default off |

### PayPal Sandbox

- Funding is not considered complete until Repopay verifies capture—not merely because a browser returned from PayPal.
- Contributors save their own PayPal Sandbox destination from **Payout Settings**.
- Raw payout email addresses are encrypted at rest and never returned by the read API.
- A committed award waiting for payout details remains `AWAITING_CLAIM` and resumes when the recipient connects.
- Payout identities and idempotency keys are persisted before provider calls so retries reconcile the same transfer rather than creating replacements.

![Repopay payout settings showing an account-bound PayPal destination and PYUSD wallet entry point](assets/payout-settings.png)

### PYUSD on Solana devnet

- The user connects a Wallet Standard-compatible wallet on `solana:devnet` and signs an ownership message once.
- Funding signs a server-prepared legacy transaction for the exact amount, treasury, reference, blockhash, and fee instructions.
- Repopay rejects changed networks, accounts, messages, transaction bytes, mint, amount, or receipt evidence.
- Qualifying awards pay PYUSD to the contributor's previously saved wallet. Repopay pays outgoing network/account-creation fees.
- Unsigned expired preparations may be safely recovered after finalized absence checks; signed or ambiguous transfers remain held for reconciliation.
- Mainnet, real custody, and production token transfers are not supported.

![Repopay PYUSD devnet page showing the saved receiving wallet, frozen bounty terms, treasury, and funding action](assets/pyusd-devnet.png)

The hosted demo is already configured for its supported test networks. For a separate deployment, start from the commented variables in [`.env.example`](.env.example) and keep all wallet keys and provider credentials outside version control.

### If you are a contributor

You do not need to fund the bounty or supply Copilot credits. Submit the linked PR and follow its Repopay comment. You may connect your own PayPal Sandbox destination or PYUSD devnet receiving wallet before participating or after winning; a missing destination preserves the committed award in `AWAITING_CLAIM` until you connect it.

## Bounty lifecycle

| State | Meaning | What the user should do |
| --- | --- | --- |
| `OPEN` | Unfunded draft | Review the issue and fund it, or cancel the untouched draft. |
| `CAPTURING` | Funding submitted or uncertain | Refresh status; do not start a second payment. |
| `FUNDED` | Capture/chain receipt confirmed | Contributors may submit; nothing reserves the bounty. |
| `NEEDS_REVIEW` | Evidence requires a maintainer decision | Inspect the exact revision and use the authenticated review flow. |
| `AWAITING_CLAIM` | Award committed, payout destination missing | Awarded contributor connects PayPal or a PYUSD wallet. |
| `PAYING` | Delivery submitted or reconciling | Wait for the existing transfer identity to resolve. |
| `PAID` | All payout items confirmed delivered | Verify provider/wallet receipt and keep the audit history. |
| `CANCELLED` | Draft cancelled or an independently reviewed refund completed | Read history; cancellation alone never proves a refund. |

## Dashboard and first-run guide

The hosted dashboard is intentionally read-only for bounty management. GitHub remains the work surface; the dashboard summarizes money posture, lifecycle distribution, repositories, review attention, payout delivery, and account-bound destinations.

On the first successful dashboard visit, Repopay presents a six-step guided tour. Finishing, skipping, closing, pressing Escape, or reloading consumes the one-time presentation claim, so the guide does not repeatedly interrupt the user.

![First-run Repopay dashboard tour explaining the escrow overview](assets/first-run-tour.png)

## Automatic settlement rules

With deployment-level `SETTLEMENT_ENABLED=true`, Repopay automatically awards supported funded bounties when all frozen conditions pass. There is no per-issue allowlist.

Automatic settlement still requires:

- confirmed funding with the original immutable payment identity;
- a complete linked PR evidence snapshot at the exact revision;
- required trusted GitHub CI contexts passing at that SHA;
- a validated Copilot review under the bounty's frozen verifier contract;
- a qualifying merged PR selected by stable merge ordering, not webhook arrival order;
- confirmed eligible recipients and an exact-sum integer allocation;
- no funding, evidence, authorization, or reconciliation hold.

Disabling settlement stops new awards but does not erase committed awards or stop safe delivery reconciliation.

## Fairness and safety guarantees

- **Open participation:** opening a PR, commenting first, or being “assigned” does not reserve the reward.
- **Stable winner selection:** the first qualifying merged PR under the frozen terms wins; webhook timing is not the ordering rule.
- **Exact evidence:** reviews are fenced to exact head/base SHAs and bounded installation-authenticated source/test context.
- **AI is untrusted:** issue text, comments, diffs, tests, and model output are treated as data. Server policy controls awards and money.
- **Current authorization:** GitHub write/admin checks are repeated for maintainer actions; sponsor revocation fences in-flight review use.
- **No duplicate money movement:** integer amounts, database locks, immutable intents, and provider reconciliation guard funding, awards, payouts, and refunds.
- **Awards survive delivery problems:** app removal, missing payout details, a failed payout, or a closed/rejected PR cannot silently erase a committed award.
- **Funded cancellation is exceptional:** when enabled in frozen terms, it requires evidence, public notice, and independent review. Repository write access cannot approve its own refund.
- **Secrets stay server-side:** review executors receive a restricted dispatch identity and do not receive database, payment, GitHub App, treasury, or encryption credentials.

## Architecture

```mermaid
flowchart LR
    GH[GitHub App<br/>issues, PRs, CI, Checks] -->|signed webhooks| WEB[Express web service]
    WEB --> DB[(PostgreSQL<br/>state + durable jobs)]
    DB --> WORKER[Settlement worker]
    DB --> DISPATCH[Review dispatcher]
    DISPATCH -->|pinned task version| RW[Render Workflow]
    RW -->|claim + complete| BROKER[Trusted review broker]
    BROKER -->|isolated request| COPILOT[Owner-sponsored<br/>GitHub Copilot]
    BROKER --> DB
    WORKER --> POLICY[Deterministic<br/>award policy]
    POLICY --> PP[PayPal Sandbox]
    POLICY --> SOL[Solana devnet<br/>PYUSD]
    WORKER -->|comments + Checks| GH
    UI[React read-only dashboard<br/>and confirmations] --> WEB
```

| Layer | Implementation |
| --- | --- |
| Runtime | Node.js 22, strict TypeScript, pnpm workspaces |
| Web/API | Express 5, React, Vite, AG Grid Community |
| Persistence | PostgreSQL, Drizzle migrations, durable leased jobs |
| GitHub | GitHub App webhooks, installation-authenticated API access, OAuth sessions, Check Runs |
| Review | GitHub Copilot SDK with repository-owner sponsorship; isolated Render Workflow execution |
| Payments | PayPal Orders/Payouts in Sandbox; direct PYUSD on Solana devnet |
| Validation | Zod boundaries, Vitest, property/integration tests, Playwright browser journeys, live sandbox/devnet evidence |

Review tasks run with a restricted executor identity. Database, GitHub App, PayPal, treasury, and encryption credentials remain in the trusted web service.

## Run locally

Prerequisites:

- Node.js **22.23.4**
- pnpm **10.29.3**
- Docker with Docker Compose

```sh
git clone https://github.com/Me-cha/repopay.git
cd repopay
pnpm install --frozen-lockfile

docker compose up -d postgres
docker compose exec -T postgres createdb -U repopay repopay_test

cp .env.example .env
# Fill only your own GitHub App, PayPal Sandbox, Copilot sponsor,
# Render and optional PYUSD devnet settings. Never commit .env.

pnpm db:migrate
pnpm build
pnpm start
```

Run the worker in a second terminal:

```sh
pnpm start:worker
```

For local development:

```sh
pnpm dev
pnpm dev:worker
```

For credential-free verification with fake providers:

```sh
export TEST_DATABASE_URL=postgresql://repopay:repopay@127.0.0.1:5433/repopay_test
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Use [`.env.example`](.env.example) as the configuration checklist. The production service definitions are [`render.yaml`](render.yaml) and [`render-workflows.yaml`](render-workflows.yaml); GitHub callbacks use `/oauth/github/callback` and webhooks use `/webhooks/github` on your public origin.

## Repository map

| Path | Responsibility |
| --- | --- |
| [`packages/server/src/github`](packages/server/src/github) | GitHub App intake, permissions, commands, comments, CI, OAuth, and reconciliation |
| [`packages/server/src/reviews`](packages/server/src/reviews) | Durable review admission, dispatch, Render adapter, executor authentication, and result storage |
| [`packages/server/src/verifier`](packages/server/src/verifier) | Bounded evidence collection, exact-revision review, Check publication, and evaluation |
| [`packages/server/src/settlement`](packages/server/src/settlement) | Funding reconciliation, candidate selection, awards, payouts, claims, and refunds |
| [`packages/server/src/paypal`](packages/server/src/paypal) | PayPal Sandbox Orders, captures, payouts, refunds, and verified webhooks |
| [`packages/server/src/solana`](packages/server/src/solana) | PYUSD devnet wallet ownership, funding, delivery, and reconciliation |
| [`packages/web`](packages/web) | Dashboard, guided onboarding, bounty inspection, payouts, and PYUSD wallet UI |
| [`assets`](assets) | Public screenshots used by this README |

## Development checks

Before submitting a change, run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`. Never place credentials, OAuth tokens, private keys, payout addresses, or sensitive webhook payloads in commits or logs.

## License

Repopay is available under the [MIT License](LICENSE).
