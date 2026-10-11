-- Bounded mutable abuse counters; canonical immutable first/closed facts remain in audit_events.
CREATE TABLE IF NOT EXISTS arbi_job_attempts (
  environment text NOT NULL, namespace_id text NOT NULL, site_id text NOT NULL,
  key text NOT NULL CHECK(key='overflow' OR key ~ '^[a-f0-9]{64}$'),
  window_start_ms bigint NOT NULL CHECK(window_start_ms>=0),
  attempt_count integer NOT NULL CHECK(attempt_count BETWEEN 1 AND 1000000000),
  first_event_id text NOT NULL REFERENCES arbi_audit_events(id),
  attempt_class text NOT NULL CHECK(attempt_class IN ('authorization-denied','stale-command','invalid-command','unavailable','other-denied')),
  mixed boolean NOT NULL,
  PRIMARY KEY(environment,namespace_id,site_id,key),
  FOREIGN KEY(environment,namespace_id,site_id) REFERENCES arbi_device_registry,
  CHECK((key='overflow')=mixed)
);
REVOKE ALL ON arbi_job_attempts FROM PUBLIC;

-- Index the bounded timeline page by its durable logical command, without scanning a site's entire history.
CREATE INDEX IF NOT EXISTS arbi_job_timeline_audit ON arbi_audit_events(environment,namespace_id,site_id,(record->'links'->>'commandId'),ordinal);
CREATE INDEX IF NOT EXISTS arbi_job_timeline_reports ON arbi_job_reports(environment,namespace_id,site_id,(record->'body'->>'commandId'),received_at_ms,id);
