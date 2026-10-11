# Incident replay and model comparison

[ADR-0017](../decisions/0017-read-only-incident-replay.md) defines portable read-only artifacts. The [committed synthetic incident](../../packages/arbi-simulation-core/fixtures/incidents/synthetic-fault.json) retains a requested command, accepted/running/failed receipts, a fault, sequence gaps, a late receipt, a duplicate, original clocks, measured/commanded/unavailable sample labels, audit, usage and capture references. Every row is a recorded fact or claim; replay grants no authority.

Build and inspect from the repository root:

```bash
pnpm --filter @arbi/simulation-core build
pnpm --filter @arbi/simulation-core incident packages/arbi-simulation-core/fixtures/incidents/synthetic-fault.json --interactive
```

The local terminal accepts `play`, `pause`, `speed 2`, `seek 400`, `advance 100` and `status`. Advance takes explicit elapsed milliseconds; it creates no timer, network connection or physical operation. Seeking reconstructs the same immutable prefix after restart. Snapshot headers identify the recorded scope, data/model versions and integrity limitation. Rows retain source/receiver clocks independently from recording offsets. Gaps, late arrivals, duplicates and changed payloads under one identity remain visible; missing channels are never filled with zeros or continuous curves.

Optional protected routes are `GET /api/sites/{siteId}/incidents/read?bundleId={id}` and `POST /api/sites/{siteId}/incidents/export?bundleId={id}`. Export has an empty body and requires the standard `x-arbi-request: 1` marker and configured origin. Raw reads require `audit.read`; export requires `audit.export` on an independently resolved export resource. The deployment supplies a trusted bounded storage reader, mandatory authorization audit adapter and private redaction salt. No fixture, filesystem selector, upload or actuator provider is enabled by default. Reads and exports reject expired artifacts; bench data has a 14-day serving limit. Deployment storage owners apply deletion and approved archival separately.

`exportIncident` omits raw payloads, position/sensor values, media, actors and session identities. It retains opaque useful correlations, timing quality, gaps and typed event summaries; `IncidentReplay` accepts both private and redacted schemas. The export's self-hash detects tampering and provides no source authentication.

`compareIncident` accepts explicit predictions for record IDs and metrics. The [synthetic comparison report](../../packages/arbi-simulation-core/fixtures/incidents/synthetic-comparison.json) names the model source revision, data revision, parameter bounds, residuals and tested voltage range. It uses the actual committed affine plant implementation as the prediction source with a declared synthetic offset. Commanded position and unavailable tension are excluded. No interpolation, fitted parameter, measured physical position or bench validation is inferred. The original declared clocks and uncertainty remain available for interpreting results.
