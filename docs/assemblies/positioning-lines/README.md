# Positioning lines

## Responsibility and boundary

The positioning-line system transmits controlled tension from four [winches](../winch/README.md), through four [corner pulleys](../corner-station/README.md), to the [camera-pod spider](../camera-pod/README.md). It owns line material, length, construction, terminations, splice/attachment methods, powered-line conductors, strain relief, identification, inspection, discard criteria, and replacement calibration.

## V1 arrangement

- Four motorized lines total.
- Three normal Dyneema lines.
- One powered hybrid line with two flexible conductors helically wrapped around a Dyneema core.
- Starting Dyneema diameter: approximately 1–1.5 mm; pulley sizing currently assumes approximately 1.5 mm.
- Dyneema carries all tensile load.
- Electrical conductors remain mechanically slack relative to the Dyneema and must not become structural load paths.

Exact fiber grade, construction, coating, breaking load, creep, UV behavior, bend-fatigue rating, and supplier part remain open.

## Normal-line construction

Each line specification must define:

- manufacturer, product, diameter, construction, coating, color, and batch;
- minimum breaking load and approved working tension range;
- pulley and drum diameter compatibility;
- termination/splice type, bury length or fitting, efficiency, and inspection;
- pod-side articulation and anti-chafe protection;
- winch-side attachment and reserve turns;
- installed length, calibrated reference, preload, and discard criteria.

Knots, generic crimping, adhesive, or improvised fittings are not accepted without representative destructive and fatigue evidence.

## Powered hybrid line

The repository's starting construction is:

- approximately 1–1.5 mm Dyneema core;
- two very-fine-stranded, high-flex conductors;
- long helical pitch, approximately 10–20 cm per turn;
- conductors approximately 1–2% longer than the Dyneema;
- optional lightweight braid only if abrasion testing demonstrates a need.

The line carries nominal 48 V DC to the moving pod. This construction is novel and **unverified**. It must be treated as an electromechanical assembly, not merely cable tied to rope.

The design must address conductor gauge and insulation, current and voltage drop, flex life, UV/water/chemical exposure, abrasion at pulleys and drum, twisting, contact with Dyneema, end transitions, strain relief, field repair, fused fault response, and safe disposal.

## Terminations and pod interface

The four pod attachments must preserve the intended cable-spider geometry and avoid cutting, bending, or heating the lines. The powered line additionally needs:

- electrical termination mechanically independent of tensile termination;
- a serviceable connector or protected termination at the pod;
- strain relief that transfers cable handling to the Dyneema before conductor terminals;
- no exposed conductive parts in normal operation;
- a defined disconnect, polarity, labeling, and inspection procedure.

Every termination should have a stable part/assembly revision and representative pull/fatigue evidence.

## Tension, clearance, and line behavior

The controller should maintain positive tension in all four lines throughout the approved operating envelope. The V1 parking concept keeps the lines tensioned rather than intentionally slack:

- target minimum line height over accessible work/walking areas: at least 2.2 m;
- initial parking-tension experiment: approximately 10–20 N per line;
- final value determined from the actual installation, especially the heavier powered line.

These are starting points. Safe values need to include sag, elasticity, creep, temperature, wind, line mass, geometry, structural limits, dynamic load, pod/dock state, and power-loss behavior.

Simple Euclidean anchor distance does not by itself solve the four-line tension distribution. The control and simulator models must keep geometric length distinct from calibrated and tensioned line behavior.

## Printed parts, fasteners, and guides

Possible line-owned custom parts include pod strain relief, cable guides, end-transition supports, service gauges, and identifiers. A printed pulley keeper is owned by the corner station; drum grooves and guides are owned by the winch. No printed guide may carry an unspecified structural load or conceal damage.

## Software and records

Configuration should record each line's part/batch, assembly date, installed length, powered/passive variant, termination revision, winch/anchor/pod endpoints, calibration offset, service cycles or travel estimate, inspections, damage, and replacement. Replacing or shortening a line creates a new calibration state.

Telemetry should support investigation of position, commanded length, relevant motor feedback, fault history, and any future tension measurement without pretending that motor current is automatically line tension.

## Inspection and replacement

Inspect at defined intervals and after jams, derailments, docking impacts, storms, electrical faults, or unusual motion. Check:

- glazing, fuzzing, cuts, flattening, discoloration, contamination, and UV damage;
- termination movement or deformation;
- abrasion at drum, pulley, keeper, pod, and transition points;
- conductor continuity, insulation, temperature damage, and local stiffness;
- changed sag, creep, calibrated length, or powered-line balance.

Discard rules must be conservative, observable, and tied to the selected material and test evidence.

## Acceptance evidence

- Verified line and termination working-load basis with appropriate design factors.
- Representative static, cyclic, bend, UV/weather, and abrasion evidence.
- Full-travel drum/pulley operation without derailment or damaging rub.
- Powered-line voltage stability at maximum extension and worst expected pod load.
- Powered-line continuity, insulation, temperature, and fatigue results over a justified cycle count.
- Measured operating and parked line heights across the real site.
- Defined inspection interval, discard criteria, and replacement/calibration procedure.
- Controlled failure tests or analyses for single-line, termination, and conductor faults.

## Open questions

- Final Dyneema product, diameter, coating, tension range, and service life.
- Final conductor type, gauge, insulation, helical pitch, extra length, and end transitions.
- Whether protective braid helps more than it adds mass, drag, water retention, and spool complexity.
- Need and method for active tension measurement or compliant tensioning.
- Safe line-clearance behavior after complete power loss.
- How simulator parameters are identified from line and full-frame tests.
