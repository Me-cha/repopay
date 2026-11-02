# Repopay sandbox demo and final-session guide

Status: outline prepared; final recording and live acceptance pending. All amounts shown are PayPal **sandbox** USD. [Acceptance matrix](evidence/12-acceptance.md) and [live checklist](phases/live-walkthroughs.md) control what can be claimed.

## Prepare fresh cases

Use only `deepakA18/repopay-demo-http`, the isolated detached demo repository. Do not change PayPal upstream or reuse the completed $50 award as a new case. Existing historical evidence is [the Phase 5–6 walkthrough](evidence/05-demo-walkthrough.md).

```sh
# No credentials, network calls, issues or application writes:
pnpm demo:seed
# Only when the final live session is authorized; requires gh auth login:
pnpm demo:seed --execute --repo deepakA18/repopay-demo-http --confirm-repo deepakA18/repopay-demo-http
```

Execution checks the exact repository and that it is detached, then creates two ordinary preparation issues with fresh IDs. Reruns create new issues, never reuse funded records. Refine each issue with a concrete reproducible defect, acceptance criteria and regression tests before creating a bounty. The seeder never creates bounty labels, commands, PRs, checkouts, merges or payments. Inspect the repository after an uncertain error before rerunning; it never retries a potentially successful write automatically. The operator's GitHub CLI session is only for issue preparation, never runtime Copilot review sponsorship.

## Three-minute recording outline

| Time | Show | Narration / evidence |
| --- | --- | --- |
| 0:00–0:20 | Isolated GitHub issue and draft command | “Repopay keeps work in GitHub. This is a sandbox demonstration.” Creating a draft does not fund it. |
| 0:20–0:45 | Owner sponsorship, frozen criteria and confirmed checkout | Show captured status, not merely the PayPal return page. Repository-owner-sponsored Copilot Auto supplies runtime review; Codex helped build the application. |
| 0:45–1:15 | Two distinct eligible contributors' linked PRs and exact-revision Check Runs | Explain meaningful solution evidence, CI and review reasoning. Opening first does not reserve a reward. **Blocked until another eligible contributor exists.** |
| 1:15–1:45 | Qualifying merge, committed award and recipient Activity | Stable qualifying merge order selects the award; immutable transfer identity prevents duplicate delivery. Show actual sandbox receipt. Historical $50 receipt must be labelled historical if reused. |
| 1:45–2:15 | Delayed claim or authenticated manual review | Show AWAITING_CLAIM then connection/resumption, or a reasoned full-amount approval of a partial case. These recordings remain pending; do not substitute mocked browser footage without labelling it. |
| 2:15–2:45 | Attempted cancellation with valid submitted work | Show the claim blocks a refund, preserved evidence and actor's next step. No promise to prevent copying outside Repopay. |
| 2:45–3:00 | Read-only dashboard and limits | Point to the genuine-refund evidence and remaining acceptance gates; no escrow or production-readiness claim. |

The genuine-refund recording is **not yet available**. Record it separately after confirmed public notice and the full real 72 hours, with an independent reviewer and payer receipt. Never imply injected test time or edited video establishes elapsed notice. Add its link to the acceptance matrix once recorded.

## Before recording or submission

- Resolve eligible contributor/operator and attribution blockers; agree isolated scopes, sandbox amounts and bounded Copilot request allowance. See the ordered [final session](phases/live-walkthroughs.md#final-session-order).
- Complete provider/hosted gates before claiming the full MVP. Organization sponsorship remains blocked; a personal-repository demo does not prove organization support.
- Crop or redact tokens, webhook payloads, payment addresses, cookies and account settings. Show safe status/IDs only; review the final video frame by frame before sharing.
- Verify the actual event's current **official rules**, eligibility, deadline/timezone, required sponsor technology, licensing and recording limits before submission. This turn did not verify an event or submit anything; retain the official rules URL and verification date here when that happens.
- Obtain final user acceptance of the evidence and the proposed publication separately. An outline or local test pass is not a recorded demo or permission to publish.
