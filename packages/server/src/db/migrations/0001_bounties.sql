CREATE TABLE "bounties" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"installation_id" bigint NOT NULL,
	"repo_id" bigint NOT NULL,
	"repo_full_name" text NOT NULL,
	"issue_number" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_by_gh_id" bigint NOT NULL,
	"created_via" text NOT NULL,
	"status_comment_id" bigint,
	"needs_attention" boolean DEFAULT false NOT NULL,
	"attention_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bounty_amount_check" CHECK ("bounties"."amount_cents">0 and "bounties"."currency"='USD'),
	CONSTRAINT "bounty_status_check" CHECK ("bounties"."status" in ('OPEN','CANCELLED')),
	CONSTRAINT "bounty_source_check" CHECK ("bounties"."created_via" in ('label','command'))
);
--> statement-breakpoint
CREATE TABLE "bounty_activity" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bounty_id" bigint NOT NULL,
	"actor_gh_id" bigint,
	"source" text NOT NULL,
	"action" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installations" (
	"id" bigint PRIMARY KEY NOT NULL,
	"account_id" bigint NOT NULL,
	"account_login" text NOT NULL,
	"suspended_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "installations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_activity" ADD CONSTRAINT "bounty_activity_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_bounty_per_issue" ON "bounties" USING btree ("repo_id","issue_number") WHERE "bounties"."status"<>'CANCELLED';
