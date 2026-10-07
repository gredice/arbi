-- Independent app-owned media state; 0001 enrollment identities/history remain intact.
CREATE TABLE IF NOT EXISTS arbi_media_sites (
  environment text NOT NULL CHECK (environment IN ('test', 'preview', 'production')),
  namespace_id text NOT NULL, site_id text NOT NULL, site jsonb NOT NULL,
  PRIMARY KEY (environment, namespace_id, site_id)
);
CREATE TABLE IF NOT EXISTS arbi_media_images (
  id uuid PRIMARY KEY, environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  actor_kind text NOT NULL, actor_id text NOT NULL, request_id text NOT NULL,
  record jsonb NOT NULL CHECK ((record->>'version') IS NOT DISTINCT FROM 'arbi.media/1.0'),
  UNIQUE (environment, namespace_id, site_id, actor_kind, actor_id, request_id),
  FOREIGN KEY (environment, namespace_id, site_id) REFERENCES arbi_media_sites
);
CREATE TABLE IF NOT EXISTS arbi_media_grants (
  id uuid PRIMARY KEY, image_id uuid NOT NULL REFERENCES arbi_media_images, record jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS arbi_media_audit (
  id uuid PRIMARY KEY, environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  record jsonb NOT NULL CHECK ((record->>'auditVersion') IS NOT DISTINCT FROM 'arbi.audit/1.0'),
  detail jsonb NOT NULL,
  FOREIGN KEY (environment, namespace_id, site_id) REFERENCES arbi_media_sites
);
CREATE INDEX IF NOT EXISTS arbi_media_images_scope ON arbi_media_images (environment, namespace_id, site_id, id);
CREATE INDEX IF NOT EXISTS arbi_media_grants_image ON arbi_media_grants (image_id);
