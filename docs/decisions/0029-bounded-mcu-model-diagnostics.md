# ADR-0029: Bounded MCU model diagnostics

- Status: Accepted when merged; proposed until then
- Date: 2026-10-11
- Work record: [#70](https://github.com/gredice/arbi/issues/70)
- Prerequisites: [ADR-0028](0028-simulation-only-local-controller-recovery.md), [audit evidence vocabulary](../software/audit-events.md)

## Decision

Add a bounded diagnostic producer to the simulation-only local C controller model. Each owner-observed accepted/rejected/completed/interrupted command records command/correlation ID, request source, receiver boot/session, command sequence/fence/deadline and the complete copied configuration/mechanics identity. Malformed identifiers produce redacted unattributed records. Fixed fault/reset causes never contain raw parser input, arbitrary error text or credentials.

Reserve 16 normal and four fault/reset records. Normal flooding cannot evict the fault/reset slots; flooding either tier evicts its oldest record and increments a saturating loss counter/highest-lost sequence. Paging returns at most four records in sequence order, explicit gaps and boot boundaries. No ISR performs formatting or enqueues records: the existing atomic latch still inhibits output immediately and the owner records the transition after draining it. Diagnostics never determine permission to inhibit, stop or feed a watchdog.

The application-owned closed [diagnostic schema](../../apps/arbi-control-cabinet-firmware/schema/diagnostics.schema.json) defines `arbi.mcu-diagnostics/1.0` snapshots and `arbi.mcu-record/1.0` informational records. They are bounded C export formats, not a new public actuator command or shared protocol version. Snapshot rendering is decimated to 10 Hz and capped at 8,192 bytes. It exposes simulated commanded counts and derived pose with quality, original sample time, age, units and frame/configuration identity. Real inputs, encoder feedback, current, tension and measured physical timing/queue depth stay unavailable with null values. Simulated digital inputs are labeled separately; unknown actual reset cause is null.

Attributable command records can also export the existing protocol 1.0 `command.outcome` with simulated execution mode, exact request/report epochs and finite errors. Interrupted plans report failed/INTERRUPTED, never completed. This export alone grants no authentication or audit authority: the edge must bind it to its stored authorized command and authenticated current module epoch before using the existing audit projection. Synthetic recovery/lease observations are informational model records, not new remotely supported recovery commands. The ordinary Pico USB endpoint remains diagnostic-only and does not instantiate this controller, stream this model or enable motion.

## Consequences

The source model exposes bounded traceable records for future authenticated adapter/persistence integration. A missing export, disconnected consumer or overwritten record remains explicit evidence loss. No complete audit history is claimed by a volatile ring. [The guide](../software/mcu-model-diagnostics.md) specifies ownership and [source evidence](../evidence/mcu-model-diagnostics.md) separates fixed-memory/flood fixtures from unavailable actual maximum-diagnostic pulse/interrupt/fault-response timing. #70 remains open for that physical timing comparison and real interface integration.
