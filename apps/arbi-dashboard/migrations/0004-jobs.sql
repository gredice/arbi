-- Additive cloud boundary. 0001/0002/0003 remain authoritative and unchanged.
CREATE TABLE IF NOT EXISTS arbi_job_sites (
  environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  fence numeric(20,0) NOT NULL DEFAULT 0 CHECK(fence BETWEEN 0 AND 18446744073709551615),
  sequence numeric(20,0) NOT NULL DEFAULT 0 CHECK(sequence BETWEEN 0 AND 18446744073709551615),
  clock_floor_ms bigint NOT NULL DEFAULT 0,
  PRIMARY KEY(environment,namespace_id,site_id),
  FOREIGN KEY(environment,namespace_id,site_id) REFERENCES arbi_device_registry
);
CREATE TABLE IF NOT EXISTS arbi_control_leases (
  id text PRIMARY KEY, environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  fence numeric(20,0) NOT NULL, actor_id text NOT NULL, session_id text NOT NULL,
  expires_at_ms bigint NOT NULL, ended_at_ms bigint, record jsonb NOT NULL,
  UNIQUE(environment,namespace_id,site_id,fence)
);
CREATE UNIQUE INDEX IF NOT EXISTS arbi_one_control_lease ON arbi_control_leases(environment,namespace_id,site_id) WHERE ended_at_ms IS NULL;
CREATE TABLE IF NOT EXISTS arbi_lease_requests (
  environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  actor_id text NOT NULL, request_key text NOT NULL, fingerprint text NOT NULL, lease_id text NOT NULL REFERENCES arbi_control_leases,
  PRIMARY KEY(environment,namespace_id,site_id,actor_id,request_key)
);
CREATE TABLE IF NOT EXISTS arbi_command_jobs (
  id text PRIMARY KEY, environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  actor_id text NOT NULL, request_key text NOT NULL, fingerprint text NOT NULL,
  intent_id text NOT NULL REFERENCES arbi_audit_outbox,
  expires_at_ms bigint NOT NULL, record jsonb NOT NULL,
  UNIQUE(environment,namespace_id,site_id,actor_id,request_key)
);
CREATE INDEX IF NOT EXISTS arbi_job_pending ON arbi_command_jobs(environment,namespace_id,site_id,expires_at_ms);
CREATE TABLE IF NOT EXISTS arbi_job_receivers (
  environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL, device_id text NOT NULL,
  received_at_ms bigint NOT NULL, record jsonb NOT NULL,
  PRIMARY KEY(environment,namespace_id,site_id,device_id)
);
-- Authentic reports and contradictions are immutable evidence, independent of the mutable projection.
CREATE TABLE IF NOT EXISTS arbi_job_reports (
  id text PRIMARY KEY, environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  stream text NOT NULL, sequence numeric(20,0) NOT NULL, fingerprint text NOT NULL,
  received_at_ms bigint NOT NULL, record jsonb NOT NULL, decision text NOT NULL,
  UNIQUE(stream,sequence)
);
CREATE OR REPLACE FUNCTION arbi_job_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.environment <> OLD.environment OR NEW.namespace_id <> OLD.namespace_id OR NEW.site_id <> OLD.site_id
    OR NEW.actor_id <> OLD.actor_id OR NEW.request_key <> OLD.request_key OR NEW.fingerprint <> OLD.fingerprint
    OR NEW.intent_id <> OLD.intent_id OR NEW.expires_at_ms <> OLD.expires_at_ms
    OR NEW.record->'command' IS DISTINCT FROM OLD.record->'command'
    OR NEW.record->'authority' IS DISTINCT FROM OLD.record->'authority'
    OR NEW.record->'intent' IS DISTINCT FROM OLD.record->'intent'
    OR (OLD.record->'terminal' <> 'null'::jsonb AND NEW.record->'terminal' IS DISTINCT FROM OLD.record->'terminal') THEN
    RAISE EXCEPTION 'immutable job intent or terminal' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION arbi_lease_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.environment <> OLD.environment OR NEW.namespace_id <> OLD.namespace_id OR NEW.site_id <> OLD.site_id
    OR NEW.fence <> OLD.fence OR NEW.actor_id <> OLD.actor_id OR NEW.session_id <> OLD.session_id
    OR NEW.record->'target' IS DISTINCT FROM OLD.record->'target'
    OR NEW.record->'configRevision' IS DISTINCT FROM OLD.record->'configRevision'
    OR NEW.record->'intent' IS DISTINCT FROM OLD.record->'intent'
    OR (OLD.ended_at_ms IS NOT NULL AND NEW IS DISTINCT FROM OLD) THEN
    RAISE EXCEPTION 'immutable lease identity or closed lease' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='arbi_job_guard') THEN
    CREATE TRIGGER arbi_job_guard BEFORE UPDATE ON arbi_command_jobs FOR EACH ROW EXECUTE FUNCTION arbi_job_guard();
    CREATE TRIGGER arbi_job_reports_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON arbi_job_reports FOR EACH STATEMENT EXECUTE FUNCTION arbi_audit_immutable();
    CREATE TRIGGER arbi_lease_requests_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON arbi_lease_requests FOR EACH STATEMENT EXECUTE FUNCTION arbi_audit_immutable();
    CREATE TRIGGER arbi_command_jobs_no_delete BEFORE DELETE OR TRUNCATE ON arbi_command_jobs FOR EACH STATEMENT EXECUTE FUNCTION arbi_audit_immutable();
    CREATE TRIGGER arbi_control_leases_no_delete BEFORE DELETE OR TRUNCATE ON arbi_control_leases FOR EACH STATEMENT EXECUTE FUNCTION arbi_audit_immutable();
    CREATE TRIGGER arbi_lease_guard BEFORE UPDATE ON arbi_control_leases FOR EACH ROW EXECUTE FUNCTION arbi_lease_guard();
  END IF;
END $$;
REVOKE ALL ON arbi_job_sites,arbi_control_leases,arbi_lease_requests,arbi_command_jobs,arbi_job_receivers,arbi_job_reports FROM PUBLIC;
