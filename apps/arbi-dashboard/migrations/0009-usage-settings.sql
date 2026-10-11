BEGIN;
CREATE TABLE IF NOT EXISTS arbi_usage_settings (
  environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL, link_id text NOT NULL,
  revision text NOT NULL, at_ms bigint NOT NULL, audit_id text NOT NULL REFERENCES arbi_audit_events,
  record jsonb NOT NULL, ordinal bigserial UNIQUE, PRIMARY KEY(environment,namespace_id,site_id,link_id,revision)
);
CREATE TABLE IF NOT EXISTS arbi_usage_alerts (
  id text PRIMARY KEY, environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL, link_id text NOT NULL,
  period_start_ms bigint NOT NULL, rule_id text NOT NULL, at_ms bigint NOT NULL, record jsonb NOT NULL,
  UNIQUE(environment,namespace_id,site_id,link_id,period_start_ms,rule_id)
);
CREATE INDEX IF NOT EXISTS arbi_usage_alert_scope ON arbi_usage_alerts(environment,namespace_id,site_id,link_id,period_start_ms);
CREATE TABLE IF NOT EXISTS arbi_usage_alert_deliveries (
  alert_id text NOT NULL REFERENCES arbi_usage_alerts, destination_id text NOT NULL, at_ms bigint NOT NULL,
  PRIMARY KEY(alert_id,destination_id)
);
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['arbi_usage_settings','arbi_usage_alerts','arbi_usage_alert_deliveries'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname=tab||'_immutable' AND tgrelid=tab::regclass) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE OR TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION arbi_audit_immutable()',tab||'_immutable',tab);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON arbi_usage_settings,arbi_usage_alerts,arbi_usage_alert_deliveries FROM PUBLIC;
COMMIT;
