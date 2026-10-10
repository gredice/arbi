# Usage ingestion and billing-period host evidence

- Date: 2026-10-11
- Work record: [#35](https://github.com/gredice/arbi/issues/35)
- Tested implementation: source and fixtures in this PR; merge commit identifies the revision
- Setup: isolated Linux x86-64 executor; Node 24.19.0, repository-pinned pnpm 11.5.2;
  PGlite 0.5.8 and a temporary socket-only PostgreSQL 18.4 cluster
- Inputs: synthetic identity, Ed25519 keys, counters and plans; no live SIM, provider,
  deployment configuration, private media or production credentials
- Reviewer: automated assertions and PR review; no qualified physical reviewer

## Covered cases

The [usage suite](../../apps/arbi-dashboard/src/usage/test-support.ts) verifies identical
retry, changed sequence/content, intersecting windows, reset epochs, atomic conflicting
batches, late reporting, UTC days, counters above JavaScript's safe-integer range,
unavailable versus zero, layer/partition separation, residual attribution and shared
viewer metadata. Zagreb DST/month boundaries split 101 bytes into estimated 50/51-byte
slices while retaining the original measured window. Rollover distinguishes known
capped carry from unknown carry.

Native tests additionally cover wrong-site/current-authority/proof/origin failures,
audited append-only invalidation, idempotent correction retry, authenticated replacement,
two concurrent duplicate admissions through independent pools, overlapping-admission
conflict and an injected SQL failure proving correction and audit roll back together.
Reports exclude credentials and fail on unsupported query/rate limits.

PGlite does not provide fsync; it skips the two durable authorization/correction cases.
The native suite executes those cases with PostgreSQL durability checks enabled.
CI runs the ordinary and native suite through the dashboard's existing runner.

Local results: dashboard lint/typecheck and build passed; the ordinary dashboard
suite passed 59 tests with 10 explicitly skipped native/durability cases. The native
PostgreSQL suite passed all 28 tests with no skips, including every usage audit case.
Built HTTP checks passed for ordinary starts and branch previews. Documentation links
and whitespace checks passed. The native runtime was supplied in a temporary directory
because the executor had no system PostgreSQL installation; no runtime binary is committed.

## Remaining evidence

Actual interface coverage, carrier rounding/billing, live Gredice/Neon/Vercel integration,
configured history retention/backups, selected-host power-loss durability and installed
operation remain unverified. The bounded query requires a narrower interval if more than
4,096 source windows match; it reports capacity rather than a partial total. No result
certifies carrier invoice parity or clears any local motion/update safety gate.
