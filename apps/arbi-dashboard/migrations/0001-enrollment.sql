-- Cloud-only protected state. Clients have no direct database access.
-- Immutable realm/site primary key serializes each installation's transitions.
CREATE TABLE IF NOT EXISTS arbi_device_registry (
  environment text NOT NULL CHECK (environment IN ('test', 'preview')),
  namespace_id text NOT NULL,
  site_id text NOT NULL,
  state jsonb NOT NULL CHECK ((state->>'version') IS NOT DISTINCT FROM 'arbi.enrollment/1.0'),
  PRIMARY KEY (environment, namespace_id, site_id)
);
CREATE TABLE IF NOT EXISTS arbi_device_audit (
  id uuid PRIMARY KEY,
  environment text NOT NULL CHECK (environment IN ('test', 'preview')),
  namespace_id text NOT NULL,
  site_id text NOT NULL,
  record jsonb NOT NULL CHECK ((record->>'auditVersion') IS NOT DISTINCT FROM 'arbi.audit/1.0'),
  FOREIGN KEY (environment, namespace_id, site_id)
    REFERENCES arbi_device_registry (environment, namespace_id, site_id)
);
-- App-owned lifecycle detail is kept out of the closed protocol audit metadata.
-- Its ID joins to the accepted audit event, never to a raw request/key/proof.
CREATE TABLE IF NOT EXISTS arbi_device_lifecycle (
  id uuid PRIMARY KEY REFERENCES arbi_device_audit (id),
  record jsonb NOT NULL
);
-- Retained after rotation/revocation/replacement. A key must never serve two identities.
CREATE TABLE IF NOT EXISTS arbi_device_key_bindings (
  fingerprint text PRIMARY KEY CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  environment text NOT NULL,
  namespace_id text NOT NULL,
  site_id text NOT NULL,
  device_id text NOT NULL,
  credential_id text NOT NULL,
  FOREIGN KEY (environment, namespace_id, site_id)
    REFERENCES arbi_device_registry (environment, namespace_id, site_id)
);
