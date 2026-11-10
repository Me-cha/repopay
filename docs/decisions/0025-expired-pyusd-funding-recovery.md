# ADR 0025: Recover expired unsigned devnet funding on the same bounty

Date: 2026-11-10

Status: Implemented locally; real wallet acceptance pending. Partially supersedes ADR 0024's prohibition on replacement preparations, only for the unsigned funding case below. Signed funding, outgoing payouts/refunds and held/uncertain outcomes retain the original restriction.

The user authorized fixing the expired checkout and signing flow. Repeated replacement GitHub issues are unnecessary and do not diagnose the wallet handoff.

## Recovery boundary

An authenticated funding actor may continue the existing bounty. The provider checks the pinned devnet genesis, a finalized block height beyond the saved last-valid height, an invalid saved blockhash, and an empty reference history at or beyond the checked finalized slot. Any reference activity, signature, hold, funding uncertainty or RPC failure blocks replacement. The browser must connect the original funding wallet first.

Migration 0025 permits multiple historical funding attempts with exactly one non-expired attempt per bounty. The old unsigned attempt becomes terminal EXPIRED without rewriting its message, wire, amount or terms. A new attempt links to its predecessor through immutable `supersedes_id`. Under the bounty and transfer locks, the service rechecks session, installation, ownership, active identity, frozen terms, funding state and absence of a signature. It records the finalized chain observation in bounty activity. Concurrent replacements cannot both commit. Provider calls occur outside SQL transactions.

The preparation response supplies the new transfer ID and its path-bound signing CSRF token. Old browser callbacks cannot submit against the new attempt. Polling skips expired history; signed transfers and unknown outcomes are never automatically replaced. A replacement reserves the same amount and same parties; it does not authorize an additional bounty or move tokens.

The page shows the selected wallet, signing stage and errors beside the action. A successful wallet response still requires exact message validation, authenticated persistence and finalized chain confirmation. Simulation and mocked wallet tests do not prove extension signing or funding success.

## Explicit one-off signed-expiry exception

On November 10 the user separately approved recovery of bounty 9's transfer `4bb59a11-101f-4649-9e47-c05413f31dee` and signature `2Mr5oBco4iTeQzofjQAokuewjj99vRw6HinxHCoamJ9gBt5fmeRC1GuGZPX8uAzaBZptBcjeSJnenCf7xvGgda6L`. Migration 0026 intentionally pins that single historical identity, original wallets, 1 PYUSD amount and devnet terms. It does not introduce general signed-transfer recovery. The operator must freshly verify finalized expiry, null signature history and empty reference history outside SQL, then lock/recheck records, insert the matching audit proof, expire the old attempt and reserve one unsigned successor atomically. Old signed bytes remain immutable, and a new wallet approval is required. Any other signed/held/uncertain attempt retains the original restriction; the ordinary HTTP preparation endpoint still cannot perform this exception.

A separate explicit user approval permits immediate devnet funding reconciliation after signed bytes are durably saved. The signing endpoint now invokes that path; polling remains recovery for unavailable or pending provider responses. Network calls occur after commit, only the original signed bytes can be published, and final funding still requires the exact finalized receipt. This changes submission timing, not payout authorization.
