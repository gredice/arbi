-- Mutable observational data with bounded retention, distinct from immutable audit/job evidence.
CREATE TABLE IF NOT EXISTS arbi_telemetry_heads (
  environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  device_id text NOT NULL, stream text NOT NULL CHECK(stream IN ('telemetry','event')),
  record jsonb NOT NULL CHECK(octet_length(record::text) <= 131072),
  PRIMARY KEY(environment,namespace_id,site_id,device_id,stream),
  FOREIGN KEY(environment,namespace_id,site_id) REFERENCES arbi_device_registry(environment,namespace_id,site_id)
);
CREATE TABLE IF NOT EXISTS arbi_telemetry_history (
  id bigserial PRIMARY KEY,
  environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  tier text NOT NULL CHECK(tier IN ('raw','minute','hour','event','trace')),
  key text NOT NULL, stream_key text NOT NULL, device_id text NOT NULL, config_revision text NOT NULL,
  at_ms bigint NOT NULL, received_at_ms bigint NOT NULL,
  metric text, quality text, fault_id text, severity text, event_type text,
  fingerprint text NOT NULL, record jsonb NOT NULL CHECK(octet_length(record::text) <= 98304),
  UNIQUE(environment,namespace_id,site_id,tier,key),
  FOREIGN KEY(environment,namespace_id,site_id) REFERENCES arbi_device_registry(environment,namespace_id,site_id)
);
CREATE INDEX IF NOT EXISTS arbi_telemetry_history_page ON arbi_telemetry_history(environment,namespace_id,site_id,tier,id DESC);
CREATE INDEX IF NOT EXISTS arbi_telemetry_history_age ON arbi_telemetry_history(environment,namespace_id,site_id,tier,at_ms);
CREATE INDEX IF NOT EXISTS arbi_telemetry_history_stream ON arbi_telemetry_history(environment,namespace_id,site_id,tier,stream_key);
CREATE TABLE IF NOT EXISTS arbi_telemetry_budgets (
  environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  kind text NOT NULL CHECK(kind IN ('ingest','read','trace')),
  window_ms bigint NOT NULL, attempts integer NOT NULL,
  PRIMARY KEY(environment,namespace_id,site_id,kind)
);
DROP TRIGGER IF EXISTS arbi_realtime_telemetry ON arbi_telemetry_heads;
CREATE TRIGGER arbi_realtime_telemetry AFTER INSERT OR UPDATE ON arbi_telemetry_heads
  FOR EACH ROW EXECUTE FUNCTION arbi_realtime_change('state');
REVOKE ALL ON arbi_telemetry_heads,arbi_telemetry_history,arbi_telemetry_budgets,arbi_telemetry_history_id_seq FROM PUBLIC;
