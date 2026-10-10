# Durable local jobs and operating policy

This implements the isolated host/simulation slice of [#30](https://github.com/gredice/arbi/issues/30), under [ADR-0006](../decisions/0006-local-safety-authority-and-instrumentation.md) and [ADR-0008](../decisions/0008-edge-host-and-local-transport.md). [LocalJobConsumer](../../apps/arbi-edge-controller/src/jobs/orchestrator.ts) consumes accepted `arbi/1.0` commands, configuration/calibration 1.0 and the merged bounded plant/module adapters. It has no cloud route, firmware, hardware device path, physical motion output, image bytes, preview, recording or update implementation. [Host evidence](../evidence/local-jobs.md) is separate from provider, bench/HIL, selected Linux host and installed acceptance.

## Composition and admission

The normal edge runtime keeps diagnostic-only module enrollment. Optional `jobs` settings configure `journalFile`, `auditDirectory`, `maxJobs` (1–4096), `maxBytes` (8192–128 MiB), `maxPages` (32–32768) and `minFreeBytes` (at least 2 GiB). Runtime health exposes configured storage/consumer, degradation, recovery requirement, active work and pending audit copies. Failed storage/recovery prevents readiness; it does not prevent local transport inhibition. Unconfigured job storage is explicit and never activates a fixture authority. `EdgeJobs.compose` requires a local adapter and current local authority resolver. There is no HTTP mutation endpoint or settings switch that selects synthetic permission or installed actuation.

The [explicit reference executable](../../apps/arbi-edge-controller/src/jobs/reference.ts) supplies synthetic authority and exact committed fixtures only when invoked separately:

```bash
pnpm --filter @arbi/edge-controller... build
pnpm --filter @arbi/edge-controller simulate:jobs --directory /tmp/arbi-isolated-jobs
```

The directory persists across runs. A completed command returns its original result; an unfinished command returns interrupted/operator-required after restart. Use a new explicitly chosen directory for a new fixture experiment. The executable never selects a physical endpoint, loads deployment credentials or exports image bytes. Its 50 ms sampling, stop witness, settling, module delays and virtual latch are synthetic bounds, not measured timing or fitted instrumentation.

`LocalAuthority` is trusted local composition, not command payload. Every new discretionary command checks current authorized actor/source/realm/site/receiver, exclusive lease ID/holder/uint64 fence and expiry, supported command/phase capabilities, mode, Ready/stationary state, accepted configuration digest/calibration and loaded limits. Target frame, capture mapping, PRE-DOCK/dock points, gimbal limits and speed are checked against the accepted configuration; every derived actuator input uses shared `checkConfiguredCommand`. Schedules and priority gain no exception. Parked departure, homing and maintenance movement are unsupported; deliberate inspected local reconciliation must establish Ready before new work.

Required policy inputs are workspace, local weather, access, maintenance, fault, power, reference, lines, protection and dock availability. Each explicitly reports supported/allow/deny/unknown, simulated origin, sample/deadline and exact configuration/calibration. Missing, unsupported, unknown, stale (over 1500 ms), future or mismatched inputs inhibit work. These are simulation permission witnesses, not sensor readings. The plant still reports line tension and Pico encoder feedback as unavailable. Current physical interfaces cannot satisfy installed requirements in the [safety matrix](../system/local-safety-interface-matrix.md).

Time is receiver boot/session monotonic time. A trustworthy local monotonic clock, nonregressing persisted clock floor, exact target/deadline epoch and accepted maximum deadline interval are mandatory. Sender UTC never maps to receiver time or supplies permission. Cloud clock-anchor uncertainty checks remain owned by [cloud jobs](command-jobs.md). New expired work is durably rejected, including after reconnect. A duplicate can return its cached historical result after expiry or receiver reboot; it cannot dispatch. Whole-job `maxDurationMs`, original command deadline and each phase timeout all bound execution; lease renewal never extends them.

Every phase rechecks current authority, lease, configuration, calibration and both module boot/session/generation identities. Manual work stops on Internet loss. An explicitly locally permitted autonomous **service** simulation may finish offline within its original lease/deadline and prerequisites; disconnect does not create that permission. Unknown weather, controller fault, maintenance, power loss or epoch replacement stops/latches recovery. None selects an unconditional return-home trajectory.

## Transition and proof rules

| Local phase | Protocol state | Completion prerequisite | Host phase bound |
| --- | --- | --- | --- |
| Move | Moving | Attributable module arrival proof | Original command duration, at most 10 s |
| Stop | Moving or Returning | Separate fresh controller stop witness | 500 ms |
| Gimbal | Settling | Stationary prerequisite and module settled proof | 1 s for a capture plan |
| Settle | Settling | Separate settling interval/witness | 500 ms |
| Capture | Capturing | Attributable completed capture witness | Original command duration, at most 10 s |
| Return to PRE-DOCK | Returning | Current policy and arrival proof after safe gimbal pose | Original command duration, at most 10 s |
| Reduced-speed approach | Docking | Current dock availability and arrival proof | Original command duration, at most 10 s |
| Dock stop | Docking | Separate fresh stop witness | 500 ms |
| Latch | Docking, then Parked | Fresh virtual latch true, configured debounce and coordinate plausibility | 500 ms |

The capture plan restores the accepted synthetic safe motion pose before returning. Standalone motion finishes only after its independent stop proof. Standalone gimbal requires stationary readiness. A remote `control.stop` is authorized/expired by protocol, invokes local stop **before persistence**, cancels active work and requires a separate stop witness for its own completed result. It cannot clear a fault. A required local stop invokes the adapter first, then attempts evidence; no disk/audit/network callback gates it.

Coordinates, HOME, “sent”, a transport receipt or a cloud acceptance cannot prove stopped/captured/Parked. Each proof binds operation nonce, proof kind, module identity/generation, exact config/calibration, sample time and explicit simulated origin. Wrong, stale, future or unconfirmed proofs fail. Missing stop/capture/latch evidence times out to Fault/operator-required. Capture completion followed by ambiguous docking returns a failed job; it does not fabricate overall success or image delivery. Parked does not authorize reboot/update or establish total-power-loss line clearance.

## Journal, audit handoff and recovery

The optional [manual coordinator](manual-control.md) adds a persisted upstream fence,
separate increasing human-intent pulses and a receiver-local deadman to direct manual
jog/framing. Its gate is rechecked before admission and every running phase; ordinary
runtime settings do not compose it. Schema 2 upgrades the journal additively and blocks
older binaries from ignoring the fence. Physical watchdog/stopping evidence remains separate.

The [SQLite journal](../../apps/arbi-edge-controller/src/jobs/journal.ts) uses bounded DELETE rollback journaling, synchronous FULL/fullfsync, a 100 ms lock timeout, page/logical-byte/job limits and free-space reserve. Intent, job records, immutable outcomes, phase decisions, operation/proof identity and `arbi.audit/1.0` outbox events commit in **one** `BEGIN IMMEDIATE` transaction. Schema triggers prohibit updates/deletes of intent/history/proofs/outbox; hashes and SQLite consistency are verified on open. Schema-owner tampering and storage firmware lies remain outside this accidental/application mutation protection.

Original actor, site, source/target boot/session, configuration, lease/fence, correlation and payload remain in immutable records. Command ID and source/idempotency-key conflicts reject; the source sequence high-water cannot regress through reordered rejections. Exact retry delivery metadata may differ without creating another logical execution. No history pruning removes deduplication within this bounded journal. Capacity exhaustion requires deliberate retained-record export/rotation under a recovery procedure, not automatic forgetting or replay.

Each operation is committed before sending. Each dispatch receipt and each independently observed proof is committed separately, together with its audit event. A single supervised consumer owns the journal: an owner PID/token is acquired transactionally, and another live PID (including a second consumer in the same process) is denied. PID reuse conservatively denies ownership rather than stealing it. A dead owner is replaced only after OS process absence; this is same-host process evidence, not distributed fencing or physical protection.

The durable outbox is authoritative for crash-safe audit handoff. [JobAuditRelay](../../apps/arbi-edge-controller/src/jobs/audit-relay.ts) appends the exact event ID/content to `@arbi/audit`, then commits a copy acknowledgement in the job journal. A crash between those actions repeats the identical append, which the audit spool deduplicates. Audit upload/receipt cannot advance a job. Historical source epochs get separate spools, preserving original attribution; at most eight 16 MiB/4096-page spools are allowed. Their automatic deletion is unsupported. Journal transaction rollback leaves neither an orphan job decision nor an orphan audit intent. The audit schema distinguishes admission/phase authorization from device-reported terminal results and unknown/interrupted effects; SQL outbox `record_id` joins every event to its immutable local record even when the wire schema requires `record=null`.

Before discretionary send, pending audit copies must succeed. Journal or audit failure inhibits new work, reports degradation and invokes the local stop path first. If evidence itself cannot persist, health retains volatile degradation; the surviving unfinished record is reconciled on the next open. Audit-capacity failure never retries movement or fabricates its result.

Startup immediately stops the simulator and interrupts **all** unfinished jobs, including admitted-but-unsent, prepared-before-send, sent-without-receipt, receipt-without-proof and proof-without-next-phase work. No moving/capturing state, lease or queued action resumes. The original receiver epoch and last known monotonic sample label the interrupted historical outcome; startup does not translate a new boot clock into the old boot. A final proof already committed before death preserves its completed outcome. Every startup, including after completed work, latches new work until a deliberate local caller supplies fresh all-input reconciliation and stationary Ready state. This attributable human reconciliation binds both module epochs, references, stopped/latch-release witnesses and an authorization ID; its immutable local record, audit authorization and latch release commit together. Cloud delivery cannot perform this release. Bench/physical reconciliation requires independently reviewed actual stop/restraint evidence, absent here.

SQLite COMMIT and host SIGKILL tests establish process-crash recovery on the tested filesystem. They do not establish power-loss durability, stopping distances, sensor independence, watchdog behavior, selected-host storage semantics, restraint or safe installed operation. The [Node SQLite API](https://nodejs.org/docs/latest-v24.x/api/sqlite.html), [SQLite transaction rules](https://www.sqlite.org/lang_transaction.html) and [synchronization/page-limit pragmas](https://www.sqlite.org/pragma.html) describe the implementation primitives; physical acceptance remains separately gated.
