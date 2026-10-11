# ADR-0036: Isolated capture job and media composition

Status: proposed in the issue #66 PR. Scope: simulation and native host source checks.

## Decision

Compose the existing local job journal and stopped-motion consumer with the pod's
actual gimbal/capture sequencer. The capture adapter returns a job proof only
after the native pod receipt contains a valid captured image. Job intent and
pod command identity remain separate owners. Restart never replays a moving or
uncertain camera operation.

The edge owns a bounded optional WAN stage after signed pod-to-edge custody.
Raw and rectified artifacts keep independent upload states, original metadata,
quality and algorithm/calibration/transform lineage. SQLite intent precedes
file fsync/rename/readback; expiry has its own durable intent and tombstone.
Failed or missing files cannot become successfully retained artifacts.

Use the existing transfer budget for every submitted image chunk and preview
reservation. Inspect cloud identity before retrying a PUT or applying budget
admission. Cloud completion is a verified object outcome; it cannot replace
the original capture, focus or processing result. A protected service resolver
copies a versioned capture trace into the existing PostgreSQL media record.
Only current authorized service actors in the isolated test realm can use this
bridge. Expired pending upload grants may renew that original identity under
current service authority; deleting/deleted records cannot revive.

Preview has one camera owner, short independently checked authority, bounded
frame work and required attributable lifecycle hooks. Grants and returned frame
bytes have different evidence. Existing cloud live-session audit and recording
denial contracts remain their owners.

## Consequences

`CaptureWorkflow` separates synchronous job ticks from discretionary media work.
Stop inhibits jobs and preview first, then drains bounded upload/processing work.
Default runtimes enable none of these adapters. Camera, servo, provider account,
installed WAN transport, selected-device performance and physical commissioning
remain separate gates. No app imports another app in production code; pod and
dashboard integration tests use the already declared independent edge build.

The stage accepts at most 128 capture receipts, 64 MiB of payload and seven days
of retention. Its tombstones are not recycled. Full stores require deliberate
operator handling. Expiring a stage copy does not release the independent edge
custody store. Cloud image IDs and raw/derived IDs have an explicit lineage;
they are not interchangeable.

See [composition and limits](../software/capture-orchestration.md) and
[source evidence](../evidence/capture-orchestration.md).
