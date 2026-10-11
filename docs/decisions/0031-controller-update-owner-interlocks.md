# ADR-0031: Controller update owner interlocks and service classification

Status: Proposed for source review; physical activation unavailable.

Work record: [#72](https://github.com/gredice/arbi/issues/72). Prerequisites: [local recovery](0028-simulation-only-local-controller-recovery.md) and [signed flash model](0030-isolated-signed-pico-flash-recovery-model.md).

## Context

A recoverable updater does not establish that a motion controller may reset safely. Parked alone cannot preserve line clearance, torque or independent restraint. Browser approval and a synthetic safe flag cannot qualify hardware recovery.

## Decision

Extend the actual C local owner with a synthetic update reservation. Before any expiry transition, reject running/active/prepared motion and active manual authority. Require current command identities, sequence, fence, recovery generation, bounded deadline and fresh owner/link state. Independently named, explicitly simulated update-safe evidence must match this controller epoch and name isolated outputs, restraint, preserved line clearance and stable power. Refuse pending fault words even when the output getter reports inhibited. On admission, remember the command, irreversibly lock this boot, clear motion/reference/leases and invalidate configuration/link authority. Configuration, recovery and movement cannot bypass the lock. A reset clears the lock but restores an unconfigured, inhibited controller requiring new commissioning reconciliation; it never restores old plans.

The Node controller adapter consumes the existing signed flash model rather than implementing another updater. Its trusted in-process owner seam rechecks fresh closed evidence before reservation, after reservation, at activation and at confirmation. It generates bounded authenticated updater requests with the current epoch. A failed stage keeps the owner reservation; retry requires a fresh model boot and reconciliation. The C owner and Node flash composition have separate source tests; no real transport connects them yet.

Inventory distinguishes verified host-slot/staged identities from actual executed firmware. It reports physical installation and remote activation unsupported, local service required with `PICO_PHYSICAL_RECOVERY_UNPROVED`, readiness/reconciliation still gated and BOOTSEL/SWD rehearsal unavailable. Consumers may display this reason but cannot turn it into hardware authority. No wire capability, physical flash/GPIO callback or direct browser installer is added.

## Consequences

Source tests establish bounded refusal/lock behavior, actual host image verification and native local trial recovery. They do not prove restraints, outputs during reset, instrumented interruption or installed firmware. Physical commissioning and first provisioning require a reviewed independent isolation/restraint procedure, installed identity/compatibility reconciliation and signed BOOTSEL/SWD rescue with actual board evidence. Until that work is accepted, the Pico target remains a local-service target. See the [guide](../software/controller-update-model.md) and [evidence matrix](../evidence/controller-update-model.md).
