ALTER TABLE chain_transfers ADD COLUMN supersedes_id text UNIQUE REFERENCES chain_transfers(id);
--> statement-breakpoint
ALTER TABLE chain_transfers DROP CONSTRAINT chain_transfers_status_check;
--> statement-breakpoint
ALTER TABLE chain_transfers ADD CONSTRAINT chain_transfers_status_check CHECK(status IN ('RESERVED','SIGNED','SUCCESS','HOLD','EXPIRED'));
--> statement-breakpoint
ALTER TABLE chain_transfers ADD CONSTRAINT chain_expired_unsigned CHECK(status<>'EXPIRED' OR (kind='funding' AND signature IS NULL AND message IS NOT NULL));
--> statement-breakpoint
DROP INDEX chain_one_funding;
--> statement-breakpoint
CREATE UNIQUE INDEX chain_one_funding ON chain_transfers(bounty_id) WHERE kind='funding' AND status<>'EXPIRED';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_chain_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Chain transfer history cannot be deleted'; END IF;
 IF OLD.status='EXPIRED' THEN RAISE EXCEPTION 'Expired preparation is immutable'; END IF;
 IF NEW.status='EXPIRED' AND (OLD.kind<>'funding' OR OLD.status<>'RESERVED' OR OLD.signature IS NOT NULL OR OLD.message IS NULL OR NEW.signature IS NOT NULL OR NEW.wire IS DISTINCT FROM OLD.wire) THEN RAISE EXCEPTION 'Only unsigned funding preparations can expire'; END IF;
 IF NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id THEN RAISE EXCEPTION 'Attempt lineage is immutable'; END IF;
 IF (NEW.bounty_id,NEW.kind,NEW.award_id,NEW.gh_id,NEW.wallet_version,NEW.source,NEW.destination,NEW.amount,NEW.terms,NEW.request_id,NEW.evidence_version,NEW.bounty_version)
 IS DISTINCT FROM (OLD.bounty_id,OLD.kind,OLD.award_id,OLD.gh_id,OLD.wallet_version,OLD.source,OLD.destination,OLD.amount,OLD.terms,OLD.request_id,OLD.evidence_version,OLD.bounty_version)
 OR (OLD.message IS NOT NULL AND (NEW.message,NEW.last_valid_block_height) IS DISTINCT FROM (OLD.message,OLD.last_valid_block_height))
 OR (OLD.signature IS NOT NULL AND (NEW.signature,NEW.wire) IS DISTINCT FROM (OLD.signature,OLD.wire)) THEN
 RAISE EXCEPTION 'Chain transfer identity is immutable';
 END IF;
 RETURN NEW;
END; $$;
