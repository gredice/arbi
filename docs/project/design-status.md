# Design status

## Meaning of this page

This is a current evidence inventory, not a purchasing list and not a certification statement. “Baseline” means selected in the current committed design. “Unverified” means no repository evidence currently demonstrates the claim.

## Status summary

| Area | Current baseline | Evidence status |
| --- | --- | --- |
| Site | 25 current beds, 30-bed capacity, approximately 29.2 × 6.6 m anchor rectangle | Geometry recorded; actual site survey unverified |
| Corner stations | Four treated timber posts with outward guys and approximately 3 m pulley height | Starting dimensions recorded; soil, wind, anchors, and structural design unverified |
| Winches | Direct-drive 3 Nm closed-loop steppers, external shaft bearings, single-layer printed drums | Selected concept; [full-cover nominal CAD/service checks](../../hardware/assemblies/winch/full-cover-check.md) added; physical fit, force, heat, weather and guarding unverified |
| Positioning lines | Three normal Dyneema lines plus one 48 V powered hybrid line | Novel powered-line construction; fatigue, insulation, and cycle life unverified |
| Camera pod | Pi 3A+, Camera Module 3, two micro servos, 100–120 g target, 170 g ceiling | [current dry bench record](../../hardware/assemblies/camera-pod/payload-geometry-check.md), [dated earlier record](../../hardware/assemblies/camera-pod/payload-geometry-check-2026-09-28.md), [preferred integrated appearance configuration](../../hardware/assemblies/camera-pod/payload-enclosure.md) and [7 October nominal CAD checks](../../hardware/assemblies/camera-pod/payload-enclosure-check.md); 248.336 g full-solid print estimate does not establish flying mass, physical fit, rain, thermal, electrical or imaging acceptance |
| Dock | High corner dock with funnel, passive latch, sensor, and shelter | Geometry is a starting point; capture envelope, latch, release, and power-loss behavior unverified |
| Control cabinet | Protected 230 V entry, two 48 V/350 W supplies, Pico 2 W control, fused branches | Logical baseline recorded; cabinet, protection coordination, earthing, thermal, and field wiring unverified |
| Motion software | Local synchronized STEP/DIR control, Euclidean cable targets, positive tension | No implementation or real-system validation recorded here |
| Imaging software | Move, stop, gimbal, settle, autofocus, capture, rectify, upload | Desired workflow; settling time and repeatability unverified |
| Safety | [Local safety authority and instrumentation requirements](../decisions/0006-local-safety-authority-and-instrumentation.md), independent limits/stopping, docking and restraint | [Interface owners and evidence gates](../system/local-safety-interface-matrix.md) recorded; circuits, measurements, power-loss restraint and qualified physical review remain unverified; safety case incomplete |
| Simulation | [Scenario 1.0](../software/scenarios.md) and [bounded plant/module references](../software/bounded-plant-model.md); future digital twin and controller-tuning environment | Deterministic TypeScript/Python host evidence recorded; physical model fidelity, runtime integration and field behavior unverified |
| Online software and deployment | [ADR-0005](../decisions/0005-software-architecture-and-deployment.md): Vercel dashboard/API, Ably notifications, external Postgres/private objects, independent local runtimes and releases | [Capability review and local recovery experiment](../evidence/software-transport-feasibility.md), [site authorization](../software/site-authorization.md), [simulation-only enrollment/transactional inventory](../software/device-enrollment.md) and [image metadata/private Blob SDK boundary with isolated HTTP/PostgreSQL evidence](../software/image-storage.md) recorded; [durable cloud jobs/exclusive leases with isolated PostgreSQL evidence](../software/command-jobs.md) recorded; live provider integration, dashboard UI, broker routing, live media, OTA recovery and physical operation unverified |

## Baseline choices that must remain traceable

The [ADR-0008 edge prototype](../decisions/0008-edge-host-and-local-transport.md) adds executable diagnostic health/readiness, bounded mutually authenticated simulated local adapters and a Linux service definition. [Development-host tests](../evidence/edge-runtime-prototype.md) establish source and portable supervision behavior only; exact cabinet host, real transports, Linux confinement, power-loss durability and physical activation remain unverified.

- Four-cable architecture and local ownership of motion and safety.
- No battery or propulsion on the pod.
- High dock as the normal automatic parking location.
- Direct-drive winches without belt, gearbox, or reduction pulley.
- Single-layer drum to keep effective radius predictable.
- Pico 2 W and CL57Y-V20 STEP/DIR interface rather than RS485/Modbus.
- Camera Module 3 Standard with two-axis gimbal.
- 48 V distribution and pod power conversion close to the pod load.
- OpenSCAD as the canonical source for custom models.
- Assembly-owned documentation and normalized BOM data.

Changing one of these choices should reference an ADR or a GitHub issue that records the reason, evidence, and compatibility impact.

## Known contradictions resolved by documentation policy

The committed requirements specify a permanent high dock and also ask for servicing without a ladder. The V1 interpretation is:

- automatic HOME and parking remain at the high dock, with the bottom of the parked pod targeted around 2.4–2.5 m;
- service access is provided only through a manually initiated, controlled `MAINTENANCE` procedure after the work area has been cleared;
- the controller must never enter below-head-height maintenance positioning automatically.

This interpretation still needs a validated recovery and maintenance procedure. See [weather, parking, and maintenance](../operations/weather-parking-and-maintenance.md).

## Evidence still required before public operation

Loaded/installed operational actuation and motion-controller updates remain disabled until the [stage-specific local safety gates](../operations/prototype-and-commissioning.md#local-safety-and-update-gates) pass. Explicitly authorized secured isolated bench/HIL testing and flashing under a reviewed procedure may generate evidence; source checks and simulation cannot clear physical gates. Current driver-local encoders provide no measured position or tension to the Pico, and `Parked` alone is not update-safe.

- actual site survey and geotechnical/anchor assessment;
- maximum configured line tension and structural calculations;
- proof-load procedure and acceptance limits;
- line fatigue, electrical insulation, voltage-drop, and slip-ring tests;
- motor and driver thermal/fault characterization;
- signal-integrity testing for long outdoor STEP/DIR wiring;
- dock retention and total-power-loss behavior;
- safe stopping, emergency isolation, and recovery validation;
- mains design, earthing, protection, enclosure, and installation review;
- image repeatability, calibration, privacy, and data-retention controls;
- inspection intervals and replacement criteria.
