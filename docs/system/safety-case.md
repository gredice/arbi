# Safety case

## Current status

ARBI is an unvalidated engineering concept for an outdoor, overhead moving-line system near people, plants, weather, and mains-powered fixed equipment. This page is a safety-case scaffold. It is not a certification, declaration of conformity, or authorization for public operation.

## Top-level safety claim

The intended top-level claim is:

> The released ARBI configuration can perform approved imaging and parking operations within its documented environment without exposing people, property, or the system to unacceptable risk.

That claim is currently **not demonstrated**.

## Minimum V1 safety requirements

- independent hard travel limits and a safe software workspace;
- motor-fault handling;
- cable-tension sanity checking where practical;
- HOME docking and a secure inactive state;
- low-voltage operation on overhead and moving equipment;
- strain relief on the powered line;
- secondary retention for heavier mounted hardware;
- correctly rated mains protection and earthing in the cabinet;
- structural review of posts, guys, and anchors for actual site conditions;
- an extremely light pod to reduce stored energy relative to industrial cable-camera systems.

These topics are necessary but not sufficient.

## Hazard inventory

| Hazard | Example causes | Required controls and evidence |
| --- | --- | --- |
| Falling or swinging pod/hardware | Line, termination, bracket, latch, or retention failure | Mass limit; rated interfaces; secondary retention where appropriate; proof/load/fatigue evidence; exclusion zones; inspections |
| Low or slack line in accessible space | Power loss, control fault, line break, parking error | Clearance measurement; safe parking strategy; fault behavior; possible fail-safe brake; area control |
| Excess line force or structural collapse | Bad trajectory, anchor error, wind, jam, calibration error | Force/tension limits; workspace constraints; structural calculations; anchor tests; independent stop path |
| Pinch, crush, or entanglement | Winch/drum/coupling, docking latch, moving line | Guards; lockout; service controls; clearances; warning and training |
| Electric shock or fire | Mains fault, moisture, earthing failure, damaged hybrid line, wrong protection | Qualified design/install; isolation; protection coordination; IP/condensation strategy; fusing; inspection and electrical tests |
| Unexpected motion | Software defect, stale command, reset, network issue, sensor fault | Local state machine; watchdogs; command authentication/expiry; hard limits; deterministic reset and recovery |
| Weather damage or loss of control | Wind, rain, lightning, UV, temperature, condensation | Operating envelope; external weather policy or sensing; shelter; surge/lightning review; materials and inspections |
| Privacy or data exposure | Images include people or private areas; public telemetry leaks location | Capture zones; masking; access control; retention policy; secret and location scrub |
| Unsafe maintenance | Automatic lowering, stored energy, remote start, ladder access | Manual maintenance mode; area-cleared interlock/procedure; isolation; lockout; no unattended low positioning |

## Safety architecture still required

The design must define and validate:

- a readily accessible means of emergency isolation and a safe-stop strategy;
- which limits are independent of cloud, edge application, and normal motion planning;
- start-up, reset, watchdog, brownout, and partial-power behavior;
- how each driver alarm, encoder error, sensor disagreement, and communication loss is detected;
- the permissible response when docking is unavailable;
- line-clearance behavior after total power loss;
- guards and lockout for winch service;
- environmental limits and who or what determines that operation is allowed;
- inspection intervals and discard criteria for lines, terminations, printed parts, timber, fasteners, slip ring, and electrical insulation.

## Structural evidence

The repository baseline proposes proof-loading the completed top bracket to at least the maximum configured line tension, preferably twice that value, and inspecting for permanent bending, timber crushing, bolt movement, or line contact. Before using this as an acceptance test, define:

- maximum configured tension and all relevant load directions;
- calibrated load application and measurement;
- test fixture, exclusion zone, duration, and sequence;
- quantitative movement/deformation limits;
- post-test inspection and retorque criteria;
- relationship between proof load, design factors, material variability, fatigue, soil, guy, and anchor calculations.

Proof loading does not make an otherwise unanalyzed structure safe.

## Electrical evidence

The cabinet and field installation require qualified review for applicable Croatian and EU requirements. Evidence should cover protection, isolation, earthing/bonding, conductor sizing, voltage drop, fault current, segregation, enclosure and ingress, condensation, temperature, surge/lightning exposure, labeling, lockout, and test results. Never infer compliance from a parts list.

## Operating stop conditions

Testing or operation stops when any of the following occurs unless an approved test procedure explicitly controls it:

- a person enters the active exclusion zone;
- a guard, retention, latch, enclosure, strain relief, or protective device is missing or bypassed;
- line damage, low clearance, abnormal noise, unexpected motion, overheating, moisture ingress, electrical odor, or insulation damage is observed;
- configuration, calibration, or assembly revision is unknown;
- a required sensor, driver, controller, or local communication channel is unhealthy;
- weather is outside the approved envelope or cannot be determined;
- a recovery step would require improvisation near stored mechanical or electrical energy.

## Evidence progression

1. Analysis and review establish requirements and predicted limits.
2. Bench tests characterize parts and isolated assemblies.
3. A small frame validates integrated behavior in a controlled exclusion zone.
4. Full-site commissioning validates the as-built configuration under restricted access.
5. Qualified review accepts residual risk, limits, inspections, and operating procedures.
6. Public operation begins only after all required evidence is linked to the released revision.

Simulator results may guide tests and expose defects, but never replace structural, electrical, environmental, or human-safety evidence.

## Open safety questions

- Is a normally engaged brake required before V1 public operation despite being deferred in the current baseline?
- What maximum line tension, speed, acceleration, and kinetic energy are acceptable?
- How are slack, line failure, and abnormal tension detected?
- What wind, rain, lightning, and temperature limits apply, and how are they determined locally?
- Which safeguards are independent enough to survive the same failure as normal control?
- What legal, electrical, structural, privacy, and workplace reviews apply at the installation site?
