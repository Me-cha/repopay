CREATE TABLE "awards" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bounty_id" bigint NOT NULL,
	"submission_id" bigint NOT NULL,
	"evidence_id" bigint NOT NULL,
	"verification_id" bigint NOT NULL,
	"head_sha" text NOT NULL,
	"base_sha" text NOT NULL,
	"merge_sha" text NOT NULL,
	"merged_at" timestamp with time zone NOT NULL,
	"scan_hash" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"allocation" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "awards_bounty_id_unique" UNIQUE("bounty_id"),
	CONSTRAINT "award_amount_check" CHECK ("awards"."amount_cents">0)
);
--> statement-breakpoint
ALTER TABLE "bounties" DROP CONSTRAINT "bounty_status_check";--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "merge_sha" text;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_evidence_id_submission_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "submission_evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_verification_id_verifications_id_fk" FOREIGN KEY ("verification_id") REFERENCES "verifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounty_status_check" CHECK ("bounties"."status" in ('OPEN','CANCELLED','CAPTURING','FUNDED','NEEDS_REVIEW','AWAITING_CLAIM','PAYING','PAID'));--> statement-breakpoint
CREATE FUNCTION guard_award() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allocated bigint; recipients integer; distinct_recipients integer;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Awards are immutable'; END IF;
 IF jsonb_typeof(NEW.allocation) <> 'array' OR jsonb_array_length(NEW.allocation) NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Invalid award allocation'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.allocation) r WHERE r->>'ghId' !~ '^[1-9][0-9]*$' OR r->>'cents' !~ '^[1-9][0-9]*$' OR r->>'login' IS NULL OR r->>'ghId' IS NULL OR r->>'cents' IS NULL) THEN RAISE EXCEPTION 'Invalid award recipient'; END IF;
 SELECT sum((r->>'cents')::bigint),count(*),count(DISTINCT r->>'ghId') INTO allocated,recipients,distinct_recipients FROM jsonb_array_elements(NEW.allocation) r;
 IF allocated <> NEW.amount_cents OR recipients <> distinct_recipients THEN RAISE EXCEPTION 'Award allocation must sum exactly with unique recipients'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER immutable_award BEFORE INSERT OR UPDATE OR DELETE ON awards FOR EACH ROW EXECUTE FUNCTION guard_award();
