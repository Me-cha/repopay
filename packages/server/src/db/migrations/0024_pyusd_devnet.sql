ALTER TABLE bounties DROP CONSTRAINT bounty_amount_check;
--> statement-breakpoint
ALTER TABLE bounties ADD CONSTRAINT bounty_amount_check CHECK (amount_cents>0 AND currency IN ('USD','PYUSD'));
--> statement-breakpoint
ALTER TABLE bounties ADD COLUMN chain_funding_id text, ADD COLUMN chain_funding_signature text;
--> statement-breakpoint
CREATE TABLE chain_wallets (gh_id bigint PRIMARY KEY, address text NOT NULL, version integer NOT NULL DEFAULT 1 CHECK(version>0), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE TABLE chain_challenges (id text PRIMARY KEY, session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, gh_id bigint NOT NULL, address text NOT NULL, message text NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz);
--> statement-breakpoint
CREATE TABLE chain_transfers (
 id text PRIMARY KEY, bounty_id bigint NOT NULL REFERENCES bounties(id), kind text NOT NULL CHECK(kind IN ('funding','payout','refund')),
 request_id bigint REFERENCES cancellation_requests(id),evidence_version integer,bounty_version integer,
 award_id bigint REFERENCES awards(id), gh_id bigint NOT NULL, wallet_version integer NOT NULL CHECK(wallet_version>0),
 source text NOT NULL, destination text NOT NULL, amount integer NOT NULL CHECK(amount>0), terms jsonb NOT NULL,
 message text, wire text, signature text UNIQUE, last_valid_block_height integer,
 status text NOT NULL DEFAULT 'RESERVED' CHECK(status IN ('RESERVED','SIGNED','SUCCESS','HOLD')), attention text,
 next_check_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(source<>destination),CHECK((kind='funding' AND award_id IS NULL AND request_id IS NULL) OR (kind='payout' AND award_id IS NOT NULL AND request_id IS NULL) OR (kind='refund' AND award_id IS NULL AND request_id IS NOT NULL AND evidence_version IS NOT NULL AND bounty_version IS NOT NULL)),
 CHECK(signature IS NULL OR (wire IS NOT NULL AND message IS NOT NULL AND last_valid_block_height IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX chain_one_funding ON chain_transfers(bounty_id) WHERE kind='funding';
--> statement-breakpoint
CREATE UNIQUE INDEX chain_one_payout ON chain_transfers(award_id,gh_id) WHERE kind='payout';
--> statement-breakpoint
CREATE FUNCTION protect_chain_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Chain transfer history cannot be deleted'; END IF;
 IF (NEW.bounty_id,NEW.kind,NEW.award_id,NEW.gh_id,NEW.wallet_version,NEW.source,NEW.destination,NEW.amount,NEW.terms,NEW.request_id,NEW.evidence_version,NEW.bounty_version)
 IS DISTINCT FROM (OLD.bounty_id,OLD.kind,OLD.award_id,OLD.gh_id,OLD.wallet_version,OLD.source,OLD.destination,OLD.amount,OLD.terms,OLD.request_id,OLD.evidence_version,OLD.bounty_version)
 OR (OLD.message IS NOT NULL AND (NEW.message,NEW.last_valid_block_height) IS DISTINCT FROM (OLD.message,OLD.last_valid_block_height))
 OR (OLD.signature IS NOT NULL AND (NEW.signature,NEW.wire) IS DISTINCT FROM (OLD.signature,OLD.wire)) THEN
 RAISE EXCEPTION 'Chain transfer identity is immutable';
 END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER protect_chain_transfer BEFORE UPDATE OR DELETE ON chain_transfers FOR EACH ROW EXECUTE FUNCTION protect_chain_transfer();

--> statement-breakpoint
CREATE UNIQUE INDEX chain_one_refund ON chain_transfers(request_id) WHERE kind='refund';
