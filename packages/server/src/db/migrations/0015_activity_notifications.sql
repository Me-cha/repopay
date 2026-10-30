CREATE FUNCTION notify_bounty_activity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_notify('gitpay_activity',TG_TABLE_SCHEMA);
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER bounty_activity_notify AFTER INSERT ON bounty_activity FOR EACH ROW EXECUTE FUNCTION notify_bounty_activity();
