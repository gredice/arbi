# Durable usage windows and billing-period reports

Work record: [#35](https://github.com/gredice/arbi/issues/35). This implements the
simulation-only cloud ingestion/report boundary under [ADR-0005](../decisions/0005-software-architecture-and-deployment.md),
using [accounting 1.0](mobile-data-accounting.md) and the
[device collectors](device-traffic-metering.md). [Host evidence](../evidence/usage-rollups.md)
is separate from actual SIM/router/provider reconciliation and physical acceptance.

## Installation and authority

The [server](../../apps/arbi-dashboard/src/usage/server.ts) composes current
Gredice identity, site/account resolution and the existing inventory-first PostgreSQL
transaction boundary. Explicitly install it with
[configureUsage](../../apps/arbi-dashboard/src/usage/runtime.ts). An ordinary build/start
returns a redacted 503. Branch previews never inherit this runtime. Production realms,
hardware observations and body-supplied authority are rejected.

Apply [0007-usage.sql](../../apps/arbi-dashboard/migrations/0007-usage.sql) after
0001–0004 using `pnpm --filter @arbi/dashboard db:migrate:usage` with privately supplied
`ARBI_USAGE_DATABASE_URL`. No build or startup migrates a database. The migration revokes
PUBLIC permissions; provision a separate application role with SELECT/INSERT on windows
and corrections, sequence usage and SELECT/INSERT/UPDATE on budgets, plus the existing
registry/job/audit permissions. Keep ownership and migration permissions outside that role.
Triggers deny source/correction UPDATE, DELETE and TRUNCATE, including accidental owner DML.
Privileged database owners can defeat these controls; independent backups/checkpoints
remain required. No automatic source expiry is implemented: capacity exhaustion denies
new admission rather than erasing evidence. Retention policy belongs to #36/#47.

## HTTP inputs

Mounted path: `/api/sites/:siteId/usage/:action`. All responses use `private, no-store`.

| Action | Method and authority | Input |
| --- | --- | --- |
| `device` | POST; enrolled edge Ed25519 proof, no browser Origin/Authorization | Version `arbi.usage-device/1.0`, realm, siteId, deviceId, credentialId, current identity, issuedAtMs/expiresAtMs, action `ingest`, payload and signature |
| `history` | GET; current `history.read` | Exactly linkId, fromMs, toMs; half-open UTC interval |
| `period` | POST; current `history.read` and browser-origin checks | Exactly plan (accounting MobilePlan), atMs, previousUnusedBaseBytes (decimal string or null) |
| `correct` | POST; current `configuration.write` and browser-origin checks | Exactly key, observationId, reasonId; opaque reason record identity, no private text |

Device payload is an array of 1–32 `{sequence, observation}` windows. The unsigned
envelope uses the existing [device proof](../../apps/arbi-dashboard/src/enrollment/crypto.ts)
canonical digest. Envelope validity is at most ten seconds. Source observations must
identify the same site/realm and an exact current or retained retired identity of that
enrolled collector. This permits old boot windows to upload through its current valid
credential without adopting an unknown boot. Revocation prevents all new admissions.
Intervals/observation times cannot be in the future beyond the 100 ms clock margin.

## Replay, overlap and correction

Window identities retain site, collector/interface link, boot/session, counter epoch,
layer, direction, scope, classifier and sequence. Observation ID and stream/sequence
are unique. Identical replay succeeds once; altered content or a different ID for the
same sequence conflicts. Inventory locks serialize independent processes. A batch
commits atomically; one conflict rolls back all new rows.

Boundary totals have one canonical collection point per site/link/boundary/layer/direction.
Intersecting total windows conflict even across collector boots or counter epochs;
adjacent half-open windows are accepted. Do not submit duplicate router/tunnel views.
Attributed windows conflict within the same collector/epoch/classifier/device/category
partition. Independent transfer epochs can overlap in time because concurrent attempts
carry distinct bytes. Classifier revisions remain separate comparisons and are never
added together. Ingestion must not disguise the same attempt under a new epoch.

Corrections append an invalidation linked to a durable `configuration.change` intent
and authorization in the same transaction. The correction row is the durable service
receipt; the existing audit vocabulary does not label a cloud receipt as a successful
physical configuration change. The original bytes, fingerprint and
sequence remain immutable. The reason ID names an operator-controlled explanation;
it is not a fabricated sensor measurement. A current collector can then submit a
new corrected observation/sequence. Retry of the same operator key returns the same
audit ID; conflicting keys/content fail. Audit failure rolls back the invalidation.
Search reads retain the invalidation/source history in the database; excluded observations
no longer contribute to usage. This privileged lifecycle is distinct from rewriting history.

## Reporting and uncertainty

Reports aggregate direction, boundary, layer, scope, device, category and classifier
separately, retaining exact decimal BigInt byte totals. Never add application, interface
and provider layers, or boundary totals and classified parts. LAN, relay and viewer
traffic remain separate from garden-SIM consumption. ViewerCount is never a multiplier.
Comparisons show classified and residual/unattributed bytes; over-classification is
inconsistent with a null residual. Every source window and receiver time is included
so the reported quantity can be reconstructed. Source epochs, collectors and component
coverage remain visible; freshness does not erase historical bytes.

Daily buckets explicitly use **UTC days**. Monthly periods use the supplied plan's
IANA timezone and anchor/DST policy, and disclose the runtime timezone database version.
Late reports contribute to their original day/period, not their ingestion day.
Splitting a source interval uses cumulative integer time-proportional allocation:
adjacent slices conserve every byte, and affected results are **estimated**. This does
not establish the actual traffic timing within that interval. Measured totals require
whole-window evidence. Missing windows, resets, unavailable values and unknown coverage
remain explicit; unavailable counters do not become zero. Gap output retains the first
32 ranges and indicates truncation. Application estimates never become carrier billing
truth, and even provider reports are labeled provider-reported rather than invoiced.

Plan and prior unused base are caller-supplied assumptions at this stage. Capped rollover
uses only the previous cycle's unused base once; unknown carry stays null. Remaining
allowance is unavailable for incomplete/stale chosen-layer evidence. Historical periods
stop at their end; the current period evaluates coverage only through the report time.
Settings persistence/alerts belong to #55 and local budget reservations to #45.

## Bounds and validation

Body: 60,000 bytes; batch: 32 windows; stored source: 100,000 rows/site, including
invalidated records. Queries: 35 days, 4,096 windows, 256 grouped partitions, 8 MiB report.
Requests: 120 ingestion / 60 read admissions per site/minute. Database statements time
out after 1.5 seconds, lock acquisition after one second. Exceeding a bound is an explicit
capacity error; a report never silently truncates totals. Narrow the requested interval
when a query exceeds its limit. No local stopping depends on this API or its database.

```sh
pnpm --filter @arbi/dashboard lint
pnpm --filter @arbi/dashboard typecheck
pnpm --filter @arbi/dashboard test
pnpm --filter @arbi/dashboard test:postgres
pnpm --filter @arbi/dashboard build
pnpm docs:check
git diff --check
```

The [embedded tests](../../apps/arbi-dashboard/src/usage/usage.test.ts) exercise real SQL,
but skip durable audit paths because PGlite has fsync off. The
[native suite](../../apps/arbi-dashboard/src/usage/postgres.test.ts) runs all cases plus
independent-connection concurrency and injected correction/audit rollback. These are
source/host facts, not live provider, storage-power-loss or physical validation.
