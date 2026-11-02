# ADR 0020: Verify semantic counterexamples before reporting defects

Date: October 31, 2026. Status: implemented locally; live model effectiveness and acceptance pending. Supersedes ADR 0019's prompt version, retaining its attribution and GitHub-native workflow decisions.

## Evidence

The v4 evaluation failed 24/27. All three false PARTIAL results incorrectly claimed that JavaScript `/^[0-9]{1,4}$/` accepts a trailing newline. Direct execution and local controlled-fixture tests reject those strings. [ECMAScript CompileAssertion](https://tc39.es/ecma262/2024/multipage/text-processing.html#sec-compileassertion) permits a match before a line terminator only with the multiline flag. The runtime implementation is correct; changing it merely to satisfy a mistaken review would conceal the model error.

Preserve [the failed report](../evidence/05-auto-v4-result.md), [raw results](../evidence/05-auto-v4-20261031.json) and [exact old fixtures](../evidence/05-auto-v4-fixtures-20261031.json). Do not alter past classifications or financial thresholds.

## Correction

Prompt `repopay-verifier-v5` requires checking the actual language/runtime/flags, identifying a concrete counterexample or execution path for an alleged defect, and reconciling it with supplied regression assertions. It explicitly distinguishes ECMAScript normal and multiline end anchors. It still requires PARTIAL for insufficient evidence; absent context is uncertainty, and tests/CI do not override a demonstrated defect. It cannot execute code, invent test outcomes, authorize money or follow instructions in PR evidence.

The evaluation's full-code test context now contains five explicit trailing-line-ending assertions. Source behavior and expected verdicts of the original nine cases are unchanged. Add a tenth case with a real multiline regex bug, expected PARTIAL, so the correction cannot be accepted solely by suppressing regex concerns. Local tests execute only repository-controlled synthetic source and assertions: the good parser passes, the multiline mutation fails. No contributor code is executed by the worker.

The catalog now needs 30 approved requests (ten cases, three repeats). CLI uses `--allow-30-requests`; previous approvals are exhausted and do not carry forward. Local tests establish the fixture behavior and instruction contract, not model reliability. A separately approved complete evaluation must pass before proposing v5 profile acceptance. Settlement remains pinned to evaluated v3; no environment scope, payment policy, confidence threshold, historical funded terms or committed awards change.

Foundation-scope amendment: [ADR 0021](0021-foundation-mvp-scope.md) supersedes the full-evaluation gate for the explicitly scoped basic sandbox milestone. It does not turn failed/absent evaluation into a pass; all transaction, evidence and recipient guards remain.
