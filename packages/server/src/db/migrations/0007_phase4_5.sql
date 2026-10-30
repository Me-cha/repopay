CREATE TABLE "contributors" (
	"gh_id" bigint PRIMARY KEY NOT NULL,
	"gh_login" text NOT NULL,
	"paypal_email_enc" text NOT NULL,
	"connection_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contributors_connection_version_check" CHECK ("contributors"."connection_version">0)
);
--> statement-breakpoint
CREATE TABLE "submission_evidence" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"submission_id" bigint NOT NULL,
	"version" integer NOT NULL,
	"head_sha" text NOT NULL,
	"base_sha" text NOT NULL,
	"tested_sha" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"diff_text" text NOT NULL,
	"input_truncated" boolean NOT NULL,
	"evidence_sufficient" boolean NOT NULL,
	"eligible_authors" jsonb NOT NULL,
	"unverified_authors" jsonb NOT NULL,
	"ci" jsonb NOT NULL,
	"snapshot_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bounty_id" bigint NOT NULL,
	"repo_id" bigint NOT NULL,
	"pr_id" bigint NOT NULL,
	"pr_number" integer NOT NULL,
	"author_gh_id" bigint NOT NULL,
	"author_login" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"head_sha" text NOT NULL,
	"base_sha" text NOT NULL,
	"merged_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evidence_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_status_check" CHECK ("submissions"."status" in ('OPEN','CLOSED','MERGED'))
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"submission_id" bigint NOT NULL,
	"evidence_id" bigint NOT NULL,
	"head_sha" text NOT NULL,
	"attempt" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"result" jsonb,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"sdk_version" text NOT NULL,
	"sponsor_gh_id" bigint NOT NULL,
	"prompt_hash" text NOT NULL,
	"elapsed_ms" integer,
	"error_code" text,
	"check_run_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "verification_status_check" CHECK ("verifications"."status" in ('PENDING','DONE','ERROR'))
);
--> statement-breakpoint
ALTER TABLE "submission_evidence" ADD CONSTRAINT "submission_evidence_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_evidence_id_submission_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "submission_evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "submission_evidence_version_unique" ON "submission_evidence" USING btree ("submission_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_bounty_pr_unique" ON "submissions" USING btree ("bounty_id","pr_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_attempt_unique" ON "verifications" USING btree ("submission_id","head_sha","attempt");