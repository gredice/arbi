-- Dedicated synthetic test directory/session registry only. Never seed real sites here.
CREATE TABLE IF NOT EXISTS arbi_dashboard_sites (
  namespace_id text NOT NULL, site_id text NOT NULL, account_id text NOT NULL,
  name text NOT NULL, PRIMARY KEY (namespace_id, site_id)
);
CREATE TABLE IF NOT EXISTS arbi_dashboard_memberships (
  namespace_id text NOT NULL, site_id text NOT NULL, actor_id text NOT NULL,
  active boolean NOT NULL, revision text NOT NULL, roles jsonb NOT NULL,
  PRIMARY KEY (namespace_id, site_id, actor_id),
  FOREIGN KEY (namespace_id, site_id) REFERENCES arbi_dashboard_sites
);
CREATE TABLE IF NOT EXISTS arbi_dashboard_sessions (
  namespace_id text NOT NULL, id text NOT NULL, actor_id text NOT NULL,
  account_id text NOT NULL, expires_at_ms bigint NOT NULL, revoked boolean NOT NULL DEFAULT false,
  PRIMARY KEY (namespace_id, id)
);
