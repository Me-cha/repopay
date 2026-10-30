CREATE TABLE "funding_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bounty_id" bigint NOT NULL,
	"attempt_number" integer NOT NULL,
	"actor_gh_id" bigint NOT NULL,
	"checkout_origin" text NOT NULL,
	"terms" jsonb NOT NULL,
	"terms_hash" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"order_request_key" text NOT NULL,
	"capture_request_key" text NOT NULL,
	"order_id" text,
	"capture_id" text,
	"approval_url" text,
	"order_submission_boundary_at" timestamp with time zone,
	"capture_submission_boundary_at" timestamp with time zone,
	"order_safe_retry_until" timestamp with time zone,
	"capture_safe_retry_until" timestamp with time zone,
	"observation_version" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'NEW' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"attention" text,
	"next_reconcile_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funding_attempts_order_request_key_unique" UNIQUE("order_request_key"),
	CONSTRAINT "funding_attempts_capture_request_key_unique" UNIQUE("capture_request_key"),
	CONSTRAINT "funding_attempts_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "funding_attempts_capture_id_unique" UNIQUE("capture_id"),
	CONSTRAINT "funding_amount_check" CHECK ("funding_attempts"."amount_cents">0 and "funding_attempts"."currency"='USD'),
	CONSTRAINT "funding_status_check" CHECK ("funding_attempts"."status" in ('NEW','CREATED','APPROVED','CAPTURING','PENDING','COMPLETED','VOIDED','DECLINED','HOLD'))
);
--> statement-breakpoint
ALTER TABLE "action_tokens" DROP CONSTRAINT "action_kind_check";--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "current_funding_attempt_id" bigint;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "funded_terms" jsonb;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "funding_actor_gh_id" bigint;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "funding_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "funding_attempts" ADD CONSTRAINT "funding_attempts_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_funding_attempt" ON "funding_attempts" USING btree ("bounty_id") WHERE "funding_attempts"."active";--> statement-breakpoint
CREATE UNIQUE INDEX "funding_attempt_number" ON "funding_attempts" USING btree ("bounty_id","attempt_number");--> statement-breakpoint
ALTER TABLE "action_tokens" ADD CONSTRAINT "action_kind_check" CHECK ("action_tokens"."action" in ('cancel_draft','fund'));