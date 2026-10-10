BEGIN;
CREATE TABLE IF NOT EXISTS arbi_usage_windows (
  id bigserial PRIMARY KEY, environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  observation_id text NOT NULL, stream text NOT NULL, sequence numeric(20,0) NOT NULL, domain text NOT NULL,
  link_id text NOT NULL, start_ms bigint NOT NULL, end_ms bigint NOT NULL, received_at_ms bigint NOT NULL,
  fingerprint text NOT NULL, record jsonb NOT NULL,
  UNIQUE(environment,namespace_id,site_id,observation_id), UNIQUE(environment,namespace_id,site_id,stream,sequence)
);
CREATE INDEX IF NOT EXISTS arbi_usage_range ON arbi_usage_windows(environment,namespace_id,site_id,link_id,start_ms,end_ms);
CREATE INDEX IF NOT EXISTS arbi_usage_domain ON arbi_usage_windows(environment,namespace_id,site_id,domain,start_ms,end_ms);
CREATE TABLE IF NOT EXISTS arbi_usage_corrections (
  environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL, observation_id text NOT NULL,
  request_key text NOT NULL, actor_id text NOT NULL, reason_id text NOT NULL, audit_id text NOT NULL REFERENCES arbi_audit_events(id), at_ms bigint NOT NULL,
  PRIMARY KEY(environment,namespace_id,site_id,observation_id), UNIQUE(environment,namespace_id,site_id,actor_id,request_key)
);
CREATE TABLE IF NOT EXISTS arbi_usage_budgets (
  environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL, kind text NOT NULL,
  minute_ms bigint NOT NULL, attempts integer NOT NULL,
  PRIMARY KEY(environment,namespace_id,site_id,kind)
);
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['arbi_usage_windows','arbi_usage_corrections'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname=tab||'_immutable' AND tgrelid=tab::regclass) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE OR TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION arbi_audit_immutable()',tab||'_immutable',tab);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON arbi_usage_windows,arbi_usage_corrections,arbi_usage_budgets FROM PUBLIC;
COMMIT;
