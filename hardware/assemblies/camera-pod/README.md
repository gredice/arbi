# Camera pod OpenSCAD sources

System context: [Camera pod assembly documentation](../../../docs/assemblies/camera-pod/README.md).
Shared parameters live in [the camera-pod library](../../lib/camera-pod.scad).

The payload family now contains individual **concept-unvalidated fabrication models** plus two CSG references. No part has been printed, weighed, or fitted to the purchased Pi, camera, servos, converter, or line hardware. ASA remains the preferred exposed-release material; PETG is acceptable only for prototypes pending creep and weather evidence.

## Print list

One BOM `camera-pod-chassis` plus one `camera-gimbal` means one flying-pod printed kit.

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

Printable parts use Z=0 as the bed plane except the spider, which remains centred as in revision 0.1.0. The assembly reference rotates the gimbal group 180° about X so the pan servo hangs downward. Set `show_context=true` in [camera-pod-assembly.scad](camera-pod-assembly.scad) to ghost a Pi board outline; that box is not a measured keep-out.

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

[camera-pod-envelope.scad](camera-pod-envelope.scad) is a keep-out for the fixed component volume, gimbal sweep, docking interface, rear service space, and four line-termination zones. It has no BOM part ID and must not be interpreted as a pod enclosure. V1 deliberately avoids a heavy pod enclosure; the cable spider is the primary chassis and only lightweight rain/optical protection is expected.

Registry ID and design revision: `camera-pod-envelope` `0.1.0`, role `reference`, status `concept-unvalidated`.

## `camera-pod-assembly`

[camera-pod-assembly.scad](camera-pod-assembly.scad) stacks the printed kit in a concept layout. It does not prove clearances, mass properties, centre of gravity, or dock capture.

Registry ID and design revision: `camera-pod-assembly` `0.1.0`, role `reference`, status `concept-unvalidated`.

## `camera-pod-spider`

[camera-pod-spider.scad](camera-pod-spider.scad) provides an X-shaped four-line load-interface concept with endpoint holes, a central service opening, and a pod mounting bolt circle. The model does not define the actual line termination, thimble or knot radius, swivel behavior, powered-line isolation, load distribution, pod attitude, fastener stack, or print/load orientation.

Registry ID and design revision: `camera-pod-spider` `0.1.0`, status `concept-unvalidated`.

Before prototype use, measure the real camera, compute, converter, gimbal, line terminations, connectors, and service clearances. Validate mass, centre of gravity, stiffness, fatigue, dielectric separation, retention, and weather behavior as an assembly.
