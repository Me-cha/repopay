# Phase 5 verifier evaluation status

**Status: a non-payment Auto prototype was evaluated; accepted fixed-model verifier evaluation has not been run.** The Auto observations below are not a Phase 5 pass and do not authorize funded use.

The fixture set at `packages/server/test/fixtures/verifier/cases.json` contains six cases: full fix, partial fix, fake-test fix, instruction injection, unrelated change, and insufficient/truncated evidence. The acceptance contract requires three observations per case (18 total) under one explicitly approved fixed Copilot model/profile.

`pnpm eval:verifier` validates the fixture catalog and prints the required case/run matrix. To validate a redacted observation file, run:

```sh
pnpm eval:verifier --report /path/to/redacted-verifier-observations.json
```

The observation file shape is:

```json
{
  "model": "fixed-model-id",
  "promptVersion": "gitpay-verifier-v1",
  "sdkVersion": "1.0.28",
  "observations": [
    {
      "caseId": "full-fix",
      "attempts": [
        { "verdict": "RESOLVES", "payable": false, "elapsedMs": 500, "totalNanoAiu": 125000000, "totalPremiumRequestCost": 0.25 }
      ]
    }
  ]
}
```

The example is a schema illustration, not observed evidence. Include exactly three attempts per case; both usage fields must be observed nonnegative values for every attempt. `totalNanoAiu` is a Copilot AI-credit quantity and `totalPremiumRequestCost` is a request-multiplier quantity; neither is USD. The validator reports missing attempts, unexpected cases, every misclassification, and any insufficient-evidence result incorrectly marked payable. It does not make provider calls or authenticate the source of supplied observations. See GitHub's [Copilot SDK usage and billing metrics](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/usage-and-billing).

The app adapter stores SDK-reported token counts, nano-AIU and premium-request totals with successful verification records. The current local sponsor catalog probe returned no accessible fixed models, and `.env` has no fixed model configured. Organization billing controls remain authoritative for spend limits; GitHub does not offer a separate budget per installed app.

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

This pilot is a limited feasibility signal only. It fails the agreed quality gate and cannot replace evaluation under a fixed, explicitly accessible model. No inference was made through the application adapter.
