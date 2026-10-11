-- Preserve original signed-URL authority while allowing only issuance progress and revocation.
CREATE OR REPLACE FUNCTION arbi_media_grant_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'retained media grant' USING ERRCODE='42501'; END IF;
  IF NEW.id<>OLD.id OR NEW.image_id<>OLD.image_id OR NEW.record->'id' IS DISTINCT FROM OLD.record->'id' OR NEW.record->'imageId' IS DISTINCT FROM OLD.record->'imageId' OR NEW.record->'actor' IS DISTINCT FROM OLD.record->'actor'
    OR NEW.record->'sessionId' IS DISTINCT FROM OLD.record->'sessionId' OR NEW.record->'membershipRevision' IS DISTINCT FROM OLD.record->'membershipRevision'
    OR NEW.record->'operation' IS DISTINCT FROM OLD.record->'operation' OR NEW.record->'variant' IS DISTINCT FROM OLD.record->'variant'
    OR NEW.record->'expiresAtMs' IS DISTINCT FROM OLD.record->'expiresAtMs' OR NEW.record->'intentEventId' IS DISTINCT FROM OLD.record->'intentEventId'
    OR (OLD.record->>'revoked'='true' AND NEW.record->>'revoked' IS DISTINCT FROM 'true')
    OR (OLD.record->>'issuance' IN ('issued','failed') AND NEW.record->>'issuance' IS DISTINCT FROM OLD.record->>'issuance') THEN
    RAISE EXCEPTION 'immutable media authority' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS arbi_media_grant_guard ON arbi_media_grants;
CREATE TRIGGER arbi_media_grant_guard BEFORE UPDATE ON arbi_media_grants FOR EACH ROW EXECUTE FUNCTION arbi_media_grant_guard();
DROP TRIGGER IF EXISTS arbi_media_grant_no_delete ON arbi_media_grants;
CREATE TRIGGER arbi_media_grant_no_delete BEFORE DELETE OR TRUNCATE ON arbi_media_grants FOR EACH STATEMENT EXECUTE FUNCTION arbi_media_grant_guard();
REVOKE ALL ON FUNCTION arbi_media_grant_guard() FROM PUBLIC;
