CREATE TABLE contributor_attestations (
 id bigserial PRIMARY KEY, submission_id bigint NOT NULL REFERENCES submissions(id),
 head_sha text NOT NULL, base_sha text NOT NULL, claimant_gh_id bigint NOT NULL,
 claimant_login text NOT NULL, actor_gh_id bigint NOT NULL, kind text NOT NULL,
 reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT attribution_kind CHECK ((kind='claim' AND actor_gh_id=claimant_gh_id) OR (kind='confirm' AND actor_gh_id<>claimant_gh_id)),
 CONSTRAINT attribution_reason CHECK (length(trim(reason)) BETWEEN 10 AND 2000),
 UNIQUE(submission_id,head_sha,base_sha,claimant_gh_id,kind)
);
--> statement-breakpoint
CREATE FUNCTION protect_contributor_attestation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Contributor attestations are immutable'; END $$;
--> statement-breakpoint
CREATE TRIGGER immutable_contributor_attestation BEFORE UPDATE OR DELETE ON contributor_attestations FOR EACH ROW EXECUTE FUNCTION protect_contributor_attestation();
