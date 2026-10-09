# Dock capture and release proposal

Proposed development of a passive capture cartridge with a dock-mounted release
actuator for the compact camera pod at a non-powered corner. Physical validation
remains pending.

9 October 2026. **Proposed design direction; physical validation pending.**
The DOCK-IF-01 r0.1.0 bench kit implements the split guide, locator/fork,
spider bridge, arm and roof as unvalidated fabrication sources. It leaves
actuator interfaces and operating permissions unresolved. Acceptance of a proposed interface requires
normal repository review and merge; physical acceptance requires its own record.

## Problem and affected boundaries

The [dock baseline](README.md) calls for a high self-centering dock with passive
retention, confirmed release and weather shelter. The previous independent funnel/nest and latch/hood samples are archived.
The current bench kit adds a complete nominal mechanical pose and supported
manual release; it does not implement passive automatic capture.

The selected [compact camera pod](../../../hardware/assemblies/camera-pod/camera-pod-enclosure.md)
has a new bench bridge/stud candidate with no physical acceptance. Its archived
mushroom stud is excluded from the current kit. The old nest's 170 × 125 mm pocket cannot substitute for a
clearance check against the actual fixed shell, spider, moving head and four lines.

Affected owners are dock, camera pod, corner station, positioning lines, winch,
cabinet and local control. [LS-16–LS-18](../../system/local-safety-interface-matrix.md#dock-restraint-and-pod-outputs)
and the current `Docking`, `Parked`, `Maintenance` and fault requirements remain
binding. No GPIO, supply voltage, sensor product or release actuator is selected.

## Proposed mechanism

- Use a non-powered corner with the same post-size configuration as the corner
  support set, as selected by the owner on 9 October 2026. The current study
  default is round-120; exact corner ID and as-built dimensions remain open.
- Retain an upward final stud approach into a downward-facing guide. Survey and
  cable-force analysis must first show that this approach is feasible at the
  chosen corner while every line remains inside its accepted tension envelope.
- Separate the broad capture funnel from a replaceable final locator and latch
  cartridge. The funnel guides; defined structural contacts carry retained loads.
- Develop a centered mushroom interface supported from the pod's structural core.
  Study a removable bridge around the fixed hood against an independently
  supported, sealed through-hood mast. Neither may load the hood, electronics
  board, moving head or cosmetic fasteners. Select the pod-side route only after
  packaging, complete-mass and centre-of-gravity review.
- Study a spring-closing sliding fork under the mushroom shoulder. A guide and
  positive stop carry load; the spring positions the fork and is not the retained
  load path. Define both downward support and upward/lateral restraint.
- Put the release actuator on the stationary dock. Its linkage must return
  toward engagement without release power when unobstructed, and must not hold
  the latch open unintentionally after a reset. A jam or uncertain engagement
  remains a fault; loss of actuator power alone does not prove closure.
- Observe pod seating and actual fork engagement separately. A switch on the
  actuator is not confirmation of fork position. Review common failures,
  redundancy and electrical fault detection before selecting real sensors.
- Mount a removable white shelter over the dark capture structure, preserving
  four-line movement, drainage, ventilation and inspection access. Magnets remain
  optional centering aids; optical wiping remains deferred.

The [design package](design-package.md) defines datums, load cases and sequencing.
The [bench plan](bench-test-plan.md) defines staged tests; the
[acceptance record](acceptance-record.md) is blank until evidence is recorded.

## Alternatives and remaining decisions

Keeping the current funnel/nest unchanged is useful for source history, but does
not resolve the final locator, compact-pod attachment or release mechanism.
A rotary pawl is an alternative to the sliding fork if contamination, wear or
release-force tests favor it. Friction or magnetic retention alone does not meet
the mechanical-retention requirement. A powered latch that must stay energized
to retain the pod is outside this passive-retention proposal.

A removable spider bridge and sliding fork are the bench candidates. Their
load/mass/print acceptance, radial clamp retention, actuator, sensor mounting
and as-built station fasteners remain open. Full-power-loss line restraint is a joint
winch/dock/site decision, not an inferred property of this latch. Changing the
deferred brake baseline requires its own reviewed design and evidence.

## Validation and implementation order

1. Record site, pod, manufacturing and load inputs in the design package.
2. Review the interface and choose the pod attachment and latch mechanism.
3. Use the registered parametric bench kit and nominal mesh checks as the
   starting fixture; complete approach, retention, release, line, service and
   tool-envelope evidence for the actual configuration.
4. Build a secured bench rig and record fit, capture, release and fault results.
5. Qualify the nominal arm/shelter and received fasteners, select automatic
   capture/release and sensing components, update the canonical BOM and review real wiring.
6. Integrate the four-line frame and then the installed site under their separate
   restraint, clearance, weather, structural and electrical acceptance gates.

No physical test, installed authority or completed supplier selection follows
from this proposal. [Issue #59](https://github.com/gredice/arbi/issues/59) owns
the related firmware input adapters; the mechanical design and its evidence
are reviewed with the dock-kit pull request; physical follow-up remains open.
