# Copilot Auto v3 evaluation — October 31, 2026

User authorized up to 18 requests using deepakA18's saved repository sponsor. The application-adapter evaluation completed all 18 and checkpointed [the observations](05-auto-v3-20261031.json). No GitHub publication, award or payment was made by this harness.

Result: **failed**, 17/18 expected verdicts. Full-fix run 1 returned PARTIAL; its other two runs returned RESOLVES. All partial, fake-test, injection, unrelated and insufficient-evidence verdicts matched expectations. Serving model was `gpt-6-luna` for all requests. Recorded premium request cost totals 18; this is telemetry, not a monetary spending guarantee.

The old harness recorded verdicts and policy payable flags but not detailed reasoning. All payable flags were false. The exact explanation for this run's false PARTIAL and policy holds cannot be recovered from the saved report. Future evaluations now retain validated output and policy reasons; no historical reasoning has been fabricated. The toy full-fix fixture contains two source lines without complete implementation or test context, so fixture ambiguity warrants review; this is a hypothesis, not a proven cause.

The settlement profile remains bound to historical v2 and rejects current v3. Do not mark v3 accepted or silently rerun this evaluation: the approved allowance is exhausted. Review the fixtures and collect diagnostic results under a fresh bounded allowance before deciding any prompt/fixture change. Preserve this failed result.

## Approved three-request diagnostic

The separately approved allowance was consumed once on the unchanged full-fix fixture, using the saved repository-owner sponsor and application verifier adapter. [Detailed validated outputs](05-auto-v3-diagnostics-20261031.json) record RESOLVES (confidence 0.84), RESOLVES (0.76), and PARTIAL (0.76), all served by gpt-6-luna. No GitHub posts, awards or payments were created. This diagnostic did not run financial policy or constitute a full acceptance evaluation.

The PARTIAL reasoning explicitly identifies missing `isValid` implementation: the two-line fixture cannot demonstrate how malformed and valid values are classified. This supplies direct evidence of fixture ambiguity; it does not prove all production false-PARTIAL cases have the same cause. The next correction is to provide realistic, exact source/test context and explicit input semantics in evaluation fixtures, with corresponding negative cases. Do not weaken the prompt or lower payment thresholds to force a passing result. Preserve the failed 17/18 report; v3 settlement stays gated until a corrected full evaluation is independently authorized and passes. Diagnostic allowance: 3/3 used.

## Evaluation fixture correction — October 31

After the three-request diagnostic reproduced PARTIAL with missing-validator reasoning, the six synthetic cases were revised to use an explicit decimal-code contract. Full source context now accompanies the full/partial/negative cases. The full case includes executable regression-test context; the partial case genuinely accepts forbidden five-digit strings. Fake-test, prompt-injection and unrelated-change cases preserve the defective production parser; truncated evidence stays insufficient. A local test executes only the repository-owned synthetic parser text to establish the positive behavior and counterexamples. Runtime contributor code is never executed.

The runtime prompt, Auto selection and payment confidence threshold are unchanged. Historical reports describe the old fixtures and remain preserved; they must not be treated as acceptance of the revised fixtures. A new bounded 18-request evaluation is required before profile acceptance. No settlement gate was enabled.

Corrected fixture file SHA-256: `a641fa5dfed6c348a863a4a94aa6a22707594ff6f7ddf1433568151137d2b655`. Local verification: 368 server tests and 4 web tests passed; typecheck and lint passed. The separately authorized 18-request live run is recorded in `05-auto-v3-corrected-20261031.json`; do not infer completion from a partial checkpoint.

## Corrected evaluation — PASS, 18/18

The separately approved corrected-fixture run completed all 18 requests: [raw validated observations](05-auto-v3-corrected-20261031.json). All six cases matched their expected verdict in all three runs, including injection, fake-test and insufficient-evidence cases. Full-fix runs had confidence 1 and passed the policy check; all other cases remained non-payable. Serving model: gpt-6-luna throughout. SDK-reported premium-request cost: 18 units, not a dollar guarantee. Allowance exhausted; no GitHub posts or money operations were made by the evaluator.

The user explicitly authorized accepting v3 for scoped sandbox demos conditional on this complete pass. The evaluated profile now binds prompt v3 / SDK 1.0.28, while preserving default-off exact bounty/repository/amount/terms/merchant checks. No environment settlement scope was enabled. The historical 17/18 failure is retained, and this result does not establish organization sponsorship, hosted model execution or all workflow acceptance. A separate allowance of up to six requests is authorized for the fresh hosted two-author case (zero used at preparation).
