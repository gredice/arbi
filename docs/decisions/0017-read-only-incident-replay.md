# ADR-0017: Read-only incident bundles and model comparison

- Status: Accepted when merged; proposed until then
- Date: 2026-10-11
- Work record: [#54](https://github.com/gredice/arbi/issues/54), parent [#10](https://github.com/gredice/arbi/issues/10)
- Evidence: [incident replay](../evidence/incident-replay.md)

## Decision

Introduce a bounded portable `arbi.incident/1.0` artifact in the existing simulation core. It contains original protocol, audit and usage envelopes, scoped capture metadata with media omitted, independent recording offsets, configuration/software references, named data/model revisions, parameter uncertainty and evidence references. Raw envelopes use their owning validators. An envelope's declared configuration cannot contradict its known raw command/snapshot/audit revision. Original clocks, units, unavailable samples and sequence identity remain intact.

A self-hash detects content changes; it authenticates neither the recorder nor physical provenance. Both private and redacted timelines explicitly report `declared-unverified` and `self-hash-not-authentication`. There is no actuator adapter, broker publication, command admission, resume or wall-clock dispatch in replay. Pause, speed, seek and advance operate on an owned cursor and return copies. Input limits are 2 MiB, 512 records, a 24-hour recording interval, bounded metadata and plain JSON without accessors or cycles.

Expose optional, explicitly composed site read/export entrypoints. Raw reading requires current human `audit.read`. Export requires a separately scoped `audit.export` resource, POST and the existing origin/request marker. Required authorization evidence must be acknowledged before storage reading. The reader invokes the shared boundary again after reading; revoked or expired authority cannot receive the result. The ordinary runtime is unavailable and branch previews cannot call configured providers.

Redacted exports have a distinct portable schema and replay their remaining timeline. They omit raw command/sensor payloads, coordinates, personal/session identities and media. A private server salt pseudonymizes actors and source identities while useful opaque command/correlation identifiers remain joinable. Redacted artifacts cannot reconstruct omitted values or run a model comparison.

Model comparison pairs predictions with explicit record/metric identities, without interpolation or fitting. Only recorded measured samples qualify. Units must match; unavailable, stale, estimated and commanded values cannot become measurements. Reports name data/model versions, preserve parameter/value/time uncertainty, list exclusions, and give residual bias, RMSE, maximum absolute error and the observed tested range. Synthetic samples remain synthetic evidence even when a protocol fixture labels a sample measured.

## Custody and physical gate

Private storage belongs to the deployment/operator adapter; the HTTP request selects an opaque bundle ID, never a path or remote endpoint. Both reads and exports honor declared expiry. Bench artifacts cannot be served with a future creation time or retention beyond 14 days from artifact creation. Storage deletion/archival remains that adapter's responsibility; denial at expiry does not assert bytes were erased. Committed synthetic fixtures may have a longer declared lifetime and contain no real site data.

No physical bench recording is available in this work. The named synthetic comparison exercises the report and a bounded affine model; it does not calibrate or validate physical motion, tension, camera behavior or target firmware. A real bench comparison remains an explicit missing-evidence gate.
