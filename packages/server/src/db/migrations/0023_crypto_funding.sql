ALTER TABLE funding_attempts ADD COLUMN payment_method text NOT NULL DEFAULT 'paypal';
--> statement-breakpoint
ALTER TABLE funding_attempts ADD COLUMN buyer_name_enc text;
--> statement-breakpoint
ALTER TABLE funding_attempts ADD CONSTRAINT funding_method_check CHECK (
 (payment_method = 'paypal' AND buyer_name_enc IS NULL) OR
 (payment_method = 'crypto' AND buyer_name_enc IS NOT NULL AND terms->'policy'->>'fundedCancellationEnabled' = 'false')
);
--> statement-breakpoint
CREATE FUNCTION protect_funding_method() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.payment_method IS DISTINCT FROM OLD.payment_method OR NEW.buyer_name_enc IS DISTINCT FROM OLD.buyer_name_enc THEN
  RAISE EXCEPTION 'Funding payment method and buyer identity are immutable';
 END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER protect_funding_method BEFORE UPDATE ON funding_attempts FOR EACH ROW EXECUTE FUNCTION protect_funding_method();
