CREATE TABLE "payout_batches" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"award_id" bigint NOT NULL,
	"sender_batch_id" text NOT NULL,
	"provider_batch_id" text,
	"submission_boundary_at" timestamp with time zone,
	"safe_retry_until" timestamp with time zone,
	"observation_version" integer DEFAULT 0 NOT NULL,
	"next_reconcile_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attention" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_batches_award_id_unique" UNIQUE("award_id"),
	CONSTRAINT "payout_batches_sender_batch_id_unique" UNIQUE("sender_batch_id"),
	CONSTRAINT "payout_batches_provider_batch_id_unique" UNIQUE("provider_batch_id")
);
--> statement-breakpoint
CREATE TABLE "payout_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" bigint NOT NULL,
	"award_id" bigint NOT NULL,
	"gh_id" bigint NOT NULL,
	"amount_cents" integer NOT NULL,
	"sender_item_id" text NOT NULL,
	"destination_enc" text NOT NULL,
	"connection_version" integer NOT NULL,
	"provider_item_id" text,
	"status" text DEFAULT 'RESERVED' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_items_sender_item_id_unique" UNIQUE("sender_item_id"),
	CONSTRAINT "payout_items_provider_item_id_unique" UNIQUE("provider_item_id"),
	CONSTRAINT "payout_item_amount_check" CHECK ("payout_items"."amount_cents">0)
);
--> statement-breakpoint
ALTER TABLE "payout_batches" ADD CONSTRAINT "payout_batches_award_id_awards_id_fk" FOREIGN KEY ("award_id") REFERENCES "awards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_batch_id_payout_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "payout_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_award_id_awards_id_fk" FOREIGN KEY ("award_id") REFERENCES "awards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_payout_per_award_recipient" ON "payout_items" USING btree ("award_id","gh_id");