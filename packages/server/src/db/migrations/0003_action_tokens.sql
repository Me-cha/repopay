CREATE TABLE "action_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"bounty_id" bigint NOT NULL,
	"action" text NOT NULL,
	"params" jsonb NOT NULL,
	"bounty_version" integer NOT NULL,
	"requested_by_gh_id" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by_gh_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_kind_check" CHECK ("action_tokens"."action"='cancel_draft')
);
--> statement-breakpoint
ALTER TABLE "bounties" DROP CONSTRAINT "bounty_status_check";--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "capture_request_key" text;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "capture_id" text;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "funded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "action_tokens" ADD CONSTRAINT "action_tokens_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounty_status_check" CHECK ("bounties"."status" in ('OPEN','CANCELLED','CAPTURING','FUNDED'));