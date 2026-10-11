# Usage reports, configurable plans and durable alerts

This implements the isolated prototype scope of [#55](https://github.com/gredice/arbi/issues/55), building on [signed usage windows and rollups](usage-rollups.md) and the separately enforced [edge transfer budgets](transfer-budgets.md). Dashboard rendering belongs to [#57](https://github.com/gredice/arbi/issues/57). The accounting contract, wire version and sensor meanings remain unchanged.

## API and configuration

The existing explicitly composed `createUsageServer` now exposes these routes under `/api/sites/:siteId/usage/`. Ordinary builds and branch previews still have no configured provider or fixture fallback.

| Route | Authority | Purpose |
| --- | --- | --- |
| `GET settings?linkId=...` | Current `history.read` | Latest persisted settings, or explicit unconfigured state |
| `POST settings` | Current `configuration.write` | Append an immutable plan/rule/forecast/transfer-mode revision and atomic configuration audit |
| `POST report` | Current `history.read` | `{linkId, atMs}` selects a billing period, reports consumption and evaluates alert crossings |
| `GET alerts?linkId=...&fromMs=...&toMs=...` | Current `history.read` | Durable alerts whose billing-period start falls in that half-open range |
| `POST export` | Current `audit.export` | Same report input, bounded JSON attachment with schema and canonical SHA-256 digest; no alert evaluation |

All public reads/mutations use the existing durable authorization boundary, exact site/realm/account scope and current session/membership checks. POST requests require an allowed browser Origin, `x-arbi-request: 1` and JSON content type. The protected export resource `{kind: 'audit-export', id: siteId}` must be explicitly resolved by the trusted resource directory. Its site ownership and current `audit.export` permission are rechecked inside the report transaction. Caller role/site/realm claims cannot override these checks. Export integrity is a digest, not a signature.

Settings contain a unique `revision`, validated `arbi-accounting/1.0` mobile plan, up to 16 named alert rules, up to eight notification destinations, explicit forecast assumptions, a cycle-bound carry-forward value or NULL, and `transferMode` (`normal`, `low-data` or `essential-only`). Reusing a revision with different contents conflicts. Latest settings follow serialized database insertion order, so equal timestamps or lexically earlier revision IDs cannot select an older plan. Each edit atomically appends configuration intent/allow and its settings row; SQL failures roll the edit and its audit back together. There are at most 128 immutable settings revisions and 4,096 alert records per site; capacity exhaustion is explicit.

Destination references are only `{id, kind: operator-inbox|external-adapter}`. Emails, phone numbers, URLs, provider keys and private routing data are deliberately absent from public API/storage records. A trusted deployment adapter resolves opaque destination IDs against protected current routing/permission state. The package neither selects a messaging provider nor creates an outbound transport on startup.

Run `pnpm --filter @arbi/dashboard db:migrate:usage-settings` with private operator `ARBI_USAGE_DATABASE_URL` after the existing usage/job/audit migrations. [Migration 0009](../../apps/arbi-dashboard/migrations/0009-usage-settings.sql) creates append-only settings, alert and delivery-receipt tables. It does not provision a plan, destination or worker, migrate on build, or send a notification. Use a non-owner application role with reviewed SELECT/INSERT/sequence privileges; ordinary runtime roles must not disable history triggers.

## Meter confidence, rate and forecast

`arbi.usage-report/1.0` keeps application, WAN interface and provider-reported totals separate. Attribution rows and viewer/session windows describe parts of those boundaries; they are never added to the boundary total or multiplied by viewer count for a shared stream. Original source epochs, window IDs, evidence, reset/coverage markers and timestamps remain available as bounded references. Bytes are decimal strings and calculations use bigint, including threshold ratios and projections.

Used/remaining quota inherits the rollup's completeness and allowance rules. A missing or stale meter, collection gap or unknown rollover cannot silently produce a zero or precise remaining quota. Historical reports use the explicitly selected cycle and latest persisted plan revision, named in the response; operators must inspect that revision when comparing changed tariff assumptions. Provider-reported values remain provider evidence, not reconciliation of the router or application layers, and `carrierBillingTruth` remains false.

Current upload/download bitrate is an interval-average estimate from each layer's latest available boundary window, with its interval and source reference. It is unavailable for stale, unknown or incomplete source windows and never masquerades as instantaneous measurement. Source clock provenance and existing raw reset evidence stay with the underlying usage history.

Forecasts explicitly select a layer, `disabled` or `constant-average` method, and a 1–168 hour lookback. The constant-average projection adds observed cycle usage to the complete, fresh lookback rate multiplied by remaining cycle duration. Missing/partial/stale lookback or cycle coverage yields an unavailable projection. Boundary allocation remains an estimate where it cuts a source window. The response states the window and assumption and makes no price/carrier promise. Carry-forward applies only to its named exact cycle start; another cycle cannot reuse it. A missing capped rollover value leaves allowance unknown.

The stored transfer mode is a configuration reference. Reports explicitly say `edgePolicyApplication: not-observed` until an independently accepted edge adapter supplies application evidence. Saving a cloud setting cannot assert that bytes were throttled, an upload paused or a device applied a policy. The existing edge budget ledger continues to own enforcement; [#51](https://github.com/gredice/arbi/issues/51) owns traffic-class integration and observed application.

## Crossing, reset and delivery semantics

Threshold rules select a meter layer, 1–100,000 basis points of allowance, and either complete coverage or explicit acceptance of partial/estimated totals. The exact ratio crossing is inclusive. An unknown allowance/usage cannot cross a quota threshold. For a zero allowance, positive observed bytes cross and zero bytes do not. Alert records retain layer, quality, coverage, staleness, source window IDs, settings revision and witness time, so an application estimate cannot be confused with carrier billing evidence. Separate metering rules detect unknown/gapped coverage or stale values.

One immutable alert exists per realm/site/link, billing-period start and rule ID. The site registry lock serializes independent readers, settings updates and signed late arrivals; a unique database key also enforces deduplication. Repeated reports, process restart, later evidence, corrected totals and unrelated settings revisions do not retrigger that key. A new billing period naturally resets it. Deliberately using a new rule ID creates a distinct rule; changing destinations or thresholds under an existing rule ID does not reset an already emitted period alert.

Evaluation occurs on authorized `report` requests, including explicit historical-period requests for late data. Export reads do not generate alerts. There is no automatic polling/notification loop in this change. An operator-owned worker may request the desired periods through the same protected reporting seam; source admission alone does not claim notification delivery. Every alert is immediately durable and available through the protected alerts API.

`UsageSettingsStore.deliver` is a bounded trusted-worker seam: at most 32 alert/destination attempts per call, each callback limited to one second. The callback must resolve current destination validity/authority and deduplicate the immutable digest of realm/site/alert/destination. Only a successful acknowledgement appends a delivery receipt. Failure or death after a send but before its receipt can repeat transport delivery under the same key; it cannot create a second logical threshold alert. Concurrent workers also require adapter deduplication. No external notification was sent by these tests or implementation work.

Report/export responses are capped at 8 MiB, source queries retain the existing 4,096-row/35-day bounds and 60-read-per-minute site budget, and alert list queries are capped at 128 rows. Unknown/overflow/provider failure remains visible. Local control and stopping never call this cloud report or notification path. The [host evidence](../evidence/usage-settings-alerts.md) distinguishes source checks from provider and installed-system acceptance.
