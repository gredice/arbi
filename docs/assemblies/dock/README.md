# Dock

## Responsibility and boundary

The dock captures, mechanically retains, shelters, and confirms the inactive camera pod. It owns the corner-mounted support arm, funnel/nest, final locating socket, pod-stud interface definition, latch and release mechanism, dock sensor, roof/shelter, drainage, service access, docking configuration, and parked/maintenance procedures.

The dock does not infer safe parking from requested coordinates. `Parked` requires mechanical capture and accepted confirmation.

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

- Final dock corner, geometry, structure, latch, release actuator, and sensor arrangement.
- Whether one dock sensor is sufficient and how it is cross-checked.
- How the pod is recovered when it cannot dock or release.
- Whether safe parked clearance requires a normally engaged winch brake for V1.
- Final environmental operating and parking policy in wind, rain, lightning, heat, frost, or ice.
- Whether and how a passive optical cleaning feature can avoid contaminating or scratching the lens window.
