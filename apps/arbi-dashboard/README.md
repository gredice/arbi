# ARBI dashboard HTTP boundary

This Next.js app implements the simulation-only [device enrollment and inventory boundary](../../docs/software/device-enrollment.md) for [#21](https://github.com/gredice/arbi/issues/21). It contains working HTTP handlers, a protected PostgreSQL registry/migration, proof verification and lifecycle tests. Dashboard presentation, jobs, notifications, media and physical device adapters remain separate work.

The mounted route is `/api/sites/:siteId/enrollment/:action`. An unconfigured build returns a redacted `503`; it never installs a fixture identity provider or an in-memory registry by default. Trusted server composition uses [createEnrollmentServer](src/enrollment/server.ts) with the accepted Gredice identity/current directory/resource resolver, approved browser origins and a migrated database, then [configureEnrollment](src/enrollment/runtime.ts). The resource resolver and directory are current server-side adapters, never body-supplied roles or site claims. This initial slice rejects production and hardware scope.

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

The ordinary suite uses embedded PostgreSQL (PGlite) and temporary synthetic configuration, with ephemeral device keys generated at test time. The separate `test:postgres` requires `pg_config`, `initdb`, `pg_ctl` and permission to listen on a local filesystem socket. It creates/removes its own temporary PostgreSQL cluster, disables TCP listening, and tests independent connections and transaction rollback. After build, `test:http` starts/stops its own loopback Next.js server and verifies unprovisioned read/commissioning responses stay redacted and fail closed. CI invokes all three. The ordinary suite marks the host-specific test skipped unless the dedicated launcher supplies its isolated socket; this is not a substitute for running `test:postgres`.

`pnpm --filter @arbi/dashboard start` serves a built, fail-closed app. Source tests and local database checks do not establish live Gredice/Neon provisioning, Vercel team deployment, power-loss durability, installed commissioning, safe actuation or physical acceptance. Those gates remain unverified.
