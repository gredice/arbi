# ARBI dashboard HTTP boundary

This Next.js app implements the simulation-only [device enrollment and inventory boundary](../../docs/software/device-enrollment.md) for [#21](https://github.com/gredice/arbi/issues/21), and the [image metadata/private storage boundary](../../docs/software/image-storage.md) for [#22](https://github.com/gredice/arbi/issues/22). It contains working HTTP handlers, protected PostgreSQL migrations, identity/proof verification, a Vercel private Blob SDK adapter and lifecycle tests. Dashboard presentation, jobs, notifications, live media and physical device adapters remain separate work.

The mounted route is `/api/sites/:siteId/enrollment/:action`. An unconfigured build returns a redacted `503`; it never installs a fixture identity provider or an in-memory registry by default. Trusted server composition uses [createEnrollmentServer](src/enrollment/server.ts) with the accepted Gredice identity/current directory/resource resolver, approved browser origins and a migrated database, then [configureEnrollment](src/enrollment/runtime.ts). The resource resolver and directory are current server-side adapters, never body-supplied roles or site claims. This initial slice rejects production and hardware scope.

Media routes are `/api/sites/:siteId/media/:action` and `/api/sites/:siteId/images/:imageId/:action`; they also fail closed until explicitly installed via [createMediaServer](src/media/server.ts)/[configureMedia](src/media/runtime.ts). The service provides strict upload metadata, retry-safe direct PUT grants, idempotent verified completion, original/thumbnail access, revocation records and repeatable deletion/cleanup. [Media documentation](../../docs/software/image-storage.md) specifies exact JSON bodies, trusted capture provenance, signed URL expiry/revocation limits, stored-payload accounting, operational cleanup/retention requirements and remaining live gates. Apply [0002-media.sql](migrations/0002-media.sql) explicitly with `pnpm --filter @arbi/dashboard db:migrate:media` and privately supplied `ARBI_MEDIA_DATABASE_URL`; `0001` and its command are unchanged. Provision authoritative media-site bindings separately; never derive ownership from request claims or enable fixture fallbacks.

[postgresDatabase](src/enrollment/store.ts) uses a server-side `pg.Pool` for the selected Neon PostgreSQL boundary. Configure pooled connections with a bounded connection timeout; no provider URL or credential is supplied in this repository. Run the [migration](migrations/0001-enrollment.sql) explicitly via `pnpm --filter @arbi/dashboard db:migrate` with `ARBI_ENROLLMENT_DATABASE_URL` supplied privately. No migration or commissioning happens during build/start. Provision the initial simulated inventory through the protected `simulationRegistry`/`PostgresRegistryStore.provision` server interface using validated configuration and the account from the authoritative site catalog. Existing rows cannot be overwritten by bootstrap.

```sh
pnpm install --frozen-lockfile
pnpm --filter @arbi/protocol build
pnpm --filter @arbi/gredice build
pnpm --filter @arbi/dashboard lint
pnpm --filter @arbi/dashboard typecheck
pnpm --filter @arbi/dashboard test
pnpm --filter @arbi/dashboard test:postgres
pnpm --filter @arbi/dashboard build
pnpm --filter @arbi/dashboard test:http
```

The ordinary suite uses embedded PostgreSQL (PGlite), temporary synthetic configuration, ephemeral device keys and a loopback HTTP Blob fixture that exercises the real SDK without cloud credentials. The separate `test:postgres` requires `pg_config`, `initdb`, `pg_ctl` and local socket/loopback access. It creates/removes its own temporary PostgreSQL cluster, disables TCP listening, and tests independent connections, migration preservation and transaction rollback for enrollment and media. After build, `test:http` starts/stops its own loopback Next.js server and verifies unprovisioned enrollment/media responses stay redacted and fail closed. CI invokes all three. The ordinary suite marks host-specific tests skipped unless the dedicated launcher supplies its isolated socket; this is not a substitute for running `test:postgres`.

`pnpm --filter @arbi/dashboard start` serves a built, fail-closed app. Source tests and local database checks do not establish live Gredice/Neon provisioning, Vercel team deployment, power-loss durability, installed commissioning, safe actuation or physical acceptance. Those gates remain unverified.

## Durable audit foundation

The [audit adapter](src/audit/server.ts) adds signed device ingestion at `/api/sites/:siteId/audit/ingest`, transactional cloud intent/authorization/outbox admission and protected append-only history. It requires explicit server composition with current enrollment and an independently trusted event-ID evidence resolver; missing configuration returns 503. Device ingestion remains simulation-only under current enrollment. Apply additive `0003-audit.sql` after unchanged 0001/0002 with `pnpm --filter @arbi/dashboard db:migrate:audit` and operator-only migration credentials. Never use migration ownership as the application role.

[Audit durability](../../docs/software/audit-durability.md) owns roles, replay/clock/gap semantics, checkpoint/backup threat limits and host evidence. Shared [SQLite local APIs](../../packages/arbi-audit/README.md) remain independent of edge job orchestration. `test:postgres` preserves independent enrollment/media suites and runs native audit tests in a separate database within its fresh socket-only cluster. This does not deploy provider resources, enable recording or clear physical safety gates.
