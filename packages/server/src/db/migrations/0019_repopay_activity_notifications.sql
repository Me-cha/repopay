CREATE OR REPLACE FUNCTION notify_bounty_activity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_notify('repopay_activity',TG_TABLE_SCHEMA);
 RETURN NEW;
END $$;
