-- Inventory lock is acquired by the existing job/enrollment transactions before
-- these triggers. The head update is transactional, never a sequence allocation.
CREATE TABLE IF NOT EXISTS arbi_realtime_sites (
  environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  epoch text NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
  cursor numeric(20,0) NOT NULL DEFAULT 0 CHECK(cursor BETWEEN 0 AND 18446744073709551615),
  PRIMARY KEY(environment,namespace_id,site_id)
);
CREATE TABLE IF NOT EXISTS arbi_realtime_events (
  environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  cursor numeric(20,0) NOT NULL, kind text NOT NULL,
  PRIMARY KEY(environment,namespace_id,site_id,cursor)
);
CREATE TABLE IF NOT EXISTS arbi_realtime_outbox (
  environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  cursor numeric(20,0) NOT NULL, attempts integer NOT NULL DEFAULT 0,
  next_at_ms bigint NOT NULL DEFAULT 0, pending boolean NOT NULL DEFAULT true,
  PRIMARY KEY(environment,namespace_id,site_id)
);
CREATE TABLE IF NOT EXISTS arbi_realtime_grants (
  id text PRIMARY KEY, environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  client_id text NOT NULL UNIQUE, channel text NOT NULL UNIQUE, record jsonb NOT NULL,
  expires_at_ms bigint NOT NULL, revoked boolean NOT NULL DEFAULT false,
  revoke_pending boolean NOT NULL DEFAULT false, revoke_attempts integer NOT NULL DEFAULT 0,
  next_revoke_ms bigint NOT NULL DEFAULT 0, heartbeat_at_ms bigint NOT NULL,
  acknowledged_cursor numeric(20,0) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS arbi_realtime_grants_site ON arbi_realtime_grants(environment,namespace_id,site_id,expires_at_ms);
CREATE TABLE IF NOT EXISTS arbi_realtime_budgets (
  environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  principal text NOT NULL, window_ms bigint NOT NULL, attempts integer NOT NULL,
  PRIMARY KEY(environment,namespace_id,site_id,principal)
);
CREATE OR REPLACE FUNCTION arbi_realtime_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_cursor numeric(20,0);
BEGIN
  IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
  PERFORM set_config('synchronous_commit','on',true);
  INSERT INTO arbi_realtime_sites(environment,namespace_id,site_id)
    VALUES(NEW.environment,NEW.namespace_id,NEW.site_id) ON CONFLICT DO NOTHING;
  UPDATE arbi_realtime_sites SET cursor=cursor+1
    WHERE environment=NEW.environment AND namespace_id=NEW.namespace_id AND site_id=NEW.site_id
    RETURNING cursor INTO current_cursor;
  INSERT INTO arbi_realtime_events VALUES(NEW.environment,NEW.namespace_id,NEW.site_id,current_cursor,TG_ARGV[0]);
  INSERT INTO arbi_realtime_outbox(environment,namespace_id,site_id,cursor)
    VALUES(NEW.environment,NEW.namespace_id,NEW.site_id,current_cursor)
    ON CONFLICT(environment,namespace_id,site_id) DO UPDATE
      SET cursor=EXCLUDED.cursor,attempts=0,next_at_ms=0,pending=true;
  -- Coalesce notifications, retain a bounded contiguous replay tail. An older
  -- consumer must reset from current authoritative state, never skip silently.
  DELETE FROM arbi_realtime_events WHERE environment=NEW.environment AND namespace_id=NEW.namespace_id
    AND site_id=NEW.site_id AND cursor <= current_cursor-256;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS arbi_realtime_registry ON arbi_device_registry;
CREATE TRIGGER arbi_realtime_registry AFTER INSERT OR UPDATE ON arbi_device_registry
  FOR EACH ROW EXECUTE FUNCTION arbi_realtime_change('inventory');
DROP TRIGGER IF EXISTS arbi_realtime_jobs ON arbi_command_jobs;
CREATE TRIGGER arbi_realtime_jobs AFTER INSERT OR UPDATE ON arbi_command_jobs
  FOR EACH ROW EXECUTE FUNCTION arbi_realtime_change('jobs');
DROP TRIGGER IF EXISTS arbi_realtime_receivers ON arbi_job_receivers;
CREATE TRIGGER arbi_realtime_receivers AFTER INSERT OR UPDATE ON arbi_job_receivers
  FOR EACH ROW EXECUTE FUNCTION arbi_realtime_change('state');
DROP TRIGGER IF EXISTS arbi_realtime_leases ON arbi_control_leases;
CREATE TRIGGER arbi_realtime_leases AFTER INSERT OR UPDATE ON arbi_control_leases
  FOR EACH ROW EXECUTE FUNCTION arbi_realtime_change('lease');
REVOKE ALL ON arbi_realtime_sites,arbi_realtime_events,arbi_realtime_outbox,
  arbi_realtime_grants,arbi_realtime_budgets FROM PUBLIC;
