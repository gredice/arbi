# MCU model diagnostics

The cabinet [diagnostic C core](../../apps/arbi-control-cabinet-firmware/include/diagnostics.h) observes the [local recovery model](local-controller-recovery.md) under [ADR-0029](../decisions/0029-bounded-mcu-model-diagnostics.md). It has no GPIO, camera, encoder, current or tension adapter. Every export says simulated; physical acceptance and actuation remain false/inhibited. The ordinary USB diagnostic endpoint does not advertise this model as a working physical controller.

The owner records reset/configuration/fault transitions and each accepted, rejected, completed or aborted command. Records copy configuration, hardware, calibration, geometry, frame and binding identities at the event; changing a later profile cannot relabel earlier history. IDs, source/receiver epochs, command sequence/fence/deadline and monotonic record time support edge correlation. Invalid/nonterminated identifiers are redacted into unattributed records; free payloads and error messages never enter serialization.

The ring has 16 normal and four reserved fault/reset slots. Each tier evicts oldest-first, without allocation or blocking I/O in application code. Event sequences increase even across evicted records; loss counters saturate without wrapping. `diagnostics_page` scans the fixed capacity and returns at most four records in increasing sequence order. A cursor before an overwritten sequence gets `gap=true`; a previous-boot cursor gets `reset_boundary=true` and starts at the new boot. A future cursor is rejected. Re-reading a page is permitted; the receiver deduplicates by source epoch and sequence. Both tiers can overflow, so fault retention is bounded rather than guaranteed forever.

`diagnostics_record_json` exports closed informational records. `diagnostics_outcome` exports attributable accepted/rejected/completed/aborted records using the unchanged protocol 1.0 vocabulary. Aborts map to failed/INTERRUPTED and replay rejection to SEQUENCE_REPLAY. These are simulated source observations. An edge receiver still needs the actual admitted command, actor, realm/site and authenticated module identity for [audit projection](audit-events.md); schema-valid JSON and command acknowledgement do not prove authorization or measured effect. Synthetic model recovery/lease actions have no wire command implementation and must not be invented as cloud/device audit operations. No uploader, cloud storage or viewer/mobile-accounting owner is introduced here.

Snapshots are rendered at most once per 100 monotonic milliseconds into an 8,192-byte caller-owned buffer. Faster attempts increment a decimation counter and emit nothing. Rendering performs no transport I/O and never refreshes control progress. The caller schedules it after control/fault handling, must not block control on delivery, and must bound transport writes separately. Diagnostic production cannot clear pending atomic faults, restore references or make the model watchdog-feed decision eligible. The ordinary runtime and the model remain separate until a later authenticated physical adapter integration.

| Channel | Export provenance |
| --- | --- |
| STEP counts | Simulated commanded counts; stale after inhibited reference readiness; unavailable without a configured/reconciled model |
| Pose | Derived estimate, original count-sample time/age, mm and frame revision; stale after fault |
| Digital inputs | Each real value unavailable/null; fresh simulated fixture value separately estimated, otherwise null |
| Encoder/current/tension | Unavailable/null; driver-local encoder feedback has no MCU measurement interface |
| Reset cause | Unknown/null or explicitly simulated power/watchdog/brownout fixture; no inferred physical brownout |
| Sequence/drop/decimation/buffer counters | Actual software counters for this model boot |
| Actual interrupt delay, fault response and output queue depth | Unavailable/null; no fabricated zero timing or inactive hardware queue |

The [closed schema](../../apps/arbi-control-cabinet-firmware/schema/diagnostics.schema.json) and host checks reject unavailable numeric placeholders and measured labels for absent channels. Real pulse/interrupt timing with maximum diagnostic load must still be measured on the approved isolated fixture against its accepted budget. [Evidence](../evidence/mcu-model-diagnostics.md) records that gap; simulation/source success does not close #70.
