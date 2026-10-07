# Durable local audit

`@arbi/audit` implements a bounded, file-backed SQLite delivery spool for supervised edge and pod Node/Linux runtimes, plus shared canonical hash/receipt primitives consumed by the dashboard ingestion adapter. These are concrete reusable local admission and replay APIs, independent of edge job orchestration. Node >=24 and the pinned pnpm are required. See [durability and evidence](../../docs/software/audit-durability.md).

```ts
import { SqliteAuditSpool } from "@arbi/audit";

const spool = new SqliteAuditSpool({
  path: protectedAbsolutePath, realm, siteId, executionMode, source,
  maxEvents: 2048, maxBytes: 8 * 1024 * 1024, maxPages: 4096,
});
// trustedIntent is a validated arbi.audit/1.0 event from local authorization/context.
spool.admit(trustedIntent); // synchronous durable COMMIT; failure inhibits sensitive work
// Perform the admitted operation through its separately authorized local owner.

// A direct stop callback executes before constructing, validating or writing its record.
const result = spool.localSafetyStop(stopLocally, makeTrustedStopRecord);
const degradation = spool.status();
await spool.replay(sendToAuthenticatedGateway); // durably acknowledged prefix only
const checkpoint = spool.verify();
spool.close();
```

The snippet describes composition, not deployed credentials, a job executor or a real actuator. The uploader must authenticate the gateway and its receipt channel; any object with `durable: true` is insufficient authentication. `admit` accepts intent only; `append` accepts other local audit events. Both require exact configured realm/site/mode/source and reject sender receipts. Boot changes reopen the same spool with the new source epoch; pending old-boot records remain immutable. Emitters own audit sequence allocation and causal/actor/resource authority. Start each boot/session stream at sequence 1, persist intent before discretionary work, and consume a sequence even when recording fails so later receipt exposes the gap. No action is resumed automatically after a process restart.

The SQLite state retains rolling tail and acknowledged-prefix hash checkpoints. Unacknowledged rows cannot be updated. Only an authenticated durable receipt with matching event ID/hash and valid receipt time permits prefix deletion and anchor advancement. A lost HTTP reply leaves the exact event replayable. Cloud deduplication handles replays after crashes and duplicate notification delivery. This spool is a delivery buffer, not permanent local history; the durable cloud history remains append-only.

Limits cover pending event count, canonical payload bytes and SQLite page allocation. DELETE journaling, FULL synchronization and `fullfsync` are selected explicitly. Deployment must reserve room for the database, its bounded rollback journal and filesystem overhead; SQLite page limits alone are not a disk quota. Default busy timeout is 250 ms. SQLite writes are synchronous and can stall an event loop; independent hardware safety protections remain mandatory. Avoid placing the direct safety callback behind any queued network/storage operation.

`status()` exposes pending count/bytes, saturated durable loss/blocked counters and degradation. Unreadable storage reports null counts and bounded volatile blocked/loss counters. On full spool, admission fails without evicting unreceived evidence. A safety stop executes first and its event is attempted afterwards; loss increments in the pre-existing state row best-effort. If even that write fails, a bounded volatile loss counter is exposed and can disappear on process/power loss. No software can promise a persistent loss record on completely failed storage. Persist/externalize degradation when storage recovers; missing source sequences and boot changes remain independent evidence. A monotonic sequence gap can bound missing records, not reconstruct their actions or outcomes.

Run `pnpm --filter @arbi/audit test`. Tests use real temporary SQLite files, process SIGKILL, unfinished transactions, lost receipts, tampering and actual page-limit exhaustion. They establish host process/fsync semantics, not storage hardware power-loss proof or physical stopping.
