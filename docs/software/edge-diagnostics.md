# Bounded edge diagnostics and reconnect replay

Work record: [#51](https://github.com/gredice/arbi/issues/51). This implements the isolated Linux prototype with optional trusted composition in the existing edge runtime. [Host and native database evidence](../evidence/edge-diagnostics.md) covers a configured sixty-second disconnection and sustained flood. It enables no physical motion, recording, live provider connection or update installation.

## Observation and retention

`EdgeRuntime.composeDiagnostics(pipeline, uplink?)` runs before startup and verifies site, test realm and the complete current edge identity. An optional uplink must use that pipeline and the already composed [transfer budget](transfer-budgets.md). Authenticated module adapters invoke their observer only after their ordinary protocol, enrolled identity, configuration and capability checks succeed. Observer failure has its own bounded counter and supplies no command authority. The diagnostic pipeline independently checks the closed protocol schema and trusted source/capability binding.

The diagnostic ring accepts telemetry, state, fault and command-outcome observations. Its finite-code log interface accepts protocol error codes; arbitrary exception text, commands, configuration files, credentials and media payloads are rejected. Source UTC, uncertainty, monotonic time, boot/session, sequence, original sample quality and unavailable/null fields are retained. Commanded position and derived quantities retain their original quality; absent encoder/tension capability cannot admit a measured value. Diagnostic sequence gaps are visible observations and never become authoritative recovery cursors.

Limits are enforced before asynchronous persistence:

| Resource | Hard limit |
| --- | --- |
| Protocol frame | 8 KiB |
| Queued records | 32, each at most 12 KiB including wrapper; telemetry 16, faults 8, each other class 4 |
| Active source bindings | 16 device IDs; trusted boot/config changes replace the binding |
| SQLite ring | configured 32–512 records, 8 KiB–1 MiB logical bytes, 32–512 pages |
| Retention age | configured 1 second–1 hour, measured using the trusted edge receipt clock |
| SQLite cache | 512 KiB |
| Export | two active generators, 1 MiB maximum, eight-record pages |
| Reconnect turn | at most eight audit events, then at most eight diagnostic records |

The ring reserves separate fault capacity: persisted telemetry is capped at half the configured record count, faults at one quarter, and each other class at eight percent. Byte pressure evicts telemetry before codes, state, outcomes and faults. Queue pressure retains recent faults within their own cap. Retention expiry filters reads immediately and reclaims rows on the next accepted append. It does not erase the authoritative audit spool. Loss/rejection writes are aggregated once per event-loop turn; one queued record is persisted per turn. This bounds burst-induced synchronous writes. Accepted, retained, dropped, uploaded, rejected, queued and volatile storage-loss counters remain visible. Persistent counters saturate explicitly at 2,147,483,647.

Files require a private, owned, non-symlink directory and file. The SQLite ring uses DELETE journaling, FULL synchronization, immutable row updates, record hashes, an installation binding and one live PID/token owner. At the maximum 512-page setting, the main database is at most 2 MiB; budget another 2 MiB plus an 8 KiB allowance for transient rollback journal overhead. The bounded JavaScript queue payload is at most 384 KiB before object/runtime overhead. Total process RSS is measured separately, rather than inferred from payload limits. Storage exhaustion reports dropped/volatile losses; it does not authorize movement or block a local safety-stop callback.

## Exports and upload/download policy

`DiagnosticPipeline.export(signal, authorize, maxBytes)` is a local NDJSON generator over a frozen high-water mark. A trusted current diagnostics-read authorizer is checked for every yielded record, and cancellation/close is checked before output. It yields between eight-record pages, rejects byte/job limits and releases its slot on completion, cancellation or explicit iterator return. Consumers must close abandoned iterators. Only the closed observation projection can appear in the export; no raw log or secret-bearing payload is available.

No export HTTP listener is installed. A trusted adapter that transfers this local export over WAN must grant the corresponding diagnostic download/upload through `TransferBudget` before transport. Existing [media and artifact](transfer-budgets.md) hooks use the same class quotas, concurrency, retries and upload-window policy. Diagnostic/preview/image/recording classes do not bypass those hooks; recording remains disabled. LAN module observation and local control never call the WAN ledger.

`DiagnosticUplink.flush()` is an explicit, cancellable reconnect turn with no background timer, default URL, secret or ambient upload authority. Mode `essential-only` defers diagnostics; `low-data` sends at most one diagnostic record; `normal` sends at most eight. Current mode is rechecked between records. Unknown/stale coverage, exhausted allowance, upload-window/rate limits, capacity and unavailable clocks produce visible defer reasons through the existing budget. Essential audit replay uses its separate bounded reserve/rate/concurrency and still requires a valid billing-period checkpoint. Essential delivery is not unlimited.

Every actual transport attempt follows a durable start/reservation and grant. Authenticated adapters report attempted and accepted application payload bytes; partial sends retain diagnostic records. An absent, invalid, cancelled or lost receipt keeps the full preflight debit as an ambiguous upper bound. The pump cannot start overlapping retries while an uncooperative previous transport callback remains unresolved. The accounting projection labels process-epoch counters with the receiver identity and boot; persistent debits remain in the transfer ledger. It explicitly disclaims carrier billing accuracy. [Signed usage observations](usage-rollups.md) remain the cloud accounting ingestion boundary.

## Authoritative offline audit

The pump reads the existing [durable audit spool](audit-durability.md), not the lossy diagnostic ring. `EdgeJobs.auditRelay` exposes a trusted reconnect seam. Historical spool files reopen and fully verify during inhibited startup, before a job consumer runs. Original actor/site/device/operation/session/command correlation and source clocks survive every replay; the current uploader signs a fresh request around the original event. There are at most eight 16 MiB/4096-page job audit files. Overflow blocks new attributable sensitive work; local stopping remains available and reports evidence loss if it cannot persist.

Bounded reconnect reads and receipts validate their contiguous prefix against its stored anchor, event digest and chain without materializing the complete backlog. Full-chain verification still occurs at open and admission, and `verify()` remains available. Corruption in a later prefix is detected before that prefix can be sent or removed. Only an authenticated durable cloud receipt matching the exact event ID/content hash and a valid ingest clock removes the oldest pending event. A lost receipt replays the same event; transactional cloud ingestion deduplicates it. Diagnostic upload waits behind remaining audit backlog or any audit error. It cannot change job state, replay a command or fabricate a device effect.

Shutdown inhibits local module sockets, manual/job activity and commissioning first, then aborts uploads and closes diagnostic/accounting storage. Hardware watchdog timing, selected Pi storage/thermal behavior, cellular throughput and provider-billed reconciliation remain separate acceptance gates.
