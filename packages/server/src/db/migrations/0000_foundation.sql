CREATE TABLE "deliveries" (
	"source" text NOT NULL,
	"delivery_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_source_delivery_id_pk" PRIMARY KEY("source","delivery_id"),
	CONSTRAINT "deliveries_source_check" CHECK ("deliveries"."source" in ('github', 'paypal'))
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"dedupe_key" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_owner" text,
	"lease_token" text,
	"lease_heartbeat_at" timestamp with time zone,
	"locked_until" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_dedupe_key_unique" UNIQUE("dedupe_key"),
	CONSTRAINT "jobs_status_check" CHECK ("jobs"."status" in ('queued', 'running', 'done', 'failed')),
	CONSTRAINT "jobs_attempts_check" CHECK ("jobs"."attempts" >= 0 and "jobs"."max_attempts" > 0),
	CONSTRAINT "jobs_lease_check" CHECK ("jobs"."status" <> 'running' or ("jobs"."lease_owner" is not null and "jobs"."lease_token" is not null and "jobs"."lease_heartbeat_at" is not null and "jobs"."locked_until" is not null))
);
--> statement-breakpoint
CREATE INDEX "jobs_ready_idx" ON "jobs" USING btree ("status","run_after");