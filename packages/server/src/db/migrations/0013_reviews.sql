CREATE TABLE review_decisions (
 id bigserial PRIMARY KEY,bounty_id bigint NOT NULL REFERENCES bounties(id),submission_id bigint NOT NULL REFERENCES submissions(id),
 kind text NOT NULL CHECK(kind IN ('approve','reject')),actor_gh_id bigint NOT NULL,reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 2000),
 head_sha text NOT NULL,base_sha text NOT NULL,merge_sha text NOT NULL,snapshot_hash text NOT NULL,
 evidence_id bigint NOT NULL REFERENCES submission_evidence(id),verification_id bigint NOT NULL REFERENCES verifications(id),award_id bigint REFERENCES awards(id),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='approve' AND award_id IS NOT NULL) OR (kind='reject' AND award_id IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX one_rejection_per_snapshot ON review_decisions(submission_id,head_sha,base_sha,merge_sha,snapshot_hash) WHERE kind='reject';
--> statement-breakpoint
CREATE FUNCTION guard_review_decision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Review decisions are immutable'; END $$;
--> statement-breakpoint
CREATE TRIGGER immutable_review_decision BEFORE UPDATE OR DELETE ON review_decisions FOR EACH ROW EXECUTE FUNCTION guard_review_decision();

--> statement-breakpoint
ALTER TABLE action_tokens DROP CONSTRAINT action_kind_check;
--> statement-breakpoint
ALTER TABLE action_tokens ADD CONSTRAINT action_kind_check CHECK(action IN ('cancel_draft','fund','approve'));
