CREATE TABLE review_execution_control (
 id integer PRIMARY KEY CHECK (id=1),
 backend text NOT NULL CHECK (backend IN ('shared','dedicated','render')),
 generation integer NOT NULL CHECK (generation>0),
 artifact_version text NOT NULL,
 paused boolean NOT NULL DEFAULT false
);
--> statement-breakpoint
CREATE TABLE review_dispatches (
 id text PRIMARY KEY,
 job_id bigint NOT NULL UNIQUE REFERENCES jobs(id),
 submission_id bigint NOT NULL REFERENCES submissions(id),
 repo_id bigint NOT NULL,
 sponsor_gh_id bigint NOT NULL,
 head_sha text NOT NULL,
 base_sha text NOT NULL,
 force_review boolean NOT NULL DEFAULT false,
 backend text NOT NULL CHECK (backend IN ('dedicated','render')),
 generation integer NOT NULL,
 artifact_version text NOT NULL,
 task_identifier text,
 status text NOT NULL DEFAULT 'READY' CHECK (status IN ('READY','ADMITTED','LAUNCHING','LAUNCH_UNKNOWN','RUNNING_PRE_INFERENCE','INFERENCE_STARTED','RESULT_SAVED','OUTCOME_UNKNOWN','FAILED_BEFORE_INFERENCE','SUPERSEDED')),
 capacity_held boolean NOT NULL DEFAULT false,
 run_id text UNIQUE,
 owner_token text,
 heartbeat_until timestamptz,
 launch_started_at timestamptz,
 next_launch_at timestamptz NOT NULL DEFAULT now(),
 inference_started_at timestamptz,
 allowance_date date,
 verification_id bigint UNIQUE REFERENCES verifications(id),
 evidence_version integer,
 sponsor_generation integer,
 input jsonb,
 error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 CHECK (inference_started_at IS NULL OR allowance_date IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX review_dispatches_ready ON review_dispatches(status,created_at);
--> statement-breakpoint
CREATE UNIQUE INDEX review_capacity_sponsor ON review_dispatches(sponsor_gh_id) WHERE capacity_held;
--> statement-breakpoint
CREATE UNIQUE INDEX review_capacity_submission ON review_dispatches(submission_id) WHERE capacity_held;
--> statement-breakpoint
ALTER TABLE verification_publications ADD COLUMN create_started_at timestamptz;
