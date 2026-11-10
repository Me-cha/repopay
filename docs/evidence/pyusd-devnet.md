# Direct PYUSD devnet implementation evidence

Date: November 10, 2026. Status: local implementation verified; real devnet funding, qualifying merge, automatic PYUSD payout and recipient receipt passed. Refund and hosted chain acceptance remain pending.

Scope: the user selected direct PYUSD funding and PYUSD wallet rewards alongside existing USD PayPal payments, then authorized implementation. [ADR 0024](../decisions/0024-pyusd-devnet-route.md) records the architecture and limits. No mainnet, Hyperwallet, swaps or publishing are included.

## Implemented

- Default-off devnet route, hardcoded genesis/mint/Token-2022/decimals; no client-selected network or token.
- Single-use signed wallet proof bound to authenticated GitHub account/session/origin; saved-wallet reuse and immutable payout snapshots.
- Exclusive PayPal/PYUSD funding reservation with v6 terms; wallet-signature validation against exact prepared bytes, persistence before broadcast, finalized receipt and exact debit/credit verification.
- Existing qualifying-merge policy, scoped settlement, CI and sponsor checks; delayed claim, exact multi-recipient allocations and automatic PYUSD delivery without PayPal payout intents.
- Separate original-wallet refund adapter behind the shared funded-cancellation flag and `PYUSD_REFUNDS_ENABLED`, with elapsed notice, independent review, no-award guard and fresh evidence.
- Durable signature/transaction identity, duplicate-send protection, callback lookup, ambiguous-result holds and late-success observation.
- Currency-specific bot/dashboard/payment/refund text. USD aggregate charts exclude PYUSD.
- Migration 0024, local key-generation command, config example and setup documentation.

## Local checks

- Full server suite: **468 tests passed / 80 files**.
- Web DOM suite after wallet compatibility changes: **16 tests passed / 5 files**.
- Chromium journey suite: **7 passed**, including signing and submitting the exact prepared Token-2022 transaction in the built browser app through a simulated wallet/API. Existing dashboard permission, responsive-layout and payout-state journeys also passed.
- Final targeted server recheck after read-authorization/cancellation-message changes: **33 tests passed / 4 files**.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`: passed on the final code.
- Local Markdown link targets in 15 affected documents and `git diff --check`: passed.

Providers are mocked. Tests exercise real SQL migrations/transactions in isolated local PostgreSQL schemas and real Ed25519/message/transaction serialization. They do not prove external RPC finality, mint availability, actual wallet extension behavior or delivery.

Notable negative cases include invalid/replayed/expired/cross-session wallet proofs; feature flag/session/origin/CSRF failures; logout after a wallet challenge; competing PayPal/PYUSD reservations; funding holds; wrong mint/program/owners/amount/decimals; non-devnet genesis; altered transaction bytes; frozen recipient changes; duplicate reservations; lost responses; ambiguous receipts; independent refund authorization and original-wallet destination. The transaction-builder test verifies the nonsigner reference is on TransferChecked and the preceding memo has no invalid signer requirements.

The first broad browser command accidentally discovered six obsolete tests inside an ignored `.local/worktrees` checkout. Playwright now excludes ignored local worktrees. The new current-tree wallet journey then exposed a real `?bounty=` collision with the dashboard inspection modal; funding now uses `?funding=`. The rerun passed all seven current-tree journeys. The old failed run is not counted as acceptance.

Build warnings remain: existing react-joyride directive and bundle-size warnings; Solana optional native bigint bindings fall back to JavaScript. No package build scripts were enabled to suppress these warnings.

## Devnet walkthrough preparation — November 10

The user authorized devnet testing and confirmed Phantom is ready on devnet.

- Generated a local, ignored 0600 treasury key and applied migration 0024 to the local development database. Enabled the local devnet wallet route; no hosted settings changed.
- Local web health is ready; the existing HTTPS tunnel reaches the authenticated wallet page. The general worker remains disabled and the running web process has an empty settlement scope.
- The first real RPC check exposed a truncated devnet genesis constant. The guard refused the network before any transfer. Corrected it to `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`; seven focused unit tests, changed-file lint and diff whitespace checks passed.
- Official devnet RPC confirmed the configured PYUSD mint is initialized Token-2022 with six decimals, zero configured transfer fees and no active transfer hook. Actual application-provider unsigned transaction preparation passed; it did not sign or broadcast a transfer.
- Treasury public address: `CC6eMUZhcBddPsC1oLwfQHCC2ipTVVtP3Vw1rzpTkVAb`. Its checked balance was zero. One RPC airdrop request returned code 410 (RPC faucet closed), directing users to the official web faucet. No test SOL receipt is confirmed yet.
- Actual wallet proof, test-token acquisition and funding are pending. At the preparation check, the local saved-wallet table was empty.

### Wallet connection confirmed

- Subsequent local database read confirmed `deepakA18` (GitHub ID `96007304`) saved `AM19gZaXJUvT7UsBFUn8XbXoE5Grga81C8xht6M4UmnM`, wallet version 1, through the authenticated ownership-proof flow.
- Finalized devnet RPC showed 988,544,920 lamports (0.98854492 SOL) and no PYUSD token accounts for that wallet. Treasury still had zero SOL and no PYUSD token accounts. Test PYUSD and treasury fee SOL have been requested from the user via the official faucets; receipt is not yet confirmed.
- Created [demo issue #18](https://github.com/deepakA18/gitpay-demo-http/issues/18), a bounded leading-BOM JSON-decoder task. Verified installed-app access and maintainer permission before creating local unfunded bounty **6** for amount 100 hundredths. It remains `OPEN`/USD until the maintainer explicitly reserves the PYUSD route and frozen v6 terms. No funding transfer, model review or payout has started.
- Live repository verification found the detached repository still named `deepakA18/gitpay-demo-http`; the generic demo-seed helper's `repopay-demo-http` name did not resolve. This walkthrough uses the verified existing repository and does not rename it.

### Faucet receipts and checkout readiness

- After the user's faucet confirmations, finalized RPC reads verified **100 devnet PYUSD** (100,000,000 atomic units, six decimals) and **0.98854492 SOL** in the maintainer wallet. Treasury has **5 devnet SOL** and no PYUSD before funding.
- Bounty 6 / issue 18 funding-term preparation passed using the saved repository sponsor and Copilot Auto. No inference request was made.
- Started a bounded local funding-only poller for bounty 6 / issue 18 / 100 hundredths, with exact source/destination checks. It cannot process payouts, reviews or unrelated bounties and stops on funding success or a hold. The general worker remains disabled.
- User has been given the wallet checkout link and asked to review and sign the **1.00 devnet PYUSD** transaction promptly after preparation. Signature, finalized funding and payout remain pending.

### Phantom priority-fee compatibility failure and correction

- The user signed bounty 6's checkout, but the sign endpoint returned a generic 503. Its transfer remained `RESERVED` with no saved signature. The browser's retained request showed a Compute Budget account absent from our preparation. [Phantom's documented priority-fee behavior](https://github.com/phantom/docs/blob/master/development-powertools/solana-priority-fees.md) explains that it augments unsigned transactions lacking fee instructions, including `signTransaction` requests. The exact-message guard rejects that mutation.
- Added explicit 200,000-unit / zero-priority-fee settings before token instructions. The original exact-message/signature checks remain enforced. A regression covers serialized wallet signing and rejection of added fee instructions; invalid signatures now receive a specific 400 response instead of “PYUSD unavailable.”
- **19 focused tests passed** (unit plus isolated SQL integration); typecheck, changed-file lint and server build passed. Real devnet simulation of the corrected 1-PYUSD transfer succeeded with **45,392 units consumed**, without signing or broadcasting.
- Before recovery, finalized devnet checks found the original blockhash expired, no saved signature and no reference transactions. Bounty 6 / issue 18 was put on an audited protective hold, retaining all prepared bytes/terms/history. Nothing was deleted or rewritten to pass testing.
- Created replacement [issue #19](https://github.com/deepakA18/gitpay-demo-http/issues/19) / local bounty **7** with the same task and 1-PYUSD amount. Restarted the local server with the fix and a funding-only poller restricted to bounty 7, issue 19 and the exact original wallet/treasury. No review or payout is enabled. Real Phantom signing and finalized receipt for the replacement are pending.

### Explicit devnet wallet context — November 10 follow-up

- The observed extension popup was **Solflare**, already set to devnet, reporting “this transaction is for mainnet.” The server's frozen bounty-7 terms use `solana-devnet`, the official devnet mint and devnet-only RPC/genesis guard. No signature was saved for that transfer. The previous injected `signTransaction(tx)` call omitted chain context; the error alone does not prove a mainnet transaction was broadcast.
- Replaced that transaction-signing path with Wallet Standard `solana:signTransaction` using explicit `chain: 'solana:devnet'`, matching authorized account and legacy-format capability. There is no legacy signing fallback without network context. Ownership proof and saved payout destinations remain unchanged.
- Added a pinned-devnet blockhash preflight immediately before the signing prompt. Expired preparations produce an explicit 409 and retain immutable bytes; a wallet network switch is not a remedy. The browser also checks that the returned message is unchanged before posting it; server signature/message checks remain authoritative.
- **471 server tests and all 20 web tests passed**, along with the Chromium PYUSD funding journey, typecheck, full lint and build. Browser tests use a mocked Wallet Standard provider; real extension signing and finalized funding remain pending.

- Finalized devnet inspection confirmed bounty 7’s preparation expired, with no saved signature and no reference transactions. Bounty 7 / issue 19 is now on an audited protective hold. Replacement [issue #20](https://github.com/deepakA18/gitpay-demo-http/issues/20) / local bounty **8** is an unfunded 1-PYUSD draft, with a funding-only poller restricted to that bounty, original wallet and treasury. The fixed local server is running with settlement scope empty; real signing is pending.

## Not performed / remaining

- No treasury key generated, no `.env` feature activation, no primary-database migration, no hosted changes, commit or push in this implementation turn.
- No blockchain broadcast, real wallet connection, test faucet request, PayPal payment or Copilot request occurred in the implementation turn. The subsequent preparation checks above include the unsuccessful RPC faucet request.
- Actual devnet wallet proof → funding → qualifying merge → payout → recipient receipt remains to be exercised with the user.
- Actual funded-refund acceptance remains pending; simulated clock tests do not pass the 72-hour live notice gate.
- Abandoned/expired funding transactions and failed/ambiguous outgoing transactions retain their reservation for operator investigation. Automatic fresh-blockhash replacement is not implemented. This is intentional prevention of duplicate payment, not complete recovery automation.
- Treasury custody/backup, RPC operations and any mainnet deployment require separate design and acceptance. This release cannot be configured to mainnet.

See [setup and stepwise acceptance](../crypto-payments.md) and [live checklist](../phases/live-walkthroughs.md#direct-pyusd-on-solana-devnet--november-10).

### Preparation timing follow-up

Bounty 8 / issue 20 remained `RESERVED`: the user reported signing, but no signed payload was saved. Browser inspection reproduced the explicit expiry error; finalized devnet inspection found no reference transactions. The original preparation is retained on an audited hold. This does not establish which wallet approval the user saw.

The earlier UI created a short-lived transaction on terms confirmation, then required another click to connect/sign. The corrected flow connects the wallet first, reserves frozen terms without a transaction, and prepares immediately before the signature request in the same action. Resume performs the same validation and never changes an existing immutable message. Verification: 20 focused server tests, all 22 web tests, Chromium confirmation-to-signing journey, typecheck, lint and build passed. Real extension success remains pending; the full suite's prior 471-server/20-web pass predates this timing refinement.

Active replacement: [issue #21](https://github.com/deepakA18/gitpay-demo-http/issues/21) / local bounty **9**, an unfunded 1-PYUSD draft. Local server restarted; bounded funding-only polling is restricted to bounty 9, issue 21, the original wallet and treasury. Settlement scope is empty.

### Bounty 9 post-approval check

The user requested verification after wallet interaction. Local bounty 9 / issue 21 remains CAPTURING with transfer RESERVED and no saved signature. A read-only check against the pinned devnet genesis found zero transactions for the exact transfer reference, 100 PYUSD still in the funding wallet, no treasury PYUSD account, and an expired prepared blockhash. Funding has not passed. Expiry is observed, but does not explain why the reported wallet approval produced no saved payload; the wallet-to-browser handoff remains unresolved. No further replacement issue or transfer was created during this check.

The funding page now places action errors beside the funding button and reports wallet connection, preparation, signing and submission progress. An unsigned reservation explicitly says Repopay has not received the transaction. All 22 web tests, web typecheck, changed-file lint and web build passed. These visibility improvements do not establish live funding success or resolve the original missing wallet response.

Read-only devnet simulation of bounty 9's saved unsigned transaction passed (`err: null`, 50,146 compute units), including treasury associated-token-account creation, memo and Token-2022 TransferChecked. The RPC replaced the expired blockhash for simulation only and skipped signature verification; no stored bytes changed and nothing was broadcast. This verifies instruction execution against current devnet state, not wallet signing or funding. The remaining investigation is the wallet/browser response and safe recovery of the expired preparation. [Simulation API contract](https://solana.com/docs/rpc/http/simulatetransaction).

### Same-bounty recovery implementation

Migration 0025 preserves EXPIRED unsigned funding attempts and one active successor per bounty, with immutable predecessor linkage. The authenticated preparation flow obtains finalized expiry/empty-reference evidence, then rechecks session, installation, ownership, active identity and funding guards under locks before replacement. The browser consumes the successor ID and signing CSRF; late old callbacks cannot cross identities. Signed, held and uncertain transfers are excluded. Wallet selection and stage-specific errors are visible beside the action.

Verification: 478 server tests and 24 web tests passed, including concurrent recovery, retained immutable history, rejected late signatures and negative provider/authorization cases. Typecheck, lint, build and the Chromium mocked-wallet funding journey passed. Applied migration locally and restarted the server with settlement scope empty and only the bounded bounty-9 funding poller. No new issue, chain signature, payment, model request or hosted deployment was created by this change. Real wallet signing and finalized funding remain pending.

### Real wallet response identified

Browser inspection reproduced `Wallet response validation: Wallet changed the prepared transaction. Nothing was submitted.` with Solflare selected. This establishes that the wallet callback returned a transaction; its prepared-message equality check rejected it before `/sign`. The exact changed fields still require the expanded diagnostic. The prior explanation of a missing callback was incomplete.

`Refresh status` cleared the action error, which hid the result after the user followed the walkthrough instructions. The page now retains that error during status refresh and describes changed blockhash, payer, instruction accounts/data and compute-budget values without accepting altered payment bytes. Verified with 24 web tests, web typecheck, changed-file lint, web build, and two Chromium journeys (unchanged signed bytes accepted; a changed fee rejected and error retained after refresh). No signed funding payload has been saved. A further user-controlled devnet signature is pending to identify the real wallet edit; no compatibility success is claimed yet.

The expanded diagnostic identified the real Solflare edit: `instruction 2: compute price 0 → compute price 100000`. New preparations now explicitly include 100,000 micro-lamports per compute unit with the existing 200,000-unit cap (20,000 lamports / 0.00002 test SOL priority fee). Exact-message verification is unchanged: edits to fees or any payment data still fail. Existing prepared messages remain immutable and use the guarded expiry recovery path. The server's 27 focused chain tests, typecheck, lint and build passed for this correction; real acceptance remains pending user signature.

### Signed payload saved; bounded expiry recovery

The Solflare fee correction allowed the real signed payload to reach the server. Attempt `4bb59a11-101f-4649-9e47-c05413f31dee` subsequently expired without a receipt and entered HOLD. Read-only finalized devnet checks at slot 520766644 / height 507904794 found the saved blockhash expired, null signature history and zero reference transactions. Funding is not yet confirmed. The 30-second polling cadence was avoidable delay; the first provider error was generic, so timing is not proven to be the only cause.

The user approved immediate submission after durable signing and recovery of only this exact signed-expired attempt. Automatic approval review rejected a broad migration permitting other signed/HOLD attempts to expire. The replacement migration 0026 instead pins this exact bounty/transfer/signature/parties/amount and requires a matching fresh operator audit. It performs no recovery by itself. No generic signed-expiry route is exposed. A new user wallet approval is still required after recovery.

The scoped recovery was applied locally after a second fresh check at finalized slot 520767065 / height 507905210. Old attempt `4bb59a11-101f-4649-9e47-c05413f31dee` is terminal EXPIRED with its signature and signed bytes preserved. Unsigned successor `525dd50f-810a-4fa4-851b-bf8387402d69` retains the same bounty, 1-PYUSD amount, terms, source and treasury; only the specific investigation attention was cleared. Approval/proof and predecessor/successor IDs were recorded atomically in bounty activity. No transfer was broadcast by recovery.

Verification after immediate submission and the scoped migration: **480 server tests and 24 web tests passed**, including durable-persistence-before-publish, exact-byte replay, denied wrong-account submission, exact approved expiry with audit, denied other signed expiries and immutable expired bytes. Typecheck, lint and build passed. Existing Vite chunk/directive warnings remain. Local `/healthz` reports ready; settlement scope is empty, and the bounded funding-only poller targets only bounty 9. User approval of the replacement and finalized chain funding are pending; no review, payout, commit, push or hosted deployment occurred.

### Finalized devnet funding — passed

Bounty **9** / [issue #21](https://github.com/deepakA18/gitpay-demo-http/issues/21), active transfer `525dd50f-810a-4fa4-851b-bf8387402d69`, reached **FUNDED / SUCCESS**. The user approved in Solflare and supplied the explorer signature. Independent finalized RPC inspection and the application's exact-message/Token-2022 balance validator both passed, with no transaction error, at slot **520767502**.

[Devnet transaction](https://explorer.solana.com/tx/AcCHGo3eAPRWALFJNCUB8jojE9k2iAVu9p76hmGZqwWtjo6auvSGAYngm3j8BEaaC5na3HVc3MjL5Fbm2zqs2F5?cluster=devnet).

Exactly **1.00 PYUSD** moved from the saved funding wallet to the configured treasury. Finalized token balances: funder **99**, treasury **1**. The saved signature matches the user's transaction. Funding hold and needs-attention are false; transfer attention is null. Bounty 9 has **zero awards and zero outgoing transfers**. The bounded funding poller stopped after FUNDED. Settlement scope remains empty. This completes live funding only; contributor wallet connection, qualifying review/merge, PYUSD delivery and recipient receipt remain open.

### Wallet-independent discovery

Removed the Phantom/Solflare name allowlist and brand-specific ownership injection path. The browser uses Wallet Standard capability discovery and a shared selector for ownership and funding, including late registration/removal. Funding still passes explicit devnet context and enforces exact prepared bytes; ownership confirmation rejects changed signed messages before calling the server. Solflare is the only wallet with real funding evidence so far. Other adapter names are simulated compatibility tests, not live extension acceptance.

Wallet-discovery verification: 480 server tests, 32 web tests, two mocked Chromium signing journeys, typecheck, lint and build passed. Tests cover arbitrary wallet names, selected-wallet routing with multiple extensions, late registration/removal, rejection, altered ownership messages, wrong account/network and exact transaction validation. The local frontend was rebuilt; no server/payment configuration, stored wallet or funded bounty was changed. No commit/push/hosted deployment was performed.

### Contributor wallet saved — 0xdeepak18

The user supplied a screenshot showing signed-in `0xdeepak18`, Backpack selected and a saved wallet. Read-only local verification found GitHub ID `354933167`, wallet `9Eis2fKZpAcZyVSbDdnuBZJ2f74SkSjAC7dx1GsAhNwz`, version 1. GitHub reports write access to the isolated demo repository. Bounty 9 remains FUNDED for 1 PYUSD. This records real contributor ownership connection with Backpack selected; it does not prove Backpack transaction signing, an outgoing payout, or independently witnessed no-prompt reuse. The user controls both maintainer and contributor GitHub accounts, so this is a technical workflow test, not independent-user acceptance. No model call or payment was initiated during this check.

### Issue 21 solution prepared for contributor PR

At the user's request, prepared the JSON BOM fix in a separate ignored checkout and pushed only `fix/issue-21-json-bom` to the isolated demo repository, commit `9030e00`. The new leading-BOM regression failed before the fix; all 21 serializer tests then passed. The change is limited to `lib/paypalhttp/serializer/json.js` and `demo-test/serializers.test.cjs`. It removes exactly one initial U+FEFF from strings, preserves interior characters and normal JSON values, and retains SyntaxError behavior.

The terminal remained authenticated as deepakA18; commit attribution was not changed to impersonate 0xdeepak18. The user must open the PR from the 0xdeepak18 browser session for this explicitly self-controlled technical devnet test. No PR was created or merged by the assistant, no runtime model request was authorized/run, and settlement scope remains empty.

### PR 22 pre-review check and attribution correction

[PR #22](https://github.com/deepakA18/gitpay-demo-http/pull/22) was opened by `0xdeepak18`, links `Fixes #21`, is mergeable, and has passing GitHub test checks at head `9030e005539e651eb2684c785593096f3ac89f42`. However, GitHub associates that commit with bounty creator `deepakA18`. The current collector treats this author as unverified/ineligible, so opening the PR under the contributor account alone was insufficient. The assistant's earlier handoff overlooked this condition. No Copilot request was spent.

The user approved up to **3 Copilot Auto requests** for this case (premerge and postmerge review) and settlement limited to bounty 9's existing **1 PYUSD devnet** award to the saved 0xdeepak18 wallet. Usage remains **0/3**; no scope has been activated yet. PR remains unmerged and no award/payout exists. Corrective handoff: authenticate the GitHub CLI as 0xdeepak18, then publish the already-tested patch through that account on a fresh branch while preserving PR22/history. No eligibility relaxation or falsified commit-author identity is permitted.

### Correct contributor PR and circular review diagnosis

After the user authenticated the CLI as `0xdeepak18`, the tested patch was published through GitHub's authenticated commit defaults on [PR #23](https://github.com/deepakA18/gitpay-demo-http/pull/23), head `8cb3d226545dcf55ee9f6c030f81778ab8a7fbab`. Both GitHub-associated commit author and committer are `0xdeepak18` (354933167). PR #22 is superseded and must not be merged. Exact-head external CI passes; application collection is sufficient with only that eligible author and no unverified authors.

Approved request 1/3 produced verification 39, v5 / gpt-6-luna: PARTIAL, coverage 0.90, confidence 0.91. It explicitly found the code and tests correct; its only unmet requirements were proof that the PR remained unmerged and that Repopay review had been checked. This is a circular interpretation of walkthrough instructions, not a demonstrated implementation defect. The result remains preserved and cannot authorize payment.

[ADR 0026](../decisions/0026-verifier-orchestration-boundary.md) introduces prompt v6 without editing frozen issue criteria or payment policy. Local verification: 24 focused verifier/attribution/award-guard tests, typecheck and lint passed. The initial integration command omitted environment loading and failed setup; rerunning with the configured isolated test database passed. These tests validate prompt construction and deterministic guards, not model accuracy. Settlement remains pinned to v5 pending explicit acceptance of the corrected scoped result. No award or outgoing transfer exists.

V6 request **2/3** completed as verification **40**: **RESOLVES**, coverage **1.00**, confidence **0.99**, serving model **gpt-6-luna**, no unmet requirements, 100% allocation to `354933167`. Published Check Run and bot comment on PR #23 were independently read back from GitHub. The advisory Check has neutral conclusion by design; its title is `RESOLVES · confidence 99%`. Both GitHub test checks pass. Superseded PR #22 was closed without merge; all its history remains available. PR #23 stays open.

This is one bounded live case, not broad v6 evaluation. One approved request remains for postmerge refresh. ADR 0021 explicitly prevents future prompt versions from inheriting v5 settlement acceptance, so v6 scope acceptance is the remaining pre-merge decision. No new scope, award, outgoing PYUSD transfer, hosted deployment or main-project commit/push was performed.

### V6 accepted and exact local scope enabled — November 10

The user explicitly accepted v6 only for bounty 9 (approval `call_fa0252e9e3d64a90bb46fa69c3092b1b`). The profile exception pins bounty/repository/issue/amount/currency and canonical frozen-terms hash; matching `SETTLEMENT_DEMO_SCOPE` and the devnet enable flag remain required. Other v6 cases and future prompts stay closed. The regression fixture contains only the public frozen terms, with no credentials.

Verification: **482 server tests and 32 web tests passed**, typecheck, lint and server build passed. Tests include default-off behavior, rejection of another bounty/repository/amount/issue/currency/terms hash, disabled devnet and future prompt versions, plus existing award concurrency and PYUSD idempotency/authorization guards. One lint pass exposed redundant conversions and a schema-guaranteed network comparison; these were removed and lint passed.

The bounded readiness check revalidated the actual frozen scope, still-open PR23's exact head/author, current owner sponsor and repository access, finalized funding receipt, expected saved recipient wallet/version, matching treasury and zero existing awards. It recorded the scoped acceptance in bounty activity and set only the local `.env` settlement scope to bounty 9. General workers remain stopped; scoped execution will handle the authorized case after the user's merge, preserving the remaining one-request budget. No merge, award, outgoing transfer, main-project commit/push or hosted deployment occurred. Next: deepakA18 merges PR23 with a merge commit, then refresh exact evidence and deliver only the qualifying 1-PYUSD award to 0xdeepak18.

### Qualifying merge and PYUSD payout — passed

The user merged [PR #23](https://github.com/deepakA18/gitpay-demo-http/pull/23) at `2026-11-10T16:46:16Z`, merge SHA `af57c33700a1497ea83bf12f7f47419c7d83872e`, preserving reviewed head `8cb3d226545dcf55ee9f6c030f81778ab8a7fbab`. App-authenticated linking and collection refreshed the merged evidence. Request **3/3**, verification **41**, returned **RESOLVES**, coverage **1.00**, confidence **1.00**, model **gpt-6-luna**, no unmet requirements and 100% allocation to 0xdeepak18. The bounded allowance is now exhausted.

The scoped operator used the normal candidate scanner and automatic settlement policy with all guards retained. It independently checked exact-head GitHub Actions success, current owner sponsor, finalized funding, actual devnet genesis, merged revision, saved recipient wallet/version and exact scope. An initial operator precheck referenced a field stripped by the GitHub adapter and stopped before an award; it was corrected to the adapter's `merged_at`/closed state and independently verified merge SHA. No application eligibility check was bypassed.

- Bounty **9** / issue **21**: **PAID**, funding hold false, attention false.
- Award **3**, submission **6**: exactly **100 hundredths / 1.00 PYUSD**, all to GitHub ID `354933167` (`0xdeepak18`).
- Exactly one outgoing transfer: `fbbb1324-8817-4878-a571-3119f30c2f4a`, **SUCCESS**.
- Recipient: `9Eis2fKZpAcZyVSbDdnuBZJ2f74SkSjAC7dx1GsAhNwz`, saved wallet version 1.
- Finalized slot **520807943**, transaction error null; application exact-message/token-balance receipt validation passed. Recipient finalized PYUSD balance: **1**.
- [Devnet payout transaction](https://explorer.solana.com/tx/5r8p4UEvmgpUGSfh24dYDHCReZVN6PY1DTjcu8XW1pr9xgwDxRMQFap3SsVjUzmSohhUDgpCASk2DrUBmctX2mYr?cluster=devnet).

The user supplied that same transaction link and explicitly confirmed **received**. Issue21 has `bounty-paid` and no `bounty-open`; the issue status and PR23 award bot comments both show PAID and 1.00 PYUSD to 0xdeepak18. Projection readbacks were verified. There was no new funding, second payout, PayPal payout or mainnet transaction.

This completes the basic local PYUSD devnet funding → qualifying merge → automatic wallet payout → receipt walkthrough. It is a self-controlled account test, not independent-user, broad model, refund, hosted-chain or production acceptance. No project commit/push/deployment occurred.
