# Design status

## Meaning of this page

This is a current evidence inventory, not a purchasing list and not a certification statement. “Baseline” means selected in the current committed design. “Unverified” means no repository evidence currently demonstrates the claim.

## Status summary

| Area | Current baseline | Evidence status |
| --- | --- | --- |
| Site | 25 current beds, 30-bed capacity, approximately 29.2 × 6.6 m anchor rectangle | Geometry recorded; actual site survey unverified |
| Corner stations | Four treated timber posts with outward guys and approximately 3 m pulley height | Starting dimensions recorded; soil, wind, anchors, and structural design unverified |
| Winches | Direct-drive 3 Nm closed-loop steppers, external shaft bearings, single-layer printed drums | Selected concept; force, speed, heating, drum, and failure behavior unverified |
| Positioning lines | Three normal Dyneema lines plus one 48 V powered hybrid line | Novel powered-line construction; fatigue, insulation, and cycle life unverified |
| Camera pod | Pi 3A+, Camera Module 3, two micro servos, 100–120 g target | Component baseline recorded; complete mass, thermal, electrical, and imaging results unverified |
| Dock | High corner dock with funnel, passive latch, sensor, and shelter | Geometry is a starting point; capture envelope, latch, release, and power-loss behavior unverified |
| Control cabinet | Protected 230 V entry, two 48 V/350 W supplies, Pico 2 W control, fused branches | Logical baseline recorded; cabinet, protection coordination, earthing, thermal, and field wiring unverified |
| Motion software | Local synchronized STEP/DIR control, Euclidean cable targets, positive tension | No implementation or real-system validation recorded here |
| Imaging software | Move, stop, gimbal, settle, autofocus, capture, rectify, upload | Desired workflow; settling time and repeatability unverified |
| Safety | Workspace limits, fault handling, docking, low-voltage overhead, structural checks | Minimum topics identified; safety case incomplete |
| Simulation | Future digital twin and controller-tuning environment | Boundary recorded; model not yet validated |

## Baseline choices that must remain traceable

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
