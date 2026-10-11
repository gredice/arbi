# Capture custody, retention and recovery

Work record: [#61](https://github.com/gredice/arbi/issues/61), [ADR-0035](../decisions/0035-native-capture-custody-and-recovery.md), [evidence](../evidence/capture-transfer.md).

[CaptureTransfer](../../apps/arbi-pod-firmware/src/capture-transfer.ts) consumes the actual [CaptureStore](../../apps/arbi-pod-firmware/src/capture-store.ts), `ApplicationMeter`, current pod identity, trusted current edge/key, local authorization and an explicit authenticated transport seam. [CaptureReceiver](../../apps/arbi-edge-controller/src/images/capture-receiver.ts) owns native edge bytes/metadata. Both use [the private Node contract](../../packages/arbi-protocol/src/capture-transfer.ts). Production apps do not import their sibling; test/crash/benchmark drivers build both through the existing pod test dependency.

## Native storage and transfer

The closed, bounded simulation manifest preserves raw identity/SHA/size/dimensions, original command/correlation/target/fingerprint and capture metadata. Current peer epoch differs from historical capture epoch: reboot can resume existing bytes without replaying camera commands. Credentials/free paths/URLs are rejected. The injected transport independently authenticates current peers; normal TLS admission still supports only `state.resync`.

Edge reserves expected capacity before data. Chunks require exact manifest digest, contiguous offset, 1–65,536 bytes and actual SHA. Duplicate offsets must match persisted bytes. Writes/fsync precede SQLite offset acknowledgement. Recovery truncates an uncommitted suffix, resumes a committed prefix, promotes a verified rename or exposes corruption/incomplete data. Full digest/PNG verification precedes rename/directory-fsync/native owner commit.

Only committed ownership earns an Ed25519 `arbi.capture-owner/1.0` receipt binding original manifest/image/scope, stable storage ID and current edge epoch. The pod verifies its configured key/current peer and persists receipt before retention. Receipt loss keeps raw bytes and repeats owner inspection safely. `releaseAcknowledged` separately persists intent, unlinks/fsyncs and commits released state. Restart finishes acknowledged intents. Command/metadata tombstones remain; `RAW_IMAGE_TRANSFERRED` never triggers a retake.

## Bounds and accounting

| Resource | Source bound |
| --- | --- |
| PNG | 8 MiB, RGB8 noninterlaced, at most 512×512 |
| Pod/edge payload reservations | At most 64 MiB each; failed/incomplete intents count |
| Capture/ownership rows | 128 each; no unacknowledged eviction or tombstone recycling |
| Databases | Each at most 2,048 SQLite pages/8 MiB, with separate native owner lock |
| Manifest | 32 KiB, bounded metadata depth/nodes/strings |
| LAN step | One chunk, default 65,536 bytes; default 262,144 bytes/sec, maximum 1 MiB/sec |
| Attempts/backoff | Durable maximum 512; initial 100 ms, exponential capped at 5,000 ms |
| IO | Default 500 ms per boundary, maximum 1,000 ms; timeout quarantines owner |
| Cursor flush | At most 8 audit + 8 usage + 8 diagnostics; 1,000 ms admission budget plus at most one per-send timeout (maximum 1,000 ms) |
| Edge cursor retention | 512 rows/2 MiB bodies within the same database; full refuses custody |

Payload, database and traffic spool budgets are separate; payload quota is not filesystem capacity. Receipt exhaustion requires a separately reviewed epoch/retention policy rather than deleting history. Policies must allow the largest accepted store image to complete within the cumulative durable attempt bound. Rate deferrals precede handshake/attempt reservation and consume no attempt; actual progress never resets attempts. Higher priority work defers media without affecting local stops. `stopAndDrain` prevents retained IO racing store closure. A dishonest transport ignoring abort is quarantined; a fresh composition must invalidate old grants before retrying.

Each submitted payload is a fresh LAN application usage attempt with retries included. Duplicate submitted payload remains counted while original identity/ownership remain deduplicated. Handshake/metadata/TLS/Wi-Fi/router/provider overhead is unavailable in this harness. LAN transfer never calls WAN `TransferBudget`, consumes mobile allowance or claims upload success. `logicalBytes` is returned once on new acknowledged custody; retry responses return zero. Durable receipt inspection recovers acknowledgement loss without another transfer debit.

## Cursor recovery and supervisor

[PodCursorRecovery](../../apps/arbi-pod-firmware/src/cursor-recovery.ts) hands off historical audit first, then usage and informational diagnostics. Signatures bind kind/ID/content digest/current edge and declared ingest clock. Audit needs an explicitly supplied bounded clock; none is fabricated. Only verified exact prefix receipts compact pod spools. Old epochs/actors/clock-uncertain/crashed/gapped fields remain unchanged. Informational command diagnostics never become authorization or effect evidence. Edge `pendingCursors` supports later forwarding; `wanDelivery=not-delivered` and `cloudCommitted=false` remain explicit.

Trusted `PodRuntime.connectCaptureTransfer` binds source/store scope and `connectRecovery` binds actual initialized spools. Neither sends by default or changes supported commands. Stop inhibits/disconnects first, drains owners, then closes camera/spools. Existing supervisor/signal behavior and fresh boot identity remain. Startup never resumes interrupted captures/media automatically.

After dependency builds:

```sh
pnpm --filter @arbi/pod-firmware lint
pnpm --filter @arbi/pod-firmware typecheck
pnpm --filter @arbi/pod-firmware test
node apps/arbi-pod-firmware/scripts/capture-transfer-reference.mjs
pnpm docs:check
git diff --check
```

The reference repersists/transfers/releases 64 tiny fixtures using actual native stores/signatures/accounting. These are not 64 real camera actions or measured Wi-Fi throughput. Full orchestration/cloud forwarding belongs to #66; selected Pi/edge, wireless and power-cut acceptance remain unavailable.
