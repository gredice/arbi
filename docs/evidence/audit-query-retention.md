# Audit query and retention host evidence

Work record: [#36](https://github.com/gredice/arbi/issues/36). The [implementation contract](../software/audit-query-retention.md) defines the API and privilege split.

The committed dashboard tests cover strict filters/ranges, exact retention cutoff, bounded class policies, native PostgreSQL pagination, later-insert exclusion, HMAC/filter/session binding, legacy missing clocks, current revocation and cross-site denial, POST export authorization/redaction/digest, and exactly one authorization row per successful search/export. They cover holds/release, explicit payload retirement, preserved chain verification, idempotent replay without resurrection, missing privileged composition, atomic rollback on SQL failure and steward revocation, pending notification/job/lease protection, and owner/non-owner mutation denial.

Run from the repository root:

```sh
corepack pnpm --filter @arbi/dashboard lint
corepack pnpm --filter @arbi/dashboard typecheck
corepack pnpm --filter @arbi/dashboard test
corepack pnpm --filter @arbi/dashboard test:postgres
corepack pnpm build --filter=@arbi/dashboard
corepack pnpm --filter @arbi/dashboard test:http
corepack pnpm docs:check
git diff --check
```

The native launcher creates and removes its own socket-only PostgreSQL cluster and generated synthetic identity keys. It never migrates, reads or deletes an existing database. Ordinary tests skip native-only checks unless that isolated launcher supplies its socket. Built HTTP checks exercise the ordinary start and branch preview: query/export/lifecycle routes return redacted `UNAVAILABLE` with no fixture authorization or data. Hardware evidence, hosted Neon role grants, backup erasure and real deployment retention remain outside these source/host checks.
