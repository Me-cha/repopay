# Repopay — demo video script

Target duration: **2 minutes 50 seconds**, leaving a 10-second buffer before the three-minute limit.

Delivery: YouTube, public or unlisted, without a password. Narration is spoken; screen directions and captions are not.

## 0:00–0:15 — The problem

**Show:** GitHub pull request, followed by a brief preview of its confirmed payout.

**On-screen text:** From pull request to paid.

**Narration:**

> A pull request can create real value. But paying the person behind it often means a separate process: messages, payment details, and manual follow-up. Repopay connects that last mile—turning funded GitHub issues into paid contributions.

## 0:15–0:37 — Fund useful work

**Show:** GitHub issue with acceptance criteria → bounty command → bot funding link → PayPal checkout → confirmed funded status.

**Caption:** PayPal sandbox.

**Narration:**

> Here’s a maintainer with a bug to fix. They create a bounty directly on the GitHub issue. Repopay provides the funding link, records the requirements, and accepts payment through PayPal. The bounty becomes funded only after payment is verified. Contributors can now see exactly what work is being rewarded.

## 0:37–1:03 — Review inside GitHub

**Show:** Contributor’s linked PR → actual Repopay review → highlight its explanation and a concrete finding. Briefly show maintainer feedback on the PR.

**Narration:**

> A contributor submits a pull request. GitHub Copilot reviews the changes against the issue’s requirements, using the code and test evidence for that revision. Its explanation appears right on GitHub. If something is missing, the contributor gets actionable feedback before merge. Maintainers can also review and comment. Nobody needs to merge a bad solution just to reject it.

## 1:03–1:30 — Merge to payment

**Show:** Qualifying PR → merge → Repopay payment status → recipient’s PayPal Activity. Keep the matching amount visible.

**Caption:** PayPal sandbox. Processing time shortened, where applicable.

**Narration:**

> Once the selected pull request qualifies and the maintainer merges it, Repopay automatically processes the reward. AI provides evidence; application rules control payment, checking the funding, eligible recipient, and reviewed revision. Here is the confirmed PayPal payout—and here is the contributor’s receipt. The work, decision, and payment remain traceable.

## 1:30–1:55 — Crypto funding and rewards

**Show:** Saved wallet → actual devnet funding transaction → qualifying merged PR → finalized PYUSD payout in the explorer and recipient wallet.

**Transition text:** Prefer crypto?

**Caption:** Solana devnet · test PYUSD. Separate devnet walkthrough.

**Narration:**

> We also support a separate crypto-to-crypto route using PayPal USD, or PYUSD, on Solana. The maintainer funds in PYUSD, and the contributor receives PYUSD in their saved wallet. This devnet walkthrough completed a one-PYUSD payout after a qualifying merge. Wallet details are saved once and reused for future rewards.

## 1:55–2:20 — Render behind the workflow

**Show:** Render service overview → actual completed `verifySubmission` workflow run → corresponding GitHub review.

**On-screen diagram:** GitHub → Render Workflow → Copilot → GitHub.

**Narration:**

> Render powers the hosted application and independent AI review execution. A GitHub event dispatches a Render Workflow that runs the Copilot review and saves the result. GitHub feedback is published separately. This separates slow AI work from the worker handling commands and payment reconciliation. Here’s a completed workflow and the review it produced.

## 2:20–2:40 — The impact

**Show:** Dashboard with funded work, review status and confirmed payouts. End on the winning PR’s bot comment.

**Narration:**

> The result is one connected workflow: maintainers fund useful work, contributors receive feedback where they already collaborate, and qualifying merges lead to automatic rewards. GitHub remains the work surface. PayPal handles USD payments, and our PYUSD route adds wallet-based rewards.

## 2:40–2:50 — Closing

**Show:** Repopay logo, https://repo-pay.onrender.com and the closing tagline.

**Narration:**

> Repopay makes rewarding open-source work part of the development workflow. Fund the issue. Review the solution. Merge—and reward the contributor.

## Recording notes

- Rehearse against a timer. Segment timings are targets; the exported video must stay below three minutes.
- Use one USD bounty throughout the main story. Its issue, PR, amount and receipt must match. Introduce the separate PYUSD walkthrough explicitly.
- Zoom into the review explanation, confirmed payment and recipient receipt. Keep important details readable without pausing.
- Cut waiting time with a “Processing time shortened” caption. Do not imply review or settlement is instantaneous.
- Show actual application and provider evidence. Label historical footage or mocked screens if used; do not pass them off as a new live transaction.
- Keep PayPal sandbox and Solana devnet labels visible in their respective scenes. The PYUSD walkthrough does not establish hosted crypto or mainnet acceptance.
- Show a completed Render workflow and its corresponding review, rather than only a Render logo. Do not claim measured speed, cost savings or production uptime.
- Skip account setup, login screens, terminal logs, refunds and edge cases in this recording.
- Hide credentials, cookies, private keys, personal emails and sensitive account details.
- Do not say “AI picks the best PR” or “AI sends the money.” AI supplies evidence, maintainers choose what to merge, and application rules govern awards and payment.
- After upload, check that the YouTube video plays publicly or unlisted without authentication and that all essential evidence appears before three minutes.

## Evidence references

- [Hosted PayPal and Render walkthrough](evidence/render-workflows-implementation.md#hosted-user-journey--november-9-follow-up)
- [PYUSD devnet walkthrough](evidence/pyusd-devnet.md)
- [Crypto routes and limitations](crypto-payments.md)

This script does not authorize new payments, model requests, merges or publication. Use existing verified footage, or separately authorize any new recording walkthrough.
