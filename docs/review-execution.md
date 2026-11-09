# Isolated review execution

The [design](decisions/0022-review-publication-and-execution.md) implements shared, dedicated and Render backends. Isolation is opt-in; financial operations remain in the trusted application.

## Configuration

| Setting | Trusted web/worker | Isolated executor |
| --- | --- | --- |
| `REVIEW_BACKEND` | `shared` default; `dedicated` or `render` to opt in | Matching isolated backend |
| `REVIEW_GENERATION` | Positive integer; increase for a backend/artifact switch | Same generation |
| `REVIEW_EXECUTOR_KEY` | Independent 32-byte base64 secret | Same secret |
| `PUBLIC_URL` | Public application origin | Same application origin; used as the executor's broker base URL |
| `RENDER_API_KEY` | Required only for Render dispatch | Forbidden |
| `RENDER_REVIEW_TASK` | Exact `workflow/verifySubmission:version` | Not needed |
| Database, GitHub private key, PayPal and encryption keys | Existing service only | Forbidden |

Generate a separate key with `openssl rand -base64 32` and store it privately in both configurations. Never put secrets in a task argument or broad runtime environment group attached to the workflow. The broker supplies one separately consented sponsor token at the durable inference boundary; no ambient operator credentials are used.

## Local dedicated mode

1. Stop workers, back up the application database, apply migrations with `pnpm db:migrate`, then `pnpm db:check`.
2. Set application `REVIEW_BACKEND=dedicated`, its executor key and generation. Generation 1 is valid for initial configuration; an existing backend switch needs a larger value after draining.
3. Copy `.env.reviews.example` to ignored `.env.reviews`. Set the key and matching generation. Keep application secrets out of both this file and the worker's parent environment.
4. Run `pnpm build`; start the app normally, then `node --env-file=.env.reviews packages/server/dist/review-worker.js` on Node 22.23.4. Two local loops poll the broker; database admission limits all executor instances together.
5. `pnpm ops:reviews status` prints operational IDs/states. `pnpm smoke:reviews` tests the compiled Render task's SDK registration locally, with no Copilot request.

## Render release

Verified November 9: `Me-cha/repopay`, branch `main`; `repo-pay` web service (`srv-dbnff93l550s73f2no20`), Singapore, `https://repo-pay.onrender.com`, Free compute. Workflow `repopay-reviews` (`wfl-dboqnubl550s73ak1a7g`) belongs to the GitPay project's Production environment. Backend generation 2 pins `repopay-reviews/verifySubmission:6345c3e`; hosted review runs have saved real Copilot results and published GitHub feedback. The earlier missing-task/startup failures and current full-flow evidence are recorded in [hosted checks](evidence/render-workflows-implementation.md#hosted-user-journey--november-9-follow-up).

A sleeping free web service cannot provide continuously available dispatch. A brief awake demonstration is not always-on production evidence.

The existing `repopay-reviews` uses the same repository and region with these commands:

```text
Build: corepack enable && corepack prepare pnpm@10.29.3 --activate && pnpm install --frozen-lockfile --prod=false && pnpm --filter @repopay/server build
Start: pnpm start:reviews:render
```

Equivalent settings are in `render-workflows.yaml`, separate from `render.yaml`. The workflow was created through the CLI/API; the Blueprint was not applied. Deploying the web service alone does not create or update a workflow version. The task entrypoint disables SDK automatic startup before registration and starts exactly once explicitly.

`repopay-reviews` is one long-lived workflow service. It currently registers one task named `verifySubmission`. Each workflow release creates a new workflow version and registers that version's task definition; each invocation creates only a new task-run ID. Configure the dispatcher with the exact versioned task slug returned by Render, for example `repopay-reviews/verifySubmission:<version>`. That value remains unchanged across every run of that release. Update it deliberately only after releasing and accepting a newer workflow version. RepoPay requires the version suffix so a new release cannot silently change the code used for an already-dispatched review.

After release and spending approval:

1. Publish only reviewed scoped changes; deploy additive migrations, broker and dispatcher support with `REVIEW_BACKEND=shared`. Drain pre-migration verifier processes.
2. Create the workflow with only executor settings, disable auto-deploy and record its exact deployed task version. The workflow never receives database/payment keys.
3. Add the Render API key and pinned `RENDER_REVIEW_TASK` to the trusted dispatcher. Keep isolated execution inactive until acceptance.
4. Complete approved hosted networking/subprocess smoke and mocked comparisons in an isolated test scope. Bound paid compute separately from live Copilot calls; never enable a mock model on the financial application path.
5. Drain, pause, advance generation, configure the selected backend and resume. Inspect dispatch/run IDs, saved results, publication jobs and normal reconciliation.

Render `flex` is metered by actual CPU/RAM, up to $0.40/hour at full allocation; a maximum-duration 300-second task has up to about $0.0334 of compute. State retention and applicable network charges are separate. This is a provider rate, not an application spending cap. The hosted sample and monthly ceiling still require approval. [Provider pricing](https://render.com/docs/workflows-limits)

## Pause and recovery

`pnpm ops:reviews pause` stops admission and fences running review authorization while financial reconciliation continues. Let known Render runs terminate, or cancel them in Render, then use `pnpm ops:reviews reconcile <dispatch-id>`; it checks terminal status before releasing capacity. Heartbeat expiry or an HTTP timeout is not termination evidence.

For a crashed dedicated process, verify that it and its Copilot subprocess have exited before running `pnpm ops:reviews confirm-local-exit <dispatch-id> <run-id> --process-exit-confirmed`. Never automate this assertion from heartbeat expiry. Unknown launches without a recovered Render run ID stay held. Find the original run in Render, wait for terminal state, then use `pnpm ops:reviews recover-render-run <dispatch-id> <run-id>`. It verifies that Render retained exactly that dispatch as input, binds the previously unknown run and reconciles termination. Never issue a replacement launch after the retention window.

Drain READY work on the old backend before switching. Pause, reconcile active reservations, change backend and increase generation, then run `pnpm ops:reviews configure`; it refuses outstanding work. Deploy matching executor configuration. `pnpm ops:reviews resume` resumes a paused matching generation only after reservations drain. Shared rollback is also a generation change and requires a binary that honors the control table.

`OUTCOME_UNKNOWN` does not automatically retry inference. After confirmed termination, a maintainer may request a fresh review using the existing GitHub command and remaining allowance. Failed publication uses `pnpm ops:retry-job <job-id>` and cannot call the model. A lost Check create with no recovered marker stays unresolved for operator inspection.
