# Copilot as a GitPay verifier — feasibility research

## October 29, 2026 update — fixed model and customer-owned sponsorship

This update supersedes the earlier “GPT-6 Luna is unavailable on Free” model-access snapshot only when the sponsor changes plans or the live model catalog changes. It does not claim the current Me-cha Free account can use a fixed model: GitHub currently documents Free and Student as Auto-only. The model tables and billing terms are subject to change, so GitPay must check the sponsor's live catalog and current usage policy before enabling a funded verifier.

### Recommendation

Customer-owned sponsorship is technically supported by GitHub's Copilot SDK and is the right default for a multi-customer GitPay service. Use the **repository owner’s GitHub App user authorization** for individual owners, and offer **organization installation sponsorship** for organizations that want org-level billing and control. GitPay’s own account must never silently sponsor customer repositories. The PR author’s credentials are not used.

Use the fixed **`gpt-6-luna`** model as the first candidate, subject to model-list and evaluation gates. GitHub lists it as a generally available lightweight model. The current published default-context rates are $0.10 per 1M input tokens and $0.50 per 1M output tokens, with separate cache-write/cache-read prices and higher long-context rates. GitHub AI Credits allowances vary by plan; overage can be billed at the published rates. Treat these as a snapshot, read model pricing at runtime where supported, and disclose that the customer’s GitHub billing settings control actual charges. [Supported models and plan access](https://docs.github.com/en/copilot/reference/ai-models/supported-models), [model pricing](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing)

### What the supported billing routes mean

| Sponsor | How GitPay authenticates | Who GitHub attributes usage to | Suitable customer |
| --- | --- | --- | --- |
| Individual repository owner | Owner authorizes GitPay’s GitHub App; GitPay passes that owner’s `ghu_` user token to the Copilot SDK, with CLI fallback disabled | That GitHub user’s Copilot subscription/AI-credit account | Public or private repository owned by a person; owner explicitly consents to sponsor reviews |
| Organization | Organization installs/approves GitPay’s GitHub App with the Copilot Requests organization permission; GitPay mints a short-lived installation token and passes it explicitly | The organization that owns the GitHub App installation | Repositories owned by an organization that has enabled Copilot Requests and selected org billing |

GitHub’s SDK setup guide explicitly describes user OAuth for SaaS/multi-user apps and says the authorized user’s Copilot subscription pays. Supported user tokens include GitHub App user tokens (`ghu_`) and OAuth tokens (`gho_`); GitPay should prefer its existing GitHub App user-token path. The SDK does not refresh or store tokens for the host application. Persist a separate, encrypted sponsor grant with separate consent and lifecycle from interactive login. [GitHub OAuth setup](https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/github-oauth), [SDK authentication](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate)

For organization automation, GitHub currently documents a GitHub App with the **Copilot Requests organization permission set to Read-only**, installed in the billing organization, and an installation token requested with `organization_copilot_requests: read`. The token expires after one hour and must be reminted; GitHub says the organization owning the installation is billed. The org must also enable GitHub App installation requests and allow the selected model. This capability can be unavailable for some organizations, so installation and model access need an explicit live capability check. [Server-to-server authentication](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/server-to-server-tokens), [organization app access](https://docs.github.com/en/copilot/how-tos/administer-copilot/manage-for-organization/manage-app-copilot-access)

An eligible user's plan matters. GitHub’s current supported-model table says Copilot Free and Student are Auto-only; a customer selecting the fixed `gpt-6-luna` candidate needs a plan where that model is available, and organization policy must permit it. Do not require every repo contributor to have Copilot. Only the repository sponsor needs the applicable entitlement. [Supported models by plan](https://docs.github.com/en/copilot/reference/ai-models/supported-models)

### Customer onboarding and runtime flow

1. The owner installs GitPay’s existing GitHub App on the repository. This grants GitHub repository events/API access; installation alone does **not** grant Copilot usage.
2. An owner/admin opens GitPay’s “Copilot sponsor” setup for that repository and chooses **personal sponsor** or **organization sponsor**. Explain that Copilot usage is charged by GitHub to the selected account/org and that included-credit/overage rules are controlled there.
3. For a personal sponsor, the repository owner reauthorizes GitPay’s GitHub App in an explicit sponsor-consent flow. GitPay verifies the authenticated GitHub ID against the repository owner, checks repository access, checks the fixed model is present, and stores the sponsor grant encrypted in a distinct table. A normal sign-in or a collaborator’s login cannot silently become the payer.
4. For an organization sponsor, an organization owner approves the GitHub App’s Copilot Requests organization permission and turns on the organization Copilot app policy. GitPay verifies that the selected organization owns the installation and the repository. At inference time, GitPay mints a short-lived installation token for that organization.
5. Before a bounty is funded, GitPay resolves and snapshots `sponsor_id`, sponsor type, stable repository ID, fixed model ID, verifier/prompt profile, and an agreed usage policy into the immutable funded terms. A missing model, expired/revoked sponsor, disallowed model, or unavailable quota blocks new funding. It does not mark a PR invalid.
6. For each exact PR revision, the worker selects credentials only by the funded repository/sponsor binding, passes the token explicitly to an isolated SDK client (`useLoggedInUser: false`), requests the one fixed model, and records model, revision, sponsor, token counts, available credit/usage metrics, attempt and outcome. No fallthrough to a global developer token, PR-author token, or Auto is allowed.
7. Enforce app-side admission limits: maximum review attempts per revision, maximum input/output size, per-repository monthly attempt budget, and no blind automatic retries after ambiguous provider outcomes. Display an estimate and usage observed by the SDK. These controls reduce exposure but are not a hard billing cap: usage metrics are partly experimental, model prices and entitlements may change, and GitHub's account/org billing settings remain authoritative. GitHub notes that account AI-usage pages generally cannot attribute credits to individual prompts/sessions. [SDK usage and billing metrics](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/usage-and-billing), [monitoring AI Credits](https://docs.github.com/en/copilot/how-tos/manage-and-track-spending/monitor-ai-usage)

If the sponsor revokes access or runs out of quota after funding, GitPay records verifier-unavailable and keeps the decision pending for retry/review under existing money policy. It must never convert infrastructure failure into `DOES_NOT_RESOLVE`, pay a different account without consent, or change the funded model/identity on retry.

### Fit with current GitPay implementation

The current `github/oauth.ts` uses encrypted browser sessions for login and also owns a separate personal-owner sponsor grant with independent refresh/revocation. The `http/sponsor.ts` flow verifies personal repository ownership and configured fixed-model access before saving. Funding freezes sponsor identity in v3 terms. Phase 5 has a local verifier that selects this grant, persists SDK usage metrics, and enforces per-repository daily/per-SHA attempt caps, but no live fixed-model inference, sponsor callback walkthrough, production-database migration or funded review has been exercised. The standalone `models/copilot.ts` probe still accepts an environment token only for explicit probe operations. Organization installation billing and sponsor-revocation handling in review jobs are unimplemented; local attempt caps and usage metrics are not a monetary budget or billing ledger.

Implementation should therefore be sequenced as: (a) confirm the fixed model under a sponsor that actually has access; (b) implement the separately consented sponsor-grant/repository-binding schema and onboarding; (c) implement the org installation-token path and policy/capability errors; (d) bind sponsor/model/profile to new funded terms; (e) add spend admission limits and usage ledger; (f) test revoke/expiry/owner mismatch, cross-tenant isolation, exhausted quota, fixed-model unavailability, duplicate webhook/job delivery, ambiguous inference and no-retry behavior; (g) run semantic evaluation before using verdicts for settlement. Do not migrate existing Nemotron terms.

### Product terms and a launch gate

GitHub’s current SDK documentation explicitly describes the OAuth route as suitable for SaaS applications and explains whose subscription is billed. That establishes a documented technical integration path, not a complete legal opinion that every third-party commercial workflow or resale arrangement is authorized. Individual Copilot use is governed by Section J (AI Features) of GitHub’s Terms of Service; Business/Enterprise subscriptions have their own applicable agreements, and some purchases through Microsoft follow Microsoft terms. Because GitPay would send issue text and code diffs to Copilot under the sponsor’s authorization, review the applicable terms, GitHub’s data-use settings, privacy disclosures, and customer agreements before a public commercial launch. If those terms leave the hosted verifier use unclear, obtain written confirmation from GitHub or legal counsel; do not infer permission from SDK availability alone. [GitHub Copilot applicable terms](https://github.com/github/docs/blob/main/content/site-policy/github-terms/github-terms-for-additional-products-and-features.md), [GitHub Terms of Service, Section J](https://github.com/github/site-policy/blob/main/Policies/github-terms/github-terms-of-service.md), [SDK OAuth SaaS guide](https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/github-oauth)

For the SaaS to be useful to small individual repo owners, the personal-owner OAuth path is important; requiring every customer to have an organization would exclude individual repositories. At the same time, personal plans’ allowances and possible overages make explicit consent, a visible GitPay attempt cap, and a sponsor-side usage guide necessary. Organizations get a stronger central billing/policy path, but it requires administrator enablement and may not be available to every tenant.

**Research verdict:** fixed-model Copilot with per-repository customer sponsorship is technically plausible. GitPay has a local implementation of the personal owner grant, new funding-term binding, advisory verifier, attempt caps and SDK usage telemetry, but it is unverified and organization billing remains absent. The current Free sponsor lacks explicit fixed-model access, meaningful verifier quality is not established, and commercial terms/data-processing approval remain launch gates. Owner-funded OAuth is the first implemented path; organization billing remains a required scale path. Keep verifier errors pending and never turn infrastructure failure into a negative PR verdict.

## Older research snapshot (October 28, 2026)

Researched October 28, 2026, with implementation status updated October 29. The user subsequently accepted Copilot SDK and repository-owner/organization sponsorship in [ADR 0005](decisions/0005-copilot-verifier.md). The [provider migration](evidence/copilot-migration.md) replaces Nemotron locally. A personal-owner OAuth grant, v3 funding-term binding, bounded PR evidence collector, advisory verifier and Check Run pipeline are implemented locally but remain unverified against live fixed-model access. SDK usage telemetry and request caps are now implemented; organization billing, sponsor-revocation handling and semantic evaluation remain open in [Phase 05](phases/05.md).

**Conclusion:** Yes, GitPay can integrate with Copilot. For judging whether an exact PR revision satisfies a funded issue, the Copilot SDK is the better candidate for a controlled experiment. Native Copilot PR review can supply additional feedback, but its review result is not a complete bounty-eligibility decision. Neither route eliminates trusted CI, evidence collection or deterministic payment policy.

## Three different products

| Route | What GitPay can ask it to do | Fit for GitPay |
| --- | --- | --- |
| Native Copilot code review | Request GitHub's built-in reviewer on a PR; receive GitHub reviews/comments | Useful secondary review, less control over the verification contract |
| Copilot SDK | Run a custom agent session with GitPay's evidence, instructions, model selection and structured result | Selected provider for the semantic verifier; live feasibility remains unverified |
| Copilot cloud/coding agent | Start an agent task or assign an issue to an agent that works on repository code | Better suited to producing changes; unnecessary authority and workflow for a narrow verifier |

GitHub explicitly documents requesting `copilot-pull-request-reviewer[bot]` through REST. Reviews can use repository context, instructions, skills and MCP. Current documentation also describes optional actual approving reviews in public preview, disabled by default: the older claim that Copilot can only comment is outdated. Crucially, review instructions and skills are read from the PR's **head branch**. A contributor could modify that context. This makes native reviews unsuitable as the sole authority for a paid bounty. [Native review guide](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review)

Native review uses a GitHub-selected mix of models rather than a caller-selected model. It can miss problems. Availability, organization policy and billing still apply; native review consumes AI credits and agentic review can use Actions minutes. GitHub says reviews requested by bots are billed to the organization. Behavior and entitlement for our personal-account App installation must be tested rather than inferred from this organization rule. [Code review concepts and billing](https://docs.github.com/en/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/code-review)

The cloud-agent API is a separate public-preview interface, supports user-to-server tokens, and explicitly excludes GitHub App installation tokens. It can create agent tasks and optionally PRs; that is not the same API as SDK inference or native review. [Cloud-agent API guide](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-via-the-api)

## Authentication: what the same GitPay App can and cannot do

An App ID, private key and Issues permission do not by themselves establish Copilot entitlement. There is no need to create a second bot solely to explore the SDK, but the chosen authorization and billing path must be explicit.

**Personal testing:** the SDK supports GitHub App user access tokens (`ghu_`) and OAuth user tokens (`gho_`). GitPay can therefore test with an explicitly consenting user's eligible Copilot account. Its client secret is used for OAuth exchange, not as the Copilot inference credential. Usage follows that user's Copilot authorization/subscription, and our application owns refresh and expiry. Existing GitPay login is a possible starting point for an interactive probe, not proof the current token has the required entitlement. [GitHub OAuth setup](https://github.com/github/copilot-sdk/blob/v1.0.28/docs/setup/github-oauth.md), [authentication](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate)

**Background GitPay service:** current GitPay OAuth credentials are tied to browser sessions and are removed on logout/expiry. Future PR validation may happen days later. Production needs either a separately consented, durable Copilot authorization with an explicit billing owner, or the organization route below. Do not bill whichever contributor happens to sign in, or silently borrow the developer's CLI login. This is a GitPay architecture requirement, not something the SDK supplies automatically.

**Organization service-to-service:** current documentation specifies the GitHub App's **Copilot Requests organization permission, Read-only**, an enabled organization installation, and a short-lived token minted with:

```json
{"permissions":{"organization_copilot_requests":"read"}}
```

Pass that token through the SDK's explicit `gitHubToken` option with `useLoggedInUser: false`. An existing external runtime uses its `COPILOT_GITHUB_TOKEN` environment instead. Tokens expire after an hour; refresh/restart handling and organization enablement are required. Usage is attributed to that organization. [Pinned server-to-server guide](https://github.com/github/copilot-sdk/blob/v1.0.28/docs/auth/server-to-server-tokens.md)

Older cached documentation described `copilot_requests: write`, environment-only authentication and All repositories access. Those instructions conflict with the current pinned release guide above; do not follow the cached recipe. Verify the permission is actually available and a token works in the intended organization before committing to this route.

**Actions alternative:** organization-owned workflows can use `GITHUB_TOKEN` with `copilot-requests: write`, subject to the organization's Copilot CLI billing policy. This differs from the organization permission's API spelling above. GitHub warns that direct CLI execution can expose the workflow environment, especially for fork PRs. A verification workflow must run trusted orchestration and must not execute untrusted PR scripts with privileged tokens. [Actions guide](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli-in-actions)

**Native review permission:** the REST review-request endpoint accepts App installation or App user tokens and requires Pull requests write permission. The Copilot-specific entitlement is still an additional gate. GitPay currently has Issues write and Metadata read; requesting native PR reviews would require a permission upgrade and installation approval. [Review-request API](https://docs.github.com/en/rest/pulls/review-requests#request-reviewers-for-a-pull-request)

The request shape, if that optional route is selected, is:

```http
POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers
Content-Type: application/json

{"reviewers":["copilot-pull-request-reviewer[bot]"]}
```

This call requests a review and can consume paid usage; it was not executed during this research.

## SDK capabilities and limits checked

The SDK is generally available. Release `v1.0.28` was published October 28, 2026 and resolves to commit `fa108e71ee3025663e0dac20f2a071055d3a6b14`. Node/TypeScript is supported and the runtime is bundled for the Node SDK. This introduces an agent runtime/process lifecycle, not just an HTTP model adapter. [Release](https://github.com/github/copilot-sdk/releases/tag/v1.0.28), [SDK overview](https://github.com/github/copilot-sdk/tree/v1.0.28)

Its Node SDK has **preview** structured output: `sendAndWait(options, zodSchema, timeout)` sends a schema and parses/validates the final result. A supporting runtime and model are required; remote sessions do not support this format. A wait timeout does not stop agent work, so GitPay must explicitly abort/stop and record an error. A schema-valid answer is still not proof the fix is correct. [Pinned Node API](https://github.com/github/copilot-sdk/blob/v1.0.28/nodejs/README.md#structured-output-preview)

Shared-server deployments require `mode: "empty"` and explicit tools/authentication. This disables ambient CLI tools and defaults; it does not replace application authorization or tenant isolation. Start with no tools and pass a bounded evidence package. If more context is needed, allow only GitPay-owned read tools constrained to the selected repository and exact SHA. Do not load the contributor's instructions, plugins or skills as verifier policy, and do not give the verifier shell, payment or repository-write tools. [Multi-tenancy guide](https://github.com/github/copilot-sdk/blob/v1.0.28/docs/setup/multi-tenancy.md)

BYOK supports OpenAI-compatible endpoints. Consequently, using the SDK with NVIDIA is plausible, but NVIDIA/Nemotron compatibility with its tool and structured-output paths has **not** been established. BYOK would use our provider credentials and model; it is not access to GitHub-hosted Copilot models for free. [BYOK documentation](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/byok)

## Accepted GitPay direction

This is the recommended application design, derived from GitPay's existing Phase 05 contract:

```text
PR opened or updated
  → GitPay resolves linked funded issue and exact PR/base/head identity
  → GitPay collects frozen criteria, bounded diff and trusted CI evidence
  → isolated Copilot SDK session assesses that evidence
  → Zod validates result and GitPay rejects stale/incomplete evidence
  → GitPay publishes its own verification Check Run
  → later settlement policy independently checks merge/eligibility/CI/award rules
```

The semantic question is “does this revision satisfy these saved requirements?” CI answers a different question: “did these trusted automated checks pass for the relevant code?” Copilot supplements CI; it does not replace tests. A `COMMENTED` review, no comments, or even an `APPROVED` review is not itself the `RESOLVES` verdict bound to GitPay's funded terms and evidence version.

The SDK can reduce agent orchestration work. It does not automatically fetch arbitrary private repositories, choose the correct issue, preserve the funded criteria, prove revision freshness, or outperform Nemotron. Those remain collection, policy and evaluation responsibilities.

## Execution after the accepted decision

The user selected repository-owner/organization sponsorship and authorized the existing-provider migration. [ADR 0005](decisions/0005-copilot-verifier.md), the [migration plan](phases/copilot-migration.md) and [evidence](evidence/copilot-migration.md) track that work. The adapter is replaced locally; the remaining rollout is:

1. Prove access with an explicitly consenting sponsor, list accessible models and select one fixed ID. Run the synthetic structured-output probe. Separately verify organization installation authentication if that route is used.
2. Finish live verification of the local durable personal-owner grant and repository binding, including callback, token refresh/revocation and fixed-model access. Implement organization billing and sponsor-revocation handling; validate the existing usage telemetry and request limits with a real fixed-model sponsor.
3. Evaluate full/partial/unrelated fixes, removed tests, prompt injection, insufficient evidence, contributor-modified instructions, stale SHAs and unavailable CI. Repeat cases and retain failures, actual model/profile, latency and usage. Historical Nemotron success does not establish Copilot quality; an optional comparison is research, not a fallback.
4. Prove a GitHub walkthrough without money: exact-SHA evidence and GitPay Check Run, a new commit invalidating the earlier result, provider outage and sponsor revocation. Only passing evaluations may enable the later settlement policy.

For a third-party repository owner, installing GitPay would still grant repository access; it would **not** automatically grant Copilot usage. Onboarding would additionally connect the consenting Copilot user or approved organization billing path. Authentication failure or budget exhaustion would leave verification unavailable/pending, never silently switch to another customer's credentials.

## What remains unproven

No live Copilot authentication, structured-output generation, native review invocation, private/fork repository case, usage charge or NVIDIA-through-SDK request was tested. We have documented API feasibility, not a passing verifier. The next external gate is an explicitly sponsored live capability probe. The subsequent local migration does not establish a passing full verifier or automatic payout authority.
