# Telemetry history host evidence

The [bounded current/history contract](../software/telemetry-history.md) implements the isolated simulation adapter allowed by [#37](https://github.com/gredice/arbi/issues/37). It uses the merged enrollment, authorization, jobs and realtime foundations and the external PostgreSQL boundary selected by [ADR-0005](../decisions/0005-software-architecture-and-deployment.md).

## Committed executable records

- [Shared telemetry cases](../../apps/arbi-dashboard/src/telemetry/test-support.ts) run against both embedded PostgreSQL and native PostgreSQL: boot/reset/gap/late/replay ordering; preserved zero versus unavailable null; partial-update age; source-clock uncertainty; configuration/capability barriers; fault raise/clear and late detail; trace idempotency, linkage and duration; assembly pagination/redaction; keyset cursor/filter binding and later-admission exclusion; request/range/page budgets; all five tier row caps and raw-to-aggregate persistence.
- Retention predicates execute in both databases at a frozen trusted clock boundary: exactly the age cutoff remains eligible and one millisecond older is deleted. Only the clock read is isolated; row retention, constraints and deletes execute in PostgreSQL.
- [Native checks](../../apps/arbi-dashboard/src/telemetry/postgres.test.ts) add independent connections, concurrent duplicate ingestion counted once, durable state across replacement service instances, injected realtime failure rolling back raw/aggregate/current/replay together, inventory row lock deadlines, and authenticated HTTP handler/proof/origin/query checks against real migrated SQL.
- [Runtime tests](../../apps/arbi-dashboard/src/telemetry/http.test.ts) and the [built Next.js HTTP launcher](../../apps/arbi-dashboard/scripts/test-http.mjs) exercise redacted, uncached unavailable responses on all unconfigured telemetry routes. Additive migration 0006 is applied twice in the database suites.

On 2026-10-10–11 the local implementation was checked with Node 24.13.0, pnpm 11.5.2 and isolated native PostgreSQL 15.19 (Homebrew). The dedicated launcher owns/removes a temporary Unix-socket-only cluster and creates a separate telemetry database. Test identities, signatures, inventories and observations are synthetic; no deployment credentials, real installation data or provider resources are used. CI separately validates the committed source on its pinned Linux environment.

## Limits of this record

These tests establish source behavior and isolated host database/HTTP evidence. They do not establish provider provisioning, ingestion throughput under a commissioned workload, measured mobile bandwidth, power-loss durability or physical sensor accuracy. Live routing/deployment/mobile acceptance remains open under [#29](https://github.com/gredice/arbi/issues/29); this issue explicitly allows its isolated adapter work before live enablement. An operator must provision trusted identity/database composition, runtime grants and hourly idle-site retention maintenance before activation. Motion permission, command execution and all physical commissioning gates remain separate facts.
