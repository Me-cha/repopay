-- One explicitly approved local devnet recovery, not a general signed-expiry policy.
-- This migration performs no recovery and creates no replacement or payment.
ALTER TABLE chain_transfers DROP CONSTRAINT chain_expired_unsigned;
--> statement-breakpoint
ALTER TABLE chain_transfers ADD CONSTRAINT chain_expired_scoped CHECK (
 status<>'EXPIRED' OR (kind='funding' AND message IS NOT NULL AND
 (signature IS NULL OR (id='4bb59a11-101f-4649-9e47-c05413f31dee' AND bounty_id=9 AND kind='funding' AND amount=100
 AND signature='2Mr5oBco4iTeQzofjQAokuewjj99vRw6HinxHCoamJ9gBt5fmeRC1GuGZPX8uAzaBZptBcjeSJnenCf7xvGgda6L'
 AND source='AM19gZaXJUvT7UsBFUn8XbXoE5Grga81C8xht6M4UmnM' AND destination='CC6eMUZhcBddPsC1oLwfQHCC2ipTVVtP3Vw1rzpTkVAb'
 AND last_valid_block_height=507901017 AND terms->>'version'='6' AND terms->'chain'->>'network'='solana-devnet'))));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_chain_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE scoped_approval boolean := false;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Chain transfer history cannot be deleted'; END IF;
 IF OLD.status='EXPIRED' THEN RAISE EXCEPTION 'Expired preparation is immutable'; END IF;
 IF NEW.status='EXPIRED' AND OLD.signature IS NOT NULL THEN
  SELECT EXISTS (
   SELECT 1 FROM bounty_activity a JOIN bounties b ON b.id=a.bounty_id
   WHERE a.bounty_id=OLD.bounty_id AND a.action='pyusd_scoped_signed_expiry_approved' AND a.source='operator'
    AND a.created_at>=clock_timestamp()-interval '2 minutes'
    AND a.metadata->>'approval'='call_6d51e3ccebd64fb1a2ddcd3ce220f8ba'
    AND a.metadata->>'transferId'=OLD.id AND a.metadata->>'signature'=OLD.signature
    AND a.metadata->>'wireSha256'=encode(sha256(convert_to(OLD.wire,'UTF8')),'hex')
    AND (a.metadata->>'finalizedHeight')::bigint>OLD.last_valid_block_height
    AND (a.metadata->>'finalizedSlot')::bigint>0
    AND a.metadata->>'genesis'='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
    AND a.metadata->>'blockhashValid'='false' AND a.metadata->>'signatureAbsent'='true' AND a.metadata->>'referenceTransactions'='0'
    AND b.repo_full_name='deepakA18/gitpay-demo-http' AND b.issue_number=21 AND b.currency='PYUSD'
    AND b.status='CAPTURING' AND b.chain_funding_id=OLD.id AND b.chain_funding_signature IS NULL
    AND b.capture_id IS NULL AND b.capture_request_key IS NULL AND NOT b.funding_hold
    AND b.funded_terms=OLD.terms AND b.amount_cents=OLD.amount
    AND NOT EXISTS (SELECT 1 FROM awards WHERE bounty_id=b.id)
    AND NOT EXISTS (SELECT 1 FROM funding_attempts WHERE bounty_id=b.id)
  ) INTO scoped_approval;
 END IF;
 IF NEW.status='EXPIRED' AND NOT (
  (OLD.kind='funding' AND OLD.status='RESERVED' AND OLD.signature IS NULL AND OLD.message IS NOT NULL AND NEW.signature IS NULL AND NEW.wire IS NOT DISTINCT FROM OLD.wire)
  OR (OLD.status='HOLD' AND scoped_approval AND OLD.id='4bb59a11-101f-4649-9e47-c05413f31dee'
      AND NEW.signature IS NOT DISTINCT FROM OLD.signature AND NEW.wire IS NOT DISTINCT FROM OLD.wire)
 ) THEN RAISE EXCEPTION 'Signed expiry requires the exact approved devnet recovery and audit proof'; END IF;
 IF NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id THEN RAISE EXCEPTION 'Attempt lineage is immutable'; END IF;
 IF (NEW.bounty_id,NEW.kind,NEW.award_id,NEW.gh_id,NEW.wallet_version,NEW.source,NEW.destination,NEW.amount,NEW.terms,NEW.request_id,NEW.evidence_version,NEW.bounty_version)
 IS DISTINCT FROM (OLD.bounty_id,OLD.kind,OLD.award_id,OLD.gh_id,OLD.wallet_version,OLD.source,OLD.destination,OLD.amount,OLD.terms,OLD.request_id,OLD.evidence_version,OLD.bounty_version)
 OR (OLD.message IS NOT NULL AND (NEW.message,NEW.last_valid_block_height) IS DISTINCT FROM (OLD.message,OLD.last_valid_block_height))
 OR (OLD.signature IS NOT NULL AND (NEW.signature,NEW.wire) IS DISTINCT FROM (OLD.signature,OLD.wire)) THEN
 RAISE EXCEPTION 'Chain transfer identity is immutable';
 END IF;
 RETURN NEW;
END; $$;
