-- Cloud-only protected state. Clients have no direct database access.
-- Immutable realm/site primary key serializes each installation's transitions.
CREATE TABLE IF NOT EXISTS arbi_device_registry (
  environment text NOT NULL CHECK (environment IN ('test', 'preview')),
  namespace_id text NOT NULL,
  site_id text NOT NULL,
  state jsonb NOT NULL CHECK (state->>'version' = 'arbi.enrollment/1.0'),
  PRIMARY KEY (environment, namespace_id, site_id)
);
CREATE TABLE IF NOT EXISTS arbi_device_audit (
  id uuid PRIMARY KEY,
  environment text NOT NULL CHECK (environment IN ('test', 'preview')),
  namespace_id text NOT NULL,
  site_id text NOT NULL,
  record jsonb NOT NULL,
  FOREIGN KEY (environment, namespace_id, site_id)
    REFERENCES arbi_device_registry (environment, namespace_id, site_id)
);
