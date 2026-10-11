-- One authority for independently attributed viewers and one desired producer per device.
CREATE TABLE IF NOT EXISTS arbi_live_producers (
  id text PRIMARY KEY, environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL, device_id text NOT NULL,
  record jsonb NOT NULL CHECK(octet_length(record::text)<=8192), UNIQUE(environment,namespace_id,site_id,device_id)
);
CREATE TABLE IF NOT EXISTS arbi_live_viewers (
  id text PRIMARY KEY, environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL, device_id text NOT NULL,
  actor_id text NOT NULL, request_key text NOT NULL, fingerprint text NOT NULL, intent_id text NOT NULL REFERENCES arbi_audit_events,
  producer_id text NOT NULL REFERENCES arbi_live_producers, ended_at_ms bigint, record jsonb NOT NULL CHECK(octet_length(record::text)<=32768),
  UNIQUE(environment,namespace_id,site_id,actor_id,request_key)
);
CREATE INDEX IF NOT EXISTS arbi_live_active ON arbi_live_viewers(environment,namespace_id,site_id,device_id) WHERE ended_at_ms IS NULL;
CREATE TABLE IF NOT EXISTS arbi_live_reports (
  id text PRIMARY KEY, environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL, device_id text NOT NULL,
  fingerprint text NOT NULL, record jsonb NOT NULL CHECK(octet_length(record::text)<=8192)
);
DROP TRIGGER IF EXISTS arbi_live_reports_immutable ON arbi_live_reports;
CREATE TRIGGER arbi_live_reports_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON arbi_live_reports FOR EACH STATEMENT EXECUTE FUNCTION arbi_audit_immutable();
CREATE OR REPLACE FUNCTION arbi_live_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id<>OLD.id OR NEW.environment<>OLD.environment OR NEW.namespace_id<>OLD.namespace_id OR NEW.site_id<>OLD.site_id
    OR NEW.device_id<>OLD.device_id OR NEW.actor_id<>OLD.actor_id OR NEW.request_key<>OLD.request_key OR NEW.fingerprint<>OLD.fingerprint
    OR NEW.intent_id<>OLD.intent_id OR NEW.producer_id<>OLD.producer_id OR NEW.record->'authority' IS DISTINCT FROM OLD.record->'authority'
    OR NEW.record->'target' IS DISTINCT FROM OLD.record->'target' OR NEW.record->'configRevision' IS DISTINCT FROM OLD.record->'configRevision'
    OR NEW.record->'profile' IS DISTINCT FROM OLD.record->'profile' OR NEW.record->'intent' IS DISTINCT FROM OLD.record->'intent'
    OR NEW.record->'createdAtMs' IS DISTINCT FROM OLD.record->'createdAtMs'
    OR NEW.record->'absoluteExpiresAtMs' IS DISTINCT FROM OLD.record->'absoluteExpiresAtMs'
    OR (OLD.ended_at_ms IS NOT NULL AND NEW IS DISTINCT FROM OLD) THEN RAISE EXCEPTION 'immutable live viewer identity or closed session' USING ERRCODE='42501'; END IF;
  IF OLD.record ? 'policyHistory' AND COALESCE((SELECT jsonb_agg(value ORDER BY ordinality) FROM jsonb_array_elements(NEW.record->'policyHistory') WITH ORDINALITY WHERE ordinality<=jsonb_array_length(OLD.record->'policyHistory')),'[]'::jsonb) IS DISTINCT FROM OLD.record->'policyHistory' THEN
    RAISE EXCEPTION 'immutable live policy decision history' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='arbi_live_guard') THEN
    CREATE TRIGGER arbi_live_guard BEFORE UPDATE ON arbi_live_viewers FOR EACH ROW EXECUTE FUNCTION arbi_live_guard();
    CREATE TRIGGER arbi_live_viewers_no_delete BEFORE DELETE OR TRUNCATE ON arbi_live_viewers FOR EACH STATEMENT EXECUTE FUNCTION arbi_audit_immutable();
  END IF;
END $$;
REVOKE ALL ON arbi_live_producers,arbi_live_viewers,arbi_live_reports FROM PUBLIC;
CREATE OR REPLACE FUNCTION arbi_live_retirement_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM arbi_live_viewers WHERE intent_id=NEW.event_id AND ended_at_ms IS NULL) THEN
    RAISE EXCEPTION 'active live viewer requires intent evidence' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION arbi_live_retirement_guard() FROM PUBLIC;
DO $$ BEGIN
  IF to_regclass('arbi_audit_retirements') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='arbi_live_retirement_guard') THEN
    CREATE TRIGGER arbi_live_retirement_guard BEFORE INSERT ON arbi_audit_retirements FOR EACH ROW EXECUTE FUNCTION arbi_live_retirement_guard();
  END IF;
END $$;
