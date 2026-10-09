# Dock

## Responsibility and boundary

The dock captures, mechanically retains, shelters, and confirms the inactive camera pod. It owns the corner-mounted support arm, funnel/nest, final locating socket, pod-stud interface definition, latch and release mechanism, dock sensor, roof/shelter, drainage, service access, docking configuration, and parked/maintenance procedures.

The dock does not infer safe parking from requested coordinates. `Parked` requires mechanical capture and accepted confirmation.

## Current development package

The [capture and release proposal](design-proposal.md) develops the dock around
the current compact camera pod. It proposes a separate final locator, passive
spring retention and a stationary release actuator. The owner selected a
non-powered corner using the same post-radius configuration as the corner support
set. The current study default is round-120; the exact passive corner, measured
post/pulley geometry and printer build volume remain open.

- [Interface design package](design-package.md): source compatibility, datums,
  missing inputs, load cases, observation requirements and implementation order.
- [Bench-test plan](bench-test-plan.md): capture, retention, release, faults,
  weather, recovery and separate four-line/installed acceptance.
- [Blank acceptance record](acceptance-record.md): exact configuration, reviewed
  limits, raw evidence and stage authorization; all results remain pending.

The current DOCK-IF-01 r0.1.0 sources define a **supported-dummy bench kit**:
four guide quadrants, final locator and manually released fork, structural
spider bridge/stud, split support arm and four roof quadrants. The old funnel,
nest, latch sample and hood sample are archived. Use the
[assembly guide](assembly-guide.md) and [PDF/STL publication](booklet/README.md).

Automatic spring capture, release actuator/circuit, accepted sensors, complete-pod
mass, line sweep and structural/weather acceptance remain unresolved. The kit's
pod attachment is a substantial mass addition; weigh the complete pod against
its 170 g ceiling before any suspended integration. Nominal vertical line
corridors do not establish installed routing.

The website's known-goods amount is partial. Printed materials are separately
estimated from solid CAD volume, and bought hardware, actuator, wiring and
mounting costs remain unresolved; see the
[generated BOM report](../../../bom/generated/arbi-v1-hr-zagreb.md).

## High-dock baseline

V1 uses a permanent high dock on one [corner station](../corner-station/README.md), rather than automatically lowering the pod into head space.

| Property | Starting value | Status |
| --- | ---: | --- |
| Corner pulley height | Approximately 3.0–3.1 m | Target |
| Dock capture point | Approximately 2.65–2.70 m | Target |
| Bottom of docked pod | Approximately 2.4–2.5 m | Target |
| Dock arm projection | Approximately 0.3–0.5 m | Starting range |
| Inward distance from corner pulley | Approximately 0.3–0.6 m | Starting range |

The inward location is intended to keep the three long lines high across nearly their full span. The docked-corner structure must include dock, shelter, wind, maintenance, and parking loads in its structural review.

## Explicit maintenance interpretation

The committed requirements also request servicing without a ladder. V1 resolves the apparent contradiction as follows:

- automatic HOME and inactive parking always use the high dock;
- the high dock is not promised to be directly serviceable from ground level;
- a separate, manually initiated `Maintenance` procedure may lower the pod only after the area is cleared and remote/automatic work is inhibited;
- normal control must never lower the pod into head space automatically;
- the safe isolation, line tension, recovery, and access procedure remains to be designed and validated.

## Funnel and locating geometry

The initial self-centering concept uses:

- funnel opening approximately 250–300 mm;
- final locating socket approximately 50–70 mm;
- centered mushroom/docking stud above the pod's center of gravity;
- geometry that preserves pendulum stability during approach;
- generous capture tolerance rather than millimeter-level positioning.

OpenSCAD sources should parameterize the stud, opening, taper, socket, clearances, latch, sensor target, arm interface, drainage, and pod envelope. A capture-envelope test fixture should exercise lateral, vertical, angular, and pendulum errors.

## Mechanical capture and release

V1 calls for a passive spring latch:

- printed ASA/PETG body as appropriate to the validated load and environment;
- stainless pivot bolts or pins;
- stainless springs;
- optional magnets for final centering only;
- microswitch or reed sensor for `DOCKED` confirmation.

Magnets are not the structural retaining mechanism. The mechanical latch carries the parked pod load. The final design must define latch load path, positive retention, wear, icing/dirt tolerance, spring life, release actuation, release confirmation, manual recovery, fastener locking, and secondary retention where required.

Printed latch structure cannot be accepted without creep, UV, temperature, cyclic, impact, and worst-direction load evidence.

## Shelter and drainage

The starting roof size is approximately 300 × 300 mm. It should shield the Camera Module 3, servos, Pi, and power electronics from direct rain and sun while leaving the downward optical opening unobstructed. Printed parts must drain and must not direct water into the pod.

The dock is the primary storage shelter because the pod is parked most of its life. It still needs evidence for wind-driven rain, splash, condensation, UV, heat, insects/debris, freezing/icing if applicable, and wind load. A passive optical cleaning pad or wiper is a deferred option.

## Docking and departure

The baseline docking sequence is:

1. Move to PRE-DOCK approximately 0.3–0.5 m from the nest.
2. Reduce speed substantially, initially to approximately 30–50 mm/s.
3. Approach with positive tension in all four lines.
4. Let the funnel center the pod stud.
5. Continue slowly until the latch captures it.
6. Confirm `DOCKED` using the specified sensor and plausibility rules.
7. Enter `Parked` and retain only the required safe parking tension.

Departure establishes normal tension, releases and confirms the latch, clears the funnel, and then permits normal motion. Define timeouts and bounded recovery for missed funnel, failed latch, ambiguous sensor, blocked release, power loss, and pod reset.

## Parked line clearance and power loss

Do not intentionally slack all four lines in V1. The current baseline targets:

- at least 2.2 m line height over accessible work/walking areas;
- an initial parking-tension experiment of approximately 10–20 N per line;
- final tension based on measured site clearance, especially for the heavier powered line.

The dock mechanically retains the pod, but V1 currently relies on powered winches to preserve line clearance. A normally engaged brake/drum lock is deferred in the current baseline. Therefore total-power-loss line sag remains a critical unresolved safety issue and may make a fail-safe brake necessary before public operation.

Under [ADR-0006](../../decisions/0006-local-safety-authority-and-instrumentation.md), `Parked`/`DOCKED` cannot authorize controller reset or updates. [LS-16–LS-18](../../system/local-safety-interface-matrix.md#dock-restraint-and-pod-outputs) require accepted capture/release confirmation, pod support and all-line restraint/clearance through driver disable and total/partial power loss, plus a bounded recovery procedure. Loaded/installed motion-controller updates stay disabled until that stage's evidence passes. Secured isolated bench/HIL flashing is separately permitted under the [reviewed test gates](../../operations/prototype-and-commissioning.md#local-safety-and-update-gates).

## Electronics, cabling, and software

The dock may require latch release power, sensor wiring, local protection, connectorization, and service isolation. Routing must avoid the moving pod, lines, latch, water paths, and structural inspection points.

Software/configuration owns PRE-DOCK, final approach, sensor debounce/plausibility, latch release, timeouts, recovery, and permitted maintenance transitions. Coordinates and sensor state are separate evidence; neither alone proves safe capture.

## Acceptance evidence

- Structural evidence for arm, station interface, funnel, socket, latch, pins, springs, fasteners, and shelter in all expected load directions.
- Capture-envelope success across representative lateral, angular, pendulum, line-tension, and speed errors.
- Latch and release cycle testing with dirt, wear, temperature, moisture, and power interruption.
- Independent confirmation that magnets carry no structural parked load.
- Sensor repeatability, fault detection, and no false `Parked` assertion.
- Measured parked line height and tension across the installed site.
- Shelter, drainage, condensation, and exposure evidence for the parked pod.
- Manual maintenance and failed-dock recovery performed without automatic below-head-height motion.
- Defined response to complete power loss.

## Open questions

- Exact non-powered dock corner, measured geometry and post dimensions, structure,
  latch, release actuator, and sensor arrangement; reuse the corner set's post
  configuration rather than selecting a separate radius.
- Accepting the two proposed seating/fork observations, including targets, mounts and circuit diagnostics.
- How the pod is recovered when it cannot dock or release.
- Whether safe parked clearance requires a normally engaged winch brake for V1.
- Final environmental operating and parking policy in wind, rain, lightning, heat, frost, or ice.
- Whether and how a passive optical cleaning feature can avoid contaminating or scratching the lens window.
