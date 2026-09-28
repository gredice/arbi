# Camera pod OpenSCAD sources

System context: [Camera pod assembly documentation](../../../docs/assemblies/camera-pod/README.md).

## `camera-pod-envelope`

[camera-pod-envelope.scad](camera-pod-envelope.scad) is a **non-manufacturing keep-out reference** for the fixed component volume, gimbal sweep, docking interface, rear service space, and four line-termination zones. It is exported as CSG rather than STL, has no BOM part ID, and must not be interpreted as a pod enclosure. V1 deliberately avoids a heavy pod enclosure; the cable spider is the primary chassis and only lightweight rain/optical protection is expected.

Registry ID and design revision: `camera-pod-envelope` `0.1.0`, role `reference`, status `concept-unvalidated`.

## `camera-pod-spider`

[camera-pod-spider.scad](camera-pod-spider.scad) provides an X-shaped four-line load-interface concept with endpoint holes, a central service opening, and a pod mounting bolt circle. The model does not define the actual line termination, thimble or knot radius, swivel behavior, powered-line isolation, load distribution, pod attitude, fastener stack, or print/load orientation.

Registry ID and design revision: `camera-pod-spider` `0.1.0`, status `concept-unvalidated`.

Before prototype use, measure the real camera, compute, converter, gimbal, line terminations, connectors, and service clearances. Validate mass, centre of gravity, stiffness, fatigue, dielectric separation, retention, and weather behavior as an assembly.

## Bench mounting parts

The [payload mount set r0.1.0](payload-mounts.md) now supplies the fixed deck, spider spacers, pan mount, pan yoke, detachable tilt-pivot support, camera cradle, stock-horn retainers, optical hood and electronics cover. The [assembled reference](payload-assembly.scad) shows printed parts in their assembled positions. The [booklet](../../../docs/assemblies/camera-pod/booklet/README.md) uses the actual fabrication and nominal hardware meshes.

All remain concept-unvalidated. [CAD checks](payload-geometry-check.md) cover represented geometry only; the actual servo and power-module dimensions, ribbon, mass and physical performance remain open. The original envelope is a legacy space reservation and is not the bounds of this new bench assembly.
