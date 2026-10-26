# GitPay server

Documentation placeholder for the planned TypeScript server and worker. No executable package exists yet.

Phase 0 of [the implementation plan](../../IMPLEMENTATION_PLAN.md) will create the manifest, strict TypeScript configuration, database setup and validation scripts. Later phases add GitHub integration, authenticated actions, PayPal clients, AI verification, deterministic policy and settlement.

Business actions own state transitions. Webhook/HTTP handlers delegate to them; workers perform slow external calls outside database transactions. Cancellation review must preserve submission evidence and committed awards.

When adding modules, update the current map in [AGENTS.md](../../AGENTS.md), this ownership description and the plan's target layout in the same change.
