> Superseded in part on November 12: [ADR 0027](0027-automatic-bounty-settlement.md) removes per-bounty acceptance and environment scopes. Historical acceptance evidence below is preserved.

# ADR 0026: Separate implementation assessment from review lifecycle

Date: November 10, 2026. Status: locally implemented; bounded live PR review passed. User accepted v6 only for the existing bounty 9 devnet case.

On the PYUSD devnet walkthrough, PR #23's v5 review recognized the correct decoder and regression tests but returned PARTIAL solely because the issue said to leave the PR unmerged until CI and Repopay review were checked. Requiring this review to have already occurred creates a circular requirement; after merge the same instruction could also incorrectly disqualify the solution.

Prompt `repopay-verifier-v6` explicitly separates code, tests, scope and evidenced contribution requirements from orchestration instructions to wait for review, merge, connect a wallet or deliver a reward. Frozen issue text stays complete and immutable. The model must not invent completion of those steps. Missing implementation, missing required contributor attestations, insufficient evidence and actual defects still block RESOLVES. No saved verdict is rewritten.

Application guards continue to own actual merge state, review freshness, required CI, funds, sponsor, eligibility, recipient ownership, allocation and idempotency. This changes no financial threshold or frozen terms. V6 does not inherit v5 settlement acceptance. The user explicitly accepted only bounty 9 after its concrete RESOLVES / 99% result. `settlement/profile.ts` retains v5 acceptance and adds a v6 exception pinned to bounty 9, repository 1435468752, issue 21, 100 hundredths of PYUSD, devnet and frozen-terms hash `d42965f0ace59e02d357e9db3c03ad845092f5e1e75f1b8627e7f40ffed48c78`. A matching explicit environment scope is still required. The bounded operator flow additionally checks PR23, its exact reviewed head, recipient 354933167 and the saved recipient wallet before proceeding. Other v6 bounties remain disabled. No broad evaluation or production readiness is implied.

The approved three-request allowance for bounty 9 covers the bounded pre/postmerge walkthrough. The v5 false-PARTIAL consumed request 1. The v6 correction passed RESOLVES / 99% confidence on request 2; request 3 remains reserved for postmerge evidence if necessary. See [actual outcomes](../evidence/pyusd-devnet.md).

## November 12: additional explicit PayPal sandbox acceptance

After Render verification 44 saved RESOLVES / 99% confidence on merged PR #32, the user explicitly accepted v6 for hosted bounty 8 / issue 31 only: repository `1435468752`, 5000 USD cents, v4 frozen terms hash `275328bdf43952565ad2926e46e41f1329fa080ebce0cbf6ef8f332d728cf900`. The accepted serving model is `gpt-6-luna`; the saved allocation is 100% to GitHub identity `354933167` (`0xdeepak18`). The profile adds this exact exception alongside the prior devnet case; the environment must separately match. The user authorized replacing the obsolete bounty-3 environment scope with bounty 8 and allowing the normal guarded $50 sandbox payout. No threshold, evidence, funding, recipient, allocation or idempotency guard is bypassed. Other v6 bounties remain disabled; this is not broad evaluation or production acceptance.
