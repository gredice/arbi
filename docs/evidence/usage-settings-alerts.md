# Usage settings and alerts host evidence

Work record: [#55](https://github.com/gredice/arbi/issues/55). The [implementation contract](../software/usage-settings-alerts.md) describes authority, confidence and reset semantics.

Pure business tests cover the exact threshold crossing and zero allowance, missing provider/remaining values, current bitrate provenance, constant-average projection, gap/stale rejection, cycle-bound carry and strict scope/destination/forecast settings. Native PostgreSQL tests cover immutable configuration revisions, attributable atomic audits, missing meters, signed late windows, concurrent threshold evaluation through independent pools, restart, once-per-period/rule behavior, cycle reset, retained alert history, lost notification acknowledgement and stable deduplication keys, SQL rollback, current revocation, export permission/digest/redaction and denied cross-site/body claims. Migration 0009 is applied twice to the isolated database.

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

The native launcher owns a fresh socket-only PostgreSQL instance, synthetic site/identity keys and fake notification callback; it never connects to an existing database or messaging service. Built ordinary and branch-preview HTTP checks verify that every added route fails closed without explicit composition. Source/host checks do not validate a real SIM bill, external delivery provider, deployed role grants, persistent worker schedule or edge policy application. Those require their owners' separate evidence.
