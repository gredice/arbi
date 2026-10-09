# Camera pod OpenSCAD sources

System context: [Camera pod assembly documentation](../../../docs/assemblies/camera-pod/README.md).
Shared parameters live in [the camera-pod library](../../lib/camera-pod.scad).

The camera-pod family contain individual **concept-unvalidated fabrication models** and non-manufacturing CSG references. No committed record demonstrates printed mass or fit to the purchased Pi, camera, servos, converter, or line hardware. ASA remains the preferred exposed-release material; PETG is acceptable only for prototypes pending creep and weather evidence.

## Archived camera-pod concept list

One BOM `camera-pod-chassis` plus one `camera-gimbal` means the current integrated flying-pod printed kit. **Do not print the archived concept list below for that kit.**

The preferred public appearance is the [integrated camera pod enclosure](camera-pod-enclosure.md), following the [design conventions](../../../docs/project/industrial-design.md). Use its configuration table for the current enclosed print kit. The print list below describes the historical camera-pod concept family. The alternative [camera pod bench mount set](camera-pod-mounts.md) shares the spider but uses its own electronics and gimbal mounts; follow that set's quantities when building the bench arrangement. The current BOM source lists contain only the compact enclosure kit. Historical models are retained in `hardware/models.json` under `archivedModels`, excluded from active inventory and individual CAD releases. Neither arrangement has demonstrated the complete flying mass limit.

| Source | Per pod | Role |
| --- | ---: | --- |
| [Spider](camera-pod-spider.scad) | 1 | Four-line load interface |
| [Electronics mount](camera-pod-electronics-mount.scad) | 1 | Fixed Pi / converter / capacitor plate |
| [Docking stud](camera-pod-docking-stud.scad) | 1 | Mushroom capture above the hub |
| [Line strain relief](camera-pod-line-strain-relief.scad) | 4 | Arm-end fairlead; one serves the powered line |
| [Gimbal base](camera-gimbal-base.scad) | 1 | Pan-servo cradle |
| [Gimbal yoke](camera-gimbal-yoke.scad) | 1 | Tilt-servo U-frame |
| [Camera plate](camera-gimbal-camera-plate.scad) | 1 | Camera Module 3 carrier |
| [Rain cap](camera-gimbal-rain-cap.scad) | 1 | Pan-servo splash cover |
| [Optical hood](camera-gimbal-optical-hood.scad) | 1 | Short camera visor |

[camera-pod-envelope.scad](camera-pod-envelope.scad) and [camera-pod-assembly.scad](camera-pod-assembly.scad) are **non-manufacturing references** exported as CSG. Do not print them.

## Coordinates and sandwich

Z points toward the dock. The spider is centred on the line plane at Z=0. The electronics mount and docking stud stack on +Z of the hub; the gimbal hangs on -Z. The shared M4 clearance bolt circle is 22 mm radius at 45°, matching spider 0.1.0. Sandwich thickness through electronics (3 mm), spider (7 mm) and gimbal flange (3 mm) is 13 mm, or 17 mm with the 4 mm stud flange; M4 through-screws and metal nuts are the starting fastener assumption. No threads rely on plastic.

Printable parts use Z=0 as the bed plane except the spider, which remains centred as in revision 0.1.0. The assembly reference rotates the gimbal group 180° about X so the pan servo hangs downward. Set `show_legacy=true` and `show_context=true` in [camera-pod-assembly.scad](camera-pod-assembly.scad) to ghost a Pi board outline; that box is not a measured keep-out.

## Starting COTS envelopes

These values are published or class-typical starting points, not received-unit measurements:

| Interface | Starting value | Source / limit |
| --- | --- | --- |
| Raspberry Pi 3A+ board / holes | 65 × 56 mm / 58 × 49 mm centres | Raspberry Pi mechanical drawing RPI-3A+_V1-0 |
| Pi fasteners | M2.5 through, 3.2 mm clearance | Drawing hole class; nylon hardware is a procurement allowance |
| Camera Module 3 board / holes | 25 × 24 × 11.5 mm / 21 × 12.5 mm centres, Ø2.2 | Product brief plus Camera Module 2 hole identity |
| 3.7 g servo body | 20 × 8.75 × 16 mm pocket, 23.5 mm tab-hole span | GH-S37D-style listings; inspect the purchased servo |
| Converter pocket | 52 × 28 mm | Module-dependent starting cage |
| Capacitor saddles | Ø12.5 mm, two places | Module-dependent starting cage |
| CSI / service hole | Ø18 mm through hub | Tight on a 16 mm ribbon; do not treat as proven routing |
| Docking mushroom | Ø14 mm stem, Ø24 mm head, 45° printable flare | Must pass the 28 mm nest latch opening; funnel throat is 60 mm |
| Strain-relief inner | 22.6 × 7.6 mm sleeve, Ø6 mm line hole | Matches spider arm and hole; hybrid 4.5 mm envelope is tight |

Horn screw span is an 8 mm starting pattern. Servo spline index, pan/tilt hard-stop timing, ribbon bend radius, and collision at ±90° pan / 0–70° tilt are unresolved. The rain cap only reduces direct splash; it does not authorize wet-weather operation.

## `camera-pod-envelope`

[camera-pod-envelope.scad](camera-pod-envelope.scad) is a keep-out for the fixed component volume, gimbal sweep, docking interface, rear service space, and four line-termination zones. It has no BOM part ID and must not be interpreted as a pod enclosure. The cable spider remains the primary chassis. The [integrated shell design](camera-pod-enclosure.md) is a bounded ordinary-rain/splash configuration whose complete mass must still satisfy the V1 target and ceiling; it does not redefine the operating weather policy.

Registry ID and design revision: `camera-pod-envelope` `0.1.1`, role `reference`, status `concept-unvalidated`.

## `camera-pod-assembly`

[camera-pod-assembly.scad](camera-pod-assembly.scad) defaults to the integrated enclosure. Set `show_legacy=true` to show the separate historical printed kit; `show_context` applies only to that layout. Set `show_hood=false` to expose the integrated core. Both views use the shared white-shell/black-core palette. It does not prove clearances, mass properties, centre of gravity, or dock capture.

Registry ID and design revision: `camera-pod-assembly` `0.3.5`, role `reference`, status `concept-unvalidated`.

This is the canonical public assembled reference. The former `payload-assembly` and `payload-rain-assembly` public IDs redirect here.
The enclosed geometry now lives in this single entrypoint; the distinct dry bench
layout remains in the unregistered camera-pod bench library.

## `camera-pod-spider`

[camera-pod-spider.scad](camera-pod-spider.scad) provides an X-shaped four-line load-interface concept with endpoint holes, a central service opening, and a pod mounting bolt circle. The model does not define the actual line termination, thimble or knot radius, swivel behavior, powered-line isolation, load distribution, pod attitude, fastener stack, or print/load orientation.

Registry ID and design revision: `camera-pod-spider` `0.1.0`, status `concept-unvalidated`.

Before prototype use, measure the real camera, compute, converter, gimbal, line terminations, connectors, and service clearances. Validate mass, centre of gravity, stiffness, fatigue, dielectric separation, retention, and weather behavior as an assembly.

## Bench mounting parts

The [camera pod mount family](camera-pod-mounts.md) supplies the fixed deck, spider spacers, pan mount, pan yoke, detachable tilt-pivot support, camera cradle, stock-horn retainers, optical hood and electronics cover. The deck and yoke are now r0.1.1; other dry bench parts remain r0.1.0. The [dry bench source](../../lib/camera-pod-bench-assembly.scad) preserves the alternative arrangement; select `show_cover=false` to remove its cover. The registered [camera-pod assembly](camera-pod-assembly.scad) is the integrated enclosure. The [booklets](../../../docs/assemblies/camera-pod/booklet/README.md) publish both configurations using actual fabrication and nominal hardware meshes.

All remain concept-unvalidated. The [7 October CAD checks](camera-pod-geometry-check.md) apply to the current dry configuration with r0.1.1 deck/yoke; the actual servo and power-module dimensions, ribbon, mass and physical performance remain open. The original envelope is a legacy space reservation and is not the bounds of this bench assembly.

## Integrated rain enclosure

The [compact enclosure configuration](camera-pod-enclosure.md) retains the integrated electronics deck r0.1.0, white optical hood r0.1.1, upper rain hood r0.2.1 and uses tray r0.2.3 with a rolled underside shoulder. The compact gimbal uses outer head r0.1.3 with a circular neck, carrier r0.1.1 and new `camera-pod-integrated-camera-cradle` / `camera-pod-integrated-tilt-pivot-support` r0.1.0. A horizontal tilt servo moves the driven interface 2 mm inboard to X=-19.8; the camera tilt axis moves to Y=3, Z=-45. The one-piece outer housing narrows downward around this arrangement; its Ø100 mm upper neck overlaps the fixed Ø103 mm throat with a nominal 1.5 mm radial seam. Reprint the matched tray and outer head; retain the compact carrier, cradle and support and omit the earlier cowl/secondary nuts, retaining four M2 × 12 camera screws, four primary nuts and eight washers. The kit has 13 fabrication models including the optional coupon and 16 installed prints from 12 model types. [camera-pod-assembly.scad](camera-pod-assembly.scad) r0.3.5 is its non-printing reference CSG; [ADR-0009](../../../docs/decisions/0009-compact-integrated-camera-pod.md) records the design direction accepted on merge, with physical validation pending.

The enclosure document owns print counts, colours, captive head clamps, supported assembly/service sequence, harness passages and unresolved fit/rain/thermal/mass acceptance. The [current CAD record](camera-pod-enclosure-check.md) and [machine-readable results](camera-pod-enclosure-check.json) identify passing nominal compact-gimbal motion, taper, service, optical and routing checks. Its 16 installed prints total 253.753 g as a solid-volume PETG estimate at 1.27 g/cm³, before hardware and electronics. Sliced and measured mass, servo torque/settling, received-part fit and rain protection around the camera/CSI loops remain unverified. The shell has no ingress rating; CAD checks do not establish the 170 g complete-pod ceiling or flying operation.
