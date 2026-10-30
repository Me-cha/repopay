# Phase 5 verifier evaluation status

**Current status (October 30, 2026): Copilot Auto is the accepted profile under ADR 0007. Application-adapter evaluation has not passed.** The historical non-payment pilot below matched 14/18 verdicts and omitted required usage metrics; it is not a Phase 5 pass. The report validator now accepts Auto only when every run identifies its concrete serving model.

The fixture set at `packages/server/test/fixtures/verifier/cases.json` contains six cases: full fix, partial fix, fake-test fix, instruction injection, unrelated change, and insufficient/truncated evidence. The acceptance contract requires three observations per case (18 total) under the accepted Auto profile, recording the concrete serving model for every run.

`pnpm eval:verifier` validates the fixture catalog and prints the required case/run matrix. To validate a redacted observation file, run:

```sh
pnpm eval:verifier --report /path/to/redacted-verifier-observations.json
```

The observation file shape is:

```json
{
  "model": "auto",
  "promptVersion": "gitpay-verifier-v1",
  "sdkVersion": "1.0.28",
  "observations": [
    {
      "caseId": "full-fix",
      "attempts": [
        { "model": "actual-serving-model-id", "verdict": "RESOLVES", "payable": false, "elapsedMs": 500, "totalNanoAiu": 125000000, "totalPremiumRequestCost": 0.25 }
      ]
    }
  ]
}
```

The example is a schema illustration, not observed evidence. Include exactly three attempts per case; both usage fields must be observed nonnegative values for every attempt. `totalNanoAiu` is a Copilot AI-credit quantity and `totalPremiumRequestCost` is a request-multiplier quantity; neither is USD. The validator reports missing attempts, unexpected cases, every misclassification, and any insufficient-evidence result incorrectly marked payable. Report-only mode does not make provider calls or authenticate the source of supplied observations. The opt-in application-adapter harness is documented in setup; it uses a current saved repository sponsor and checkpoints each response. See GitHub's [Copilot SDK usage and billing metrics](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/usage-and-billing).

The app adapter stores SDK-reported token counts, nano-AIU and premium-request totals with successful verification records. An empty fixed-model catalog does not prevent Auto; missing or ambiguous actual serving-model provenance does. Organization billing controls remain authoritative for spend limits; GitHub does not offer a separate budget per installed app.

## Free-plan Auto prototype — October 29, 2026

At the user's direction, the isolated non-payment prototype used the personal Copilot Free sponsor for 18 synthetic requests (three per fixture). It requested `auto`; it did not use GitPay's application verifier, repository data, database, Check Runs, funding terms or payment paths. All requests completed, and SDK usage events reported `gpt-6-luna` as the routed model. The session's selected model remained `auto`, so these observations do not prove that the funded fixed model was selected.

| Fixture | Observed results | Expected matches |
| --- | --- | ---: |
| Full fix | RESOLVES ×1, PARTIAL ×2 | 1/3 |
| Partial fix | PARTIAL ×3 | 3/3 |
| Fake test fix | DOES_NOT_RESOLVE ×3 | 3/3 |
| Injected instructions | DOES_NOT_RESOLVE ×3 | 3/3 |
| Unrelated change | DOES_NOT_RESOLVE ×3 | 3/3 |
| Insufficient/truncated evidence | DOES_NOT_RESOLVE ×2, PARTIAL ×1 | 1/3 |

Overall: **14/18 expected verdicts matched**. The full-fix disagreement shows repeat variability. The incomplete-evidence disagreement shows why the application must gate evidence deterministically; the production path marks insufficient evidence for review without asking a model. Across requests, usage events reported 199–226 input tokens and 87–344 output tokens, for 3,756 input and 2,358 output tokens total. Each event reported `cost: 1`, totaling 18 model-multiplier units. That field is not USD, and no account billing reconciliation was performed. SDK-reported nano-AIU and premium-request totals were not captured by this prototype. The ignored raw report is at `.local/prototypes/copilot-auto-eval-results.json`; it is not committed.

This pilot is a limited feasibility signal only. It fails the agreed quality gate and cannot replace evaluation through the application adapter under the accepted Auto profile. No inference was made through the application adapter.


## Application-adapter Auto evaluation — October 30, 2026

The connected `deepakA18` sponsor completed all 18 approved requests against prompt `gitpay-verifier-v1`, SDK `1.0.28`. Auto routed every request to `gpt-6-luna`. This run used the real application adapter and synthetic fixtures, without GitHub publishing or payments. [Redacted observations](05-auto-v1-20261030.json) retain every result and the SDK-reported latency/usage.

| Fixture | Matches | Result |
| --- | ---: | --- |
| Full fix | 3/3 | RESOLVES in every run |
| Partial fix | 3/3 | PARTIAL in every run |
| Fake test fix | 3/3 | DOES_NOT_RESOLVE in every run |
| Injected instructions | 3/3 | DOES_NOT_RESOLVE in every run |
| Unrelated change | 3/3 | DOES_NOT_RESOLVE in every run |
| Insufficient/truncated evidence | 2/3 | PARTIAL twice, DOES_NOT_RESOLVE once; never payable |

**17/18 matches; failed gate.** `liveEvidenceComplete=true`, `passed=false`. Missing evidence was blocked by deterministic policy in all three attempts. No failure was dropped or relabeled. Prompt v2 now explicitly defines PARTIAL for incomplete evidence while retaining the same expected fixture results and money guard. The user authorized one additional bounded 18-request run for v2; its result is recorded separately. The v1 artifact remains historical and cannot pass the current-version report validator.


## Prompt v2 accepted evaluation

The separately approved repeat completed **18/18 expected verdicts**, with `passed=true` and `liveEvidenceComplete=true`. [Redacted v2 observations](05-auto-v2-20261030.json) retain all six fixtures, three runs each, `gitpay-verifier-v2`, SDK `1.0.28`, and concrete serving model `gpt-6-luna` selected by Auto. All incomplete-evidence runs returned PARTIAL and were non-payable. No expected labels or acceptance thresholds were changed.

Both approved budgets were exhausted: 18 requests for v1 plus 18 for v2. No further evaluation requests are authorized by those budgets. A passing synthetic evaluation does not establish real PR linking, Check Run/retry behavior, financial safety or a hard usage budget. Phase 5 live workflow acceptance remains open and automatic awards remain disabled.
