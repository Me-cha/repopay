ALTER TABLE "payout_batches" ADD COLUMN "account_hash" text DEFAULT 'UNBOUND' NOT NULL;
--> statement-breakpoint
ALTER TABLE "payout_batches" ALTER COLUMN "account_hash" DROP DEFAULT;
--> statement-breakpoint
CREATE FUNCTION guard_payout_batch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payout intents cannot be deleted'; END IF;
 IF NEW.award_id<>OLD.award_id OR NEW.sender_batch_id<>OLD.sender_batch_id OR NEW.account_hash<>OLD.account_hash OR (OLD.provider_batch_id IS NOT NULL AND NEW.provider_batch_id IS DISTINCT FROM OLD.provider_batch_id) OR (OLD.submission_boundary_at IS NOT NULL AND (NEW.submission_boundary_at IS DISTINCT FROM OLD.submission_boundary_at OR NEW.safe_retry_until IS DISTINCT FROM OLD.safe_retry_until)) THEN RAISE EXCEPTION 'Payout identity is immutable'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER immutable_payout_batch BEFORE UPDATE OR DELETE ON payout_batches FOR EACH ROW EXECUTE FUNCTION guard_payout_batch();
--> statement-breakpoint
CREATE FUNCTION guard_payout_item() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payout items cannot be deleted'; END IF;
 IF TG_OP='UPDATE' AND (NEW.batch_id<>OLD.batch_id OR NEW.award_id<>OLD.award_id OR NEW.gh_id<>OLD.gh_id OR NEW.amount_cents<>OLD.amount_cents OR NEW.sender_item_id<>OLD.sender_item_id OR NEW.destination_enc<>OLD.destination_enc OR NEW.connection_version<>OLD.connection_version OR (OLD.provider_item_id IS NOT NULL AND NEW.provider_item_id IS DISTINCT FROM OLD.provider_item_id)) THEN RAISE EXCEPTION 'Payout destination and amount are immutable'; END IF;
 IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM awards a JOIN payout_batches b ON b.award_id=a.id WHERE a.id=NEW.award_id AND b.id=NEW.batch_id AND a.allocation @> jsonb_build_array(jsonb_build_object('ghId',NEW.gh_id::text,'cents',NEW.amount_cents))) THEN RAISE EXCEPTION 'Payout item must match committed award'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER immutable_payout_item BEFORE INSERT OR UPDATE OR DELETE ON payout_items FOR EACH ROW EXECUTE FUNCTION guard_payout_item();
