-- Additive: 0001/0002 records stay in their original tables and transactions.
CREATE TABLE IF NOT EXISTS arbi_audit_heads (
  environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  ordinal bigint NOT NULL DEFAULT 0, hash text NOT NULL DEFAULT repeat('0',64),
  PRIMARY KEY (environment,namespace_id,site_id)
);
CREATE TABLE IF NOT EXISTS arbi_audit_events (
  id text PRIMARY KEY, environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  ordinal bigint NOT NULL, stream text NOT NULL, sequence numeric(20,0) NOT NULL CHECK(sequence BETWEEN 0 AND 18446744073709551615),
  content_hash text NOT NULL, previous_hash text NOT NULL, hash text NOT NULL,
  record jsonb NOT NULL CHECK ((record->>'auditVersion') IS NOT DISTINCT FROM 'arbi.audit/1.0' AND record->'ingestTime' <> 'null'::jsonb),
  UNIQUE(environment,namespace_id,site_id,ordinal), UNIQUE(stream,sequence)
);
CREATE TABLE IF NOT EXISTS arbi_audit_evidence (
  event_id text PRIMARY KEY REFERENCES arbi_audit_events, detail jsonb NOT NULL
);
-- Immutable notification intent, never an actuator command or dispatch permission.
CREATE TABLE IF NOT EXISTS arbi_audit_outbox (
  id text PRIMARY KEY REFERENCES arbi_audit_events,
  authorization_id text NOT NULL REFERENCES arbi_audit_events
);
CREATE TABLE IF NOT EXISTS arbi_audit_deliveries (
  id text PRIMARY KEY REFERENCES arbi_audit_outbox, received_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION arbi_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'append-only record' USING ERRCODE='42501'; END $$;
-- Triggers protect accidental owner-role DML too; a privileged owner can disable them.
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['arbi_device_audit','arbi_device_lifecycle','arbi_media_audit','arbi_audit_events',
    'arbi_audit_evidence','arbi_audit_outbox','arbi_audit_deliveries'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname=tab||'_immutable' AND tgrelid=tab::regclass) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE OR TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION arbi_audit_immutable()',tab||'_immutable',tab);
    END IF;
  END LOOP;
END $$;
-- Read projection includes historical enrollment/media without backfill or changed receipts.
CREATE OR REPLACE VIEW arbi_audit_history AS
 SELECT 'enrollment'::text AS origin, id::text AS id, environment,namespace_id,site_id,record FROM arbi_device_audit
 UNION ALL SELECT 'media',id::text,environment,namespace_id,site_id,record FROM arbi_media_audit
 UNION ALL SELECT 'durable',id,environment,namespace_id,site_id,record FROM arbi_audit_events;
REVOKE ALL ON arbi_audit_events,arbi_audit_evidence,arbi_audit_outbox,arbi_audit_deliveries,arbi_audit_heads,arbi_audit_history FROM PUBLIC;
