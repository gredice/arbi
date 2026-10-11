-- Owner-managed restoration barrier. The app receives SELECT only; it cannot
-- release quarantine, create recovery receipts or bypass the transaction gate.
CREATE TABLE IF NOT EXISTS arbi_operations_gate (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  state text NOT NULL CHECK(state IN ('ready','quarantined')),
  generation text NOT NULL, changed_at_ms bigint NOT NULL,
  recovery_id text
);
INSERT INTO arbi_operations_gate(singleton,state,generation,changed_at_ms)
  VALUES(true,'ready',md5(random()::text || clock_timestamp()::text),floor(extract(epoch FROM clock_timestamp())*1000))
  ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS arbi_recovery_runs (
  id text PRIMARY KEY, environment text NOT NULL, namespace_id text NOT NULL,
  site_id text NOT NULL, record jsonb NOT NULL CHECK(octet_length(record::text)<=16384)
);
DROP TRIGGER IF EXISTS arbi_recovery_runs_no_update ON arbi_recovery_runs;
CREATE TRIGGER arbi_recovery_runs_no_update BEFORE UPDATE OR DELETE ON arbi_recovery_runs
  FOR EACH ROW EXECUTE FUNCTION arbi_audit_immutable();
REVOKE ALL ON arbi_operations_gate,arbi_recovery_runs FROM PUBLIC;
DROP TRIGGER IF EXISTS arbi_recovery_runs_no_truncate ON arbi_recovery_runs;
CREATE TRIGGER arbi_recovery_runs_no_truncate BEFORE TRUNCATE ON arbi_recovery_runs
  FOR EACH STATEMENT EXECUTE FUNCTION arbi_audit_immutable();
-- Narrow read/lock function lets application roles hold the barrier without
-- UPDATE permission on the owner-managed state column.
CREATE OR REPLACE FUNCTION arbi_operations_ready() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE gate_state text;
BEGIN
  SELECT state INTO gate_state FROM public.arbi_operations_gate WHERE singleton=true FOR SHARE;
  RETURN coalesce(gate_state='ready',false);
END $$;
REVOKE ALL ON FUNCTION arbi_operations_ready() FROM PUBLIC;
