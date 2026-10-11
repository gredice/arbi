# ADR-0028: Simulation-only local controller recovery

- Status: Accepted when merged; proposed until then
- Date: 2026-10-11
- Work record: [#67](https://github.com/gredice/arbi/issues/67)
- Prerequisites: [ADR-0006](0006-local-safety-authority-and-instrumentation.md), [geometry](0025-revision-bound-motion-model.md), [unavailable inputs](0027-unavailable-real-inputs-and-homing-model.md)

## Decision

Add a fixed-memory, single-owner C state model for local deadlines, fencing, command replay, latched faults and deliberate synthetic recovery. It composes the existing input, reference and finite geometry models. The trusted in-process synthetic adapter supplies copied source/target epochs and full configuration/mechanics identity; this is not a new authenticated wire capability. The ordinary diagnostic firmware continues rejecting every motion command and has no admitted profile or real input/output adapter.

For the synthetic policy, every trajectory expires within 250 ms and edge observations within 100 ms. Manual leases last at most 1,000 ms; a manual trajectory cannot outlive its lease. An owner-loop gap over 20 ms latches a supervisor fault, and link observations alone cannot make the model watchdog-feed decision eligible. These are virtual policy limits, not physical response measurements or approved installed thresholds. The existing ordinary image's 2-second hardware watchdog remains separate and unchanged.

While moving, edge/authority expiry requests a synthetic abort/hold; idle loss requests inhibition. Alarm/limit/missing required inputs, scheduler/completion errors, configuration changes, clock reversal and supervision failure request a synthetic disable and invalidate estimated reference readiness. Output requests carry no proof of deceleration, braking, torque removal or line restraint. No policy for loaded stopping is selected.

A lock-free atomic fault word accepts fixed cause bits without logging, allocation or network/storage work. The output getter immediately reports inhibited while a signal is pending; the owner drains and latches it. No actual ISR, GPIO or independent protection path is installed by this model. Recovery requires a fresh current link, valid simulated inputs, matching recent completed reference fixture started after the newly latched fault, an explicit recovery command with current generation and a strictly greater fencing epoch, and a valid synthetic reconciliation pose. Reconnection alone clears nothing. Reset discards configuration, moving state, plans and leases. Optional copied previous-boot diagnostics restore no authority and have no physical power-loss retention claim.

Keep at most 32 accepted command IDs per model boot with no eviction. Increasing sequences within the current fence and unique IDs prevent replay. Exhaustion latches a capacity fault requiring a fresh boot and reference/recovery sequence. This deliberately small test-model envelope is not a production throughput target. No physical acceptance, Ready, Parked or update-safe condition follows from a successful model recovery.

## Consequences

Host and pinned target-link checks can exercise failure/recovery logic before hardware is available. [The guide](../software/local-controller-recovery.md) defines caller ownership and [source evidence](../evidence/local-controller-recovery.md) separates logical results from missing board/secured-rig timing, circuitry and LS-18 power-loss line-clearance evidence. #67 stays open for those gates. Real authentication/adapter integration and interrupt/watchdog wiring require a later reviewed change; no public command or shared protocol schema changes here.
