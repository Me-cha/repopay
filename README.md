# GitPay

**Fund an issue. Merge a qualifying solution. Pay the contributor.**

GitPay is a planned GitHub App that connects issue bounties to PayPal. Maintainers fund an issue, contributors submit pull requests, AI assesses the proposed solution, and a qualifying merge triggers payment through a deterministic policy.

The principle is **glue, not a platform**: development stays in GitHub, checkout and payouts use PayPal, and small authenticated pages handle confirmations. An optional dashboard displays progress without becoming another place to manage the work.

> **Project status:** Phase 0 local foundation is implemented: workspace, configuration, health endpoint, database migrations and isolated tests. NVIDIA model routing is implemented; Nemotron passed a live schema probe, while DeepSeek inference and the remaining provider setup are still unverified. There is no installed bot, bounty workflow or deployed demo yet. All product flows below describe the intended MVP; payments are sandbox only.

## Intended flow

1. A maintainer comments `/bounty create 50` on an issue, or adds `bounty:$50`. This creates an **unfunded draft** when GitPay is implemented and installed.
2. The bot posts a funding link. The maintainer signs in, confirms the amount and pays through PayPal checkout. Only confirmed capture makes the bounty funded.
3. Anyone with repository access can submit a linked PR, such as `Fixes #12`. There is no exclusive acceptance or reservation.
4. The runtime AI verifier assesses the changes and reports its reasoning in a GitHub Check Run. CI and deterministic policy constrain the result.
5. The first qualifying merged PR under the funded terms earns the bounty. A review case requires an authenticated maintainer decision before payment.
6. Eligible contributors connect their PayPal details. A committed award remains theirs while payment details or transfer problems are resolved.

Typing a command or adding a label on GitHub today does not create a payment. GitPay must first be implemented, installed and configured.

## Fair participation and cancellation

Funded bounties are commitments. A maintainer may **request** cancellation for a serious, evidenced reason; they cannot immediately withdraw the funds.

- Multiple contributors may submit. Opening the first PR or saying “I'll work on it” does not reserve the reward.
- An existing qualifying submission blocks ordinary cancellation while its claim is unresolved. This protection does not automatically make that submission the winner.
- A genuinely independent earlier internal fix, duplicate bounty or invalid issue may justify an exception. Copying a contributor's fix and calling it internal does not.
- The proposed process uses public notice, evidence collection and an independent operator's decision. AI assists the review; it cannot approve refunds. The proposed notice period is 72 hours, published before funding.
- Accepted awards cannot be cancelled because the contributor has not connected PayPal or a payout failed.
- Without an independent operator, funded refunds remain unavailable. App removal or missing repository access also blocks new refund authorization.

These rules prevent the normal recorded cancel-then-merge abuse path. They cannot force a maintainer to merge, prevent off-platform copying, or guarantee discovery of unseen work. Read [the cancellation decision and its limitations](docs/decisions/0001-open-participation-and-cancellation.md).

## Planned commands

| Command | Purpose |
| --- | --- |
| `/bounty create <amount>` | Create an unfunded USD bounty draft |
| `/bounty fund` | Get an authenticated funding link |
| `/bounty status` | View progress and request reconciliation |
| `/bounty approve` | Preview and confirm payment for a review case |
| `/bounty reject <reason>` | Reject a submission for award consideration; preserve its evidence |
| `/bounty cancel [reason]` | Cancel an unfunded draft, or request a reviewed exception for a funded bounty; funded requests require a reason |
| `/bounty link #<pr>` | Explicitly link a same-repository PR |
| `/bounty retry` | Retry verification of a PR's current revision |

Maintainer commands require current repository write/maintain/admin permission; `/bounty status` is available to participants with access. Financial actions require confirmation or the deterministic settlement policy. Labels never fund or refund money.

## Architecture

```mermaid
flowchart LR
    GH[GitHub issues, PRs and CI] -->|Signed webhooks| API[Express server]
    PP[PayPal sandbox] -->|Verified events| API
    API --> DB[(Postgres state and jobs)]
    DB --> W[Worker]
    W --> AI[DeepSeek / Nemotron verifier]
    AI --> P[Deterministic payment policy]
    P --> DB
    W -->|Orders, payouts, reviewed refunds| PP
    W -->|Comments and Check Runs| GH
    UI[Confirmation and connection pages] --> API
    VIEW[Optional read-only dashboard] --> API
```

| Concern | Planned choice |
| --- | --- |
| Development assistant | Codex, guided by `AGENTS.md` |
| Runtime | Node.js 22, TypeScript strict, pnpm workspaces |
| Backend and storage | Express 5, PostgreSQL 16, Drizzle, durable database jobs |
| GitHub integration | GitHub App, Octokit, webhooks, Check Runs and OAuth |
| Payments | PayPal sandbox Orders, capture, Payouts, refunds and webhooks |
| Runtime AI | NVIDIA API: DeepSeek primary, Nemotron fallback; structured verdicts validated with Zod |
| Web | Server-rendered confirmation pages; React/Vite + AG Grid for the optional dashboard |
| Validation | Vitest, integration tests, property tests, verifier evaluations and sandbox walkthroughs |
| Deployment target | Render; deployment configuration is not created yet |

Codex is the coding assistant, while NVIDIA-hosted DeepSeek/Nemotron are the selected runtime models. Neither receives unrestricted authority to move money. See [the provider decision](docs/decisions/0002-nvidia-runtime-models.md).

## Start here

```sh
git clone https://github.com/Me-cha/GitPay.git
cd GitPay
```

Start with [the phased MVP review plan](docs/phases/README.md) and [Phase 00](docs/phases/00.md). Read [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the architecture and [AGENTS.md](AGENTS.md) for repository instructions. Phase 0 provides the executable server workspace. Follow [local setup and provider probes](docs/setup.md); see [Phase 0 evidence](docs/evidence/00-summary.md) for actual checks and remaining gates.

The tracked [.env.example](.env.example) lists validated configuration. Copy it to `.env` and fill in credentials locally. Empty credentials and the model field are intentional; startup and preflight fail safely until populated. Do not paste secrets into issues, PRs or agent instructions.

External setup will require a GitHub App and demo repository, PayPal sandbox accounts with Payouts access, and a NVIDIA API key and model access. Cancellation testing also needs an independent reviewer identity. Exact setup requirements are recorded in section 3 of the plan; verify provider documentation during implementation.

## Repository guide

| Path | Purpose |
| --- | --- |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Canonical architecture, state model, phases and acceptance criteria |
| [PLAN.md](PLAN.md) | Link to the canonical plan |
| [AGENTS.md](AGENTS.md) | Codex instructions and current folder map |
| [Agent.md](Agent.md) | Pointer to `AGENTS.md` |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution and verification expectations |
| [docs/phases/](docs/phases/) | Phase status, task contracts and exit gates |
| [docs/setup.md](docs/setup.md) | Local installation, configuration and explicit provider probes |
| [docs/evidence/](docs/evidence/) | Recorded local verification and external blockers |
| [docs/phases/review-todo.md](docs/phases/review-todo.md) | Pre-build remediation checklist for the reviewed plan |
| [docs/decisions/](docs/decisions/) | Product and architecture decisions with reasoning |
| [packages/server/](packages/server/) | Executable health server, configuration, database and feasibility probes; product actions arrive later |
| [packages/web/](packages/web/) | Planned optional dashboard; documentation placeholder |
| [postman/](postman/) | Planned API/demo collection; documentation placeholder |

Folder changes must update the current map in `AGENTS.md`, affected README links and the plan's target layout in the same change. The PR template includes this requirement.

## Scope and contributing

The MVP targets USD code bounties and PayPal sandbox. Live money, third-party funding, partial awards, non-code work and other source hosts are outside the initial scope. This is not a production escrow service or a guaranteed dispute-resolution system.

See [CONTRIBUTING.md](CONTRIBUTING.md). Product behavior, credentials and integration success should be documented only when implemented and verified. The implementation plan records the hackathon target; deadlines and eligibility still need official verification.

## License

[MIT](LICENSE), as selected in the implementation plan.
