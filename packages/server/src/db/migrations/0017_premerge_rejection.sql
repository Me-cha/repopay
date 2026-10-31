ALTER TABLE review_decisions ALTER COLUMN merge_sha DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE review_decisions ADD CONSTRAINT approval_requires_merge CHECK(kind <> 'approve' OR merge_sha IS NOT NULL);
--> statement-breakpoint
DROP INDEX one_rejection_per_snapshot;
--> statement-breakpoint
CREATE UNIQUE INDEX one_rejection_per_snapshot ON review_decisions(submission_id,head_sha,base_sha,COALESCE(merge_sha,''),snapshot_hash) WHERE kind='reject';
