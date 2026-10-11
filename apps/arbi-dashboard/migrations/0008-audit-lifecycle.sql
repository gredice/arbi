-- Explicit operator migration. No build/start migration or automatic retention sweep.
CREATE TABLE IF NOT EXISTS arbi_audit_query_index (
  ordinal bigserial PRIMARY KEY, origin text NOT NULL, id text NOT NULL,
  environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  received_at timestamptz NOT NULL, UNIQUE(origin,id)
);
CREATE INDEX IF NOT EXISTS arbi_audit_query_scope ON arbi_audit_query_index(environment,namespace_id,site_id,received_at,ordinal);
CREATE OR REPLACE FUNCTION arbi_audit_index_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('arbi-audit-index',NEW.environment,NEW.namespace_id,NEW.site_id)::text,0));
  INSERT INTO public.arbi_audit_query_index(origin,id,environment,namespace_id,site_id,received_at)
  VALUES(CASE TG_TABLE_NAME WHEN 'arbi_device_audit' THEN 'enrollment' WHEN 'arbi_media_audit' THEN 'media' ELSE 'durable' END,
    NEW.id::text,NEW.environment,NEW.namespace_id,NEW.site_id,
    coalesce((NEW.record->'ingestTime'->>'utc')::timestamptz,clock_timestamp())) ON CONFLICT(origin,id) DO NOTHING;
  RETURN NEW;
END $$;
INSERT INTO arbi_audit_query_index(origin,id,environment,namespace_id,site_id,received_at)
 SELECT origin,id,environment,namespace_id,site_id,coalesce((record->'ingestTime'->>'utc')::timestamptz,clock_timestamp())
 FROM arbi_audit_history ORDER BY origin,id ON CONFLICT(origin,id) DO NOTHING;
CREATE TABLE IF NOT EXISTS arbi_audit_retention_policies (
  environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL, class text NOT NULL,
  revision text NOT NULL, created_at_ms bigint NOT NULL, intent_id text NOT NULL REFERENCES arbi_audit_events,
  record jsonb NOT NULL, PRIMARY KEY(environment,namespace_id,site_id,class,revision)
);
CREATE TABLE IF NOT EXISTS arbi_audit_holds (
  id text PRIMARY KEY, environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  class text NOT NULL, target_id text, expires_at_ms bigint NOT NULL, intent_id text NOT NULL REFERENCES arbi_audit_events, record jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS arbi_audit_hold_releases (
  hold_id text PRIMARY KEY REFERENCES arbi_audit_holds, intent_id text NOT NULL REFERENCES arbi_audit_events, released_at_ms bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS arbi_audit_retirements (
  id text PRIMARY KEY, origin text NOT NULL, event_id text NOT NULL, environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  retired_at_ms bigint NOT NULL, intent_id text NOT NULL REFERENCES arbi_audit_events, policy_revision text NOT NULL,
  record_digest text NOT NULL CHECK(record_digest ~ '^[a-f0-9]{64}$'), content_hash text NOT NULL,
  original_ingest_time jsonb, reason text NOT NULL CHECK(reason IN ('retention-expired','operator-delete')),
  UNIQUE(origin,event_id)
);
-- Replace statement UPDATE guards with a narrow row guard; DELETE/TRUNCATE stay forbidden.
CREATE OR REPLACE FUNCTION arbi_audit_payload_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE receipt public.arbi_audit_retirements; origin_name text;
BEGIN
  IF NEW.record IS NOT NULL OR OLD.record IS NULL OR (to_jsonb(NEW)-'record') IS DISTINCT FROM (to_jsonb(OLD)-'record') THEN
    RAISE EXCEPTION 'append-only record' USING ERRCODE='42501';
  END IF;
  origin_name := CASE TG_TABLE_NAME WHEN 'arbi_device_audit' THEN 'enrollment' WHEN 'arbi_media_audit' THEN 'media' ELSE 'durable' END;
  SELECT * INTO receipt FROM public.arbi_audit_retirements WHERE id=current_setting('arbi.retirement_receipt',true)
    AND origin=origin_name AND event_id=OLD.id::text AND environment=OLD.environment AND namespace_id=OLD.namespace_id AND site_id=OLD.site_id;
  IF receipt.id IS NULL THEN RAISE EXCEPTION 'retirement approval required' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION arbi_retire_audit_payload(receipt_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE receipt public.arbi_audit_retirements; tab text; changed bigint;
BEGIN
  SELECT * INTO receipt FROM public.arbi_audit_retirements WHERE id=receipt_id;
  IF receipt.id IS NULL THEN RAISE EXCEPTION 'retirement approval required' USING ERRCODE='42501'; END IF;
  tab := CASE receipt.origin WHEN 'enrollment' THEN 'arbi_device_audit' WHEN 'media' THEN 'arbi_media_audit' WHEN 'durable' THEN 'arbi_audit_events' ELSE NULL END;
  IF tab IS NULL THEN RAISE EXCEPTION 'invalid origin'; END IF;
  PERFORM set_config('arbi.retirement_receipt',receipt.id,true);
  EXECUTE format('UPDATE public.%I SET record=NULL WHERE id::text=$1 AND environment=$2 AND namespace_id=$3 AND site_id=$4 AND record IS NOT NULL',tab)
    USING receipt.event_id,receipt.environment,receipt.namespace_id,receipt.site_id;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'payload absent or already retired' USING ERRCODE='42501'; END IF;
  PERFORM set_config('arbi.retirement_receipt','',true);
END $$;
REVOKE ALL ON FUNCTION arbi_retire_audit_payload(text) FROM PUBLIC;
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['arbi_device_audit','arbi_media_audit','arbi_audit_events'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I',tab||'_immutable',tab);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN record DROP NOT NULL',tab);
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',tab,tab||'_record_check');
    IF tab='arbi_audit_events' THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK(record IS NULL OR ((record->>''auditVersion'') IS NOT DISTINCT FROM ''arbi.audit/1.0'' AND record->''ingestTime'' <> ''null''::jsonb))',tab,tab||'_record_check');
    ELSE
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK(record IS NULL OR (record->>''auditVersion'') IS NOT DISTINCT FROM ''arbi.audit/1.0'')',tab,tab||'_record_check');
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname=tab||'_no_delete') THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE DELETE OR TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION arbi_audit_immutable()',tab||'_no_delete',tab);
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION arbi_audit_payload_guard()',tab||'_payload_guard',tab);
      EXECUTE format('CREATE TRIGGER %I AFTER INSERT ON %I FOR EACH ROW EXECUTE FUNCTION arbi_audit_index_insert()',tab||'_query_index',tab);
    END IF;
  END LOOP;
  FOREACH tab IN ARRAY ARRAY['arbi_audit_query_index','arbi_audit_retention_policies','arbi_audit_holds','arbi_audit_hold_releases','arbi_audit_retirements'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname=tab||'_immutable') THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE OR TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION arbi_audit_immutable()',tab||'_immutable',tab);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON arbi_audit_query_index,arbi_audit_retention_policies,arbi_audit_holds,arbi_audit_hold_releases,arbi_audit_retirements FROM PUBLIC;
-- Provision a separate lifecycle login/pool explicitly. Grant it only the reviewed
-- table privileges and EXECUTE on arbi_retire_audit_payload(text). No ordinary app grant here.
