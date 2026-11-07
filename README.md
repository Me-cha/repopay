# Repopay

**Current MVP scope:** finish the basic GitHub → sandbox funding → PR review → qualifying merge → automatic payout journey. The broader model-evaluation, organization, refund and recovery walkthroughs are deferred by user direction. The local v5 sandbox profile requires an exact bounty scope and retains all payment guards; hosted merge-to-payout completion remains pending. See the [short foundation checklist](docs/phases/live-walkthroughs.md#active-foundation-mvp-checklist) and [scope decision](docs/decisions/0021-foundation-mvp-scope.md).

**October 31 verifier update:** prompt v3 now includes bounded exact-head source/test context. Local verification and the PR #9 live regression review passed. The first v3 evaluation failed 17/18; after correcting incomplete fixtures, the new evaluation passed 18/18 and the user accepted v3 for explicitly scoped sandbox demos. Settlement remains off without an exact approved bounty scope. Existing paid awards and delivery reconciliation remain intact. See [ADR 0016](docs/decisions/0016-source-context-review.md).

**Fund an issue. Merge a qualifying solution. Pay the contributor.**

Repopay is a GitHub App under sandbox validation that connects issue bounties to PayPal. Maintainers fund an issue, contributors submit pull requests, AI assesses the proposed solution, and a qualifying merge triggers payment through a deterministic policy.

The principle is **glue, not a platform**: development stays in GitHub, checkout and payouts use PayPal, and small authenticated pages handle confirmations. A dashboard (optional for users, required in the MVP) displays progress without becoming another place to manage the work.

> **Project status (October 30, 2026):** Phases 0, 1 and 4 have recorded completion evidence. Phase 2 has a deferred live revocation check. Phase 3 has a recorded $40 sandbox capture, with receipt/recovery acceptance still open. Phase 5 is advisory and incomplete: Copilot **Auto** is the accepted profile, and the current v2 application-adapter evaluation passed 18/18; the October 31 funded competing-PR case passed; same-revision failed-review recovery also passed; remaining Phase 5 gates stay open. The latest [Phases 0–5 review](docs/evidence/00-05-review.md) records fixes and remaining blockers. Phase 6 now has local award selection, immutable payout intents, item reconciliation and claim resumption. Automatic award selection is enabled only for the existing $50 isolated sandbox demo under ADR 0008; remaining Phase 5 checks are deferred and the first sandbox payout is provider-confirmed SUCCESS, with recipient receipt confirmed; delayed-claim/two-author live acceptance remains open. See [Phase 6 evidence](docs/evidence/06-summary.md).

Phases 7–10 now have local implementations and automated verification. Their live walkthroughs, along with outstanding Phase 5–6 cases, remain on the [final live checklist](docs/phases/live-walkthroughs.md). See [Phase 10 evidence](docs/evidence/10-summary.md). Build with `pnpm build`, then open `/dashboard/` on the running server and sign in.

Phase 11 deployment preparation and local restore safeguards are implemented. The user deployed https://repopay.onrender.com/ with a fresh database. Hosted health, GitHub sign-in/intake, unfunded cancellation and user-observed dashboard checks passed; hosted provider/payment/recovery acceptance remains pending. See [deployment instructions](docs/deployment.md) and [Phase 11 evidence](docs/evidence/11-summary.md).

Phase 12 handoff tooling and the [final acceptance matrix](docs/evidence/12-acceptance.md) are prepared locally. **Full MVP acceptance remains pending**; see the [demo outline](docs/demo.md) and [verification record](docs/evidence/12-summary.md).

## Intended flow

1. A maintainer comments `/bounty create 50` on an issue, or adds `bounty:$50`. This creates an **unfunded draft** when the App is installed and its receiver is running.
2. The repository owner connects a Copilot sponsor account for Copilot Auto. The maintainer signs in, reviews frozen criteria/model/sponsor, confirms the amount and pays through PayPal checkout. Only confirmed capture makes the bounty funded.
3. Anyone with repository access can submit a linked PR, such as `Fixes #12`. There is no exclusive acceptance or reservation.
4. The runtime AI verifier assesses the changes and reports its reasoning in a GitHub Check Run. CI and deterministic policy constrain the result.
5. The first qualifying merged PR under the funded terms earns the bounty. A review case requires an authenticated maintainer decision before payment.
6. Eligible contributors connect their PayPal details. A committed award remains theirs while payment details or transfer problems are resolved.

The `bounty-open` label means submissions remain open, including after funding. `bounty-paid` appears only after confirmed payout; committed awards remove `bounty-open`. A merge alone does not mean payment succeeded. Read the bot comment for funding and delivery status.

Typing a command or adding a label on GitHub today does not create a payment. The App must be installed, configured and running; checkout requires authenticated confirmation.

## Fair participation and cancellation

Funded bounties are commitments. A maintainer may **request** cancellation for a serious, evidenced reason; they cannot immediately withdraw the funds.

- Multiple contributors may submit. Opening the first PR or saying “I'll work on it” does not reserve the reward.
- An existing qualifying submission blocks ordinary cancellation while its claim is unresolved. This protection does not automatically make that submission the winner.
- A genuinely independent earlier internal fix, duplicate bounty or invalid issue may justify an exception. Copying a contributor's fix and calling it internal does not.
- The locally implemented exception flow uses public notice, evidence collection and an independent operator’s decision. No AI output authorizes a refund. The 72-hour period is frozen before funding and begins only after confirmed notice publication.
- Accepted awards cannot be cancelled because the contributor has not connected PayPal or a payout failed.
- Without an independent operator, funded refunds remain unavailable. App removal or missing repository access also blocks new refund authorization.

These rules prevent the normal recorded cancel-then-merge abuse path. They cannot force a maintainer to merge, prevent off-platform copying, or guarantee discovery of unseen work. Read [the cancellation decision and its limitations](docs/decisions/0001-open-participation-and-cancellation.md).

## Commands

Currently available: `/bounty create`, `/bounty status`, `/bounty fund`, and `/bounty cancel` for an unfunded draft. A write-authorized `/bounty cancel` issue comment cancels only an unfunded draft directly; funded refunds retain their separate safeguards. Sandbox funding requires merchant, trusted CI and an explicit Copilot model configuration. Funded cancellation remains disabled in the current deployment and all legacy funded terms. Phase 8 adds a locally verified, independently reviewed exception flow for explicitly scoped new version 5 terms; its real 72-hour refund walkthrough is deferred.

| Command                   | Purpose                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `/bounty create <amount>` | Create an unfunded USD bounty draft                                                                             |
| `/bounty fund`            | Get an authenticated funding link                                                                               |
| `/bounty retry [#issue] [<head SHA> <base SHA>]` | Request a fresh review on the PR; current write permission and attempt limits apply |
| `/bounty status [#issue]`          | View progress and request reconciliation                                                                        |
| `/bounty approve`         | Preview and confirm payment for a review case                                                                   |
| `/bounty reject <reason>` | On the linked PR: reject its reviewed revision before merge; preserve its evidence                                              |
| `/bounty cancel [reason]` | Cancel an unfunded draft directly on its issue; funded refunds remain separately gated |
| `/bounty link <pr>`      | Explicitly link a same-repository PR                                                                            |
| `/bounty contribute [#issue] <head SHA> <base SHA> <reason>` | On the PR: declare your own additional contribution |
| `/bounty confirm-contributor [#issue] @login <head SHA> <base SHA> <reason>` | On the PR: separately confirm a contributor at that revision |

On the PR, a maintainer can post `/bounty retry [#issue]` (or the full revision-bound command supplied by the bot). Results and acknowledgements appear on the PR. `/bounty status [#issue]` also works there. Existing authenticated retry links remain compatible fallbacks.

Maintainer commands require current repository write/maintain/admin permission; `/bounty status` is available to participants with access. Financial actions require confirmation or the deterministic settlement policy. Labels never fund or refund money.

## Architecture

```mermaid
flowchart LR
    GH[GitHub issues, PRs and CI] -->|Signed webhooks| API[Express server]
    PP[PayPal sandbox] -->|Verified events| API
    API --> DB[(Postgres state and jobs)]
    DB --> W[Worker]
    W --> AI[Copilot SDK verifier]
    AI --> P[Deterministic payment policy]
    P --> DB
    W -->|Orders, payouts, reviewed refunds| PP
    W -->|Comments and Check Runs| GH
    UI[Confirmation and connection pages] --> API
    VIEW[Optional read-only dashboard] --> API
```

| Concern               | Planned choice                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Development assistant | Codex, guided by `AGENTS.md`                                                             |
| Runtime               | Node.js 22, TypeScript strict, pnpm workspaces                                           |
| Backend and storage   | Express 5, PostgreSQL 16, Drizzle, durable database jobs                                 |
| GitHub integration    | GitHub App, bounded REST adapter, webhooks, Check Runs and OAuth                                      |
| Payments              | PayPal sandbox Orders, capture, Payouts, refunds and webhooks                            |
| Runtime AI            | Copilot SDK with personal-repository owner sponsorship; Zod validation                        |
| Web                   | Server-rendered confirmation pages; React/Vite + AG Grid for the optional dashboard      |
| Validation            | Vitest, integration tests, property tests, verifier evaluations and sandbox walkthroughs |
| Deployment target     | Render web deployed manually; full hosted acceptance pending                                      |

Codex is the coding assistant; Copilot SDK is the selected runtime verifier provider. The model receives no unrestricted authority to move money. See [the provider decision](docs/decisions/0005-copilot-verifier.md).

## Start here

```sh
git clone https://github.com/Me-cha/repopay.git
cd repopay
```

For a credential-free local verification rehearsal, install Node **22.23.4**, pnpm **10.29.3** and Docker Compose, then run:

```sh
pnpm install --frozen-lockfile
docker compose up -d postgres
# Wait for postgres to be healthy. Once per new volume:
docker compose exec -T postgres createdb -U repopay repopay_test
export TEST_DATABASE_URL=postgresql://repopay:repopay@127.0.0.1:5433/repopay_test
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm demo:seed
```

An existing `repopay_test` database can be retained. Tests create isolated schemas and use fake providers; the browser harness starts its own local server. These checks do not load `.env`, spend Copilot allowance or send payments. They do require PostgreSQL and Docker for restore tests. Live application startup additionally needs credentials and migrations from [setup](docs/setup.md); do not overwrite an existing `.env`. The seeder is a dry run unless explicitly executed as described in [the demo guide](docs/demo.md).

Start with [the phased MVP review plan](docs/phases/README.md) and [Phase 00](docs/phases/00.md). Read [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the architecture and [AGENTS.md](AGENTS.md) for repository instructions. Phase 0 provides the executable server workspace. Follow [local setup and provider probes](docs/setup.md); see [Phase 0 evidence](docs/evidence/00-summary.md) for actual checks and remaining gates.

The tracked [.env.example](.env.example) lists validated configuration. Copy it to `.env` and fill in credentials locally. Credentials are intentionally blank; choose an explicit accessible Copilot model before new funding or model generation. Startup and preflight validate their respective required settings. Do not paste secrets into issues, PRs or agent instructions.

External setup will require a GitHub App and demo repository, PayPal sandbox accounts with Payouts access, and a consenting personal-repository owner Copilot sponsor with Auto access (organization support remains blocked). Later funded-cancellation testing also needs an independent reviewer identity; unfunded draft cancellation does not. Exact setup requirements are recorded in section 3 of the plan; verify provider documentation during implementation.

## Repository guide

| Path                                                     | Purpose                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)         | Canonical architecture, state model, phases and acceptance criteria                                    |
| [PLAN.md](PLAN.md)                                       | Link to the canonical plan                                                                             |
| [AGENTS.md](AGENTS.md)                                   | Codex instructions and current folder map                                                              |
| [Agent.md](Agent.md)                                     | Pointer to `AGENTS.md`                                                                                 |
| [CONTRIBUTING.md](CONTRIBUTING.md)                       | Contribution and verification expectations                                                             |
| [docs/phases/](docs/phases/)                             | Phase status, task contracts and exit gates                                                            |
| [docs/setup.md](docs/setup.md)                           | Local installation, configuration and explicit provider probes                                         |
| [docs/evidence/](docs/evidence/)                         | Recorded local verification and external blockers                                                      |
| [docs/phases/review-todo.md](docs/phases/review-todo.md) | Pre-build remediation checklist for the reviewed plan                                                  |
| [docs/decisions/](docs/decisions/)                       | Product and architecture decisions with reasoning                                                      |
| [packages/server/](packages/server/)                     | Health/webhook server, workers, OAuth sessions, draft confirmations and provider probes |
| [packages/web/](packages/web/)                           | Read-only React/Vite dashboard with AG Grid Community                                                  |
| [postman/](postman/)                                     | Read-only API collection and opt-in local synthetic ping                                                 |

Folder changes must update the current map in `AGENTS.md`, affected README links and the plan's target layout in the same change. The PR template includes this requirement.

## Scope and contributing

The MVP targets USD code bounties and PayPal sandbox. Live money, third-party funding, partial awards, non-code work and other source hosts are outside the initial scope. This is not a production escrow service or a guaranteed dispute-resolution system.

See [CONTRIBUTING.md](CONTRIBUTING.md). Product behavior, credentials and integration success should be documented only when implemented and verified. The implementation plan records the hackathon target; deadlines and eligibility still need official verification.

## License

[MIT](LICENSE), as selected in the implementation plan.

The runtime uses repository-owner-sponsored Copilot Auto in v4 funded terms, preserving legacy terms and recording the concrete serving model for each review ([ADR 0007](docs/decisions/0007-copilot-auto-model.md)). Auto v2 passed its recorded live evaluation and the scoped $50 sandbox settlement succeeded. Broader activation remains gated by the deferred acceptance cases. Organization sponsorship remains blocked; real owner revocation/reconnection is recorded. SDK usage units and attempt caps do not provide a monetary budget.

Phase 7 maintainer review is implemented locally with a shared award guard, exact confirmation and immutable rejection history. Live acceptance remains pending; see [Phase 7 evidence](docs/evidence/07-summary.md).

Remaining live walkthroughs are deferred to the final validation session after local implementation, per user direction. See the [live checklist](docs/phases/live-walkthroughs.md) for outstanding cases and prerequisites.

Maintainers review contributor PRs directly on GitHub: comment, request changes or close unmerged work. Copilot supplies advisory feedback, not final acceptance. `/bounty reject <reason>` on the PR records a revision-bound bounty decision without requiring merge; ordinary comments never move money. Repopay’s payment-review page contains approval only. See [ADR 0015](docs/decisions/0015-premerge-pr-feedback.md).

October 31 update: the full Auto v3 evaluation completed and **failed (17/18)**. That historical run did not authorize v3 awards; the later corrected 18/18 run and explicit scoped acceptance are recorded below. See [evaluation result](docs/evidence/05-auto-v3-result.md). Two-party revision-bound attribution is implemented locally; its two-recipient live payout is still pending. The real 72-hour refund test remains deferred.

October 31 latest: the corrected complete-context Auto v3 evaluation passed 18/18; the user explicitly accepted v3 / SDK 1.0.28 for default-off, exact-bounty sandbox demos (ADR 0008). The prior 17/18 failure remains historical evidence. Hosted two-author workflow acceptance and other unchecked cases remain pending; no settlement environment scope was enabled. See [evaluation evidence](docs/evidence/05-auto-v3-result.md).

GitHub bot comments provide the next action on the issue or PR: sponsor setup/funding/status on the issue, review feedback and copyable contribution commands on the PR, and recipient connection/payment progress on the winning PR. Account consent, payout details and financial confirmations use authenticated links. See [ADR 0018](docs/decisions/0018-github-contributor-commands.md); hosted acceptance of the new command flow remains pending.

The dashboard includes a first-visit guided tour, remembered once per GitHub account across browsers. Skip, Close and completion permanently dismiss it. Apply migration 0020 before starting this release; see [onboarding behavior and verification](docs/evidence/dashboard-onboarding.md).
