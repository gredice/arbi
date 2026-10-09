# Reinforced compact camera cradle — 9 October 2026

The owner reported that removing support under the large bridge broke the two connections between the camera frame and upright horn plate in cradle r0.1.0. This is a reported prototype failure; material, slicer settings, print orientation and breaking force were not supplied. Cradle **r0.1.1** addresses that junction while retaining **concept-unvalidated** status. The [8 October enclosure record](camera-pod-enclosure-check.md) remains a snapshot of the earlier r0.1.0 cradle.

## Geometry and printing

Two broad ties, two 45-degree back ribs and a sloped web spread the plate/frame connection. The existing frame, camera bolt pattern, horn pocket and retainer, central driver passage, opposite pivot and fasteners are retained. Camera screw bores and rear washer/socket reliefs are recut through the added rib feet. No added part or fastener is required.

The outer envelope remains **41.6 × 32 × 25 mm**. The [machine-readable record](camera-pod-camera-cradle-check.json) records the actual section areas and solid-volume change, source and mesh hashes, assembly/service outcomes and the deliberately weakened-joint control. The three measured sections increase from 14.453 mm² to 69.058–73.708 mm² (4.78–5.10 times the former section). Solid volume increases from 3.191199 to 3.328264 cm³ (+0.137065 cm³, +0.174 g full-solid PETG at 1.27 g/cm³). The 16 installed prints total 253.927 g on the same basis. These are CAD calculations, not sliced or measured mass.

Section area is geometry evidence; it does not establish a proportional increase in breaking force.

Use the [horn-face-down orientation and starting print settings](camera-pod-enclosure.md#reinforced-cradle-and-print-orientation). The sloped web supports the first layers of the long edge when printed from the horn face, reducing the need for a large support block attached at the junction. Remaining bridges, pockets, standoffs and the pivot tab still need slicer inspection and possibly local supports. Four walls with a 0.4 mm nozzle and 0.2 mm layers are starting settings. Cut supports away in small pieces while supporting the nearby frame.

## Nominal validation

The record is produced from pinned OpenSCAD 2021.01 exports and the existing enclosure motion/service checkers. The dedicated [cradle checker](../../../scripts/camera-pod-booklet/check_cradle.py) inspects a single connected watertight solid, the unchanged bounding box, open camera/horn/service interfaces and three thin sections through the joint. It requires at least 30 mm² at each section and must reject a deliberately restored narrow neck. An independently exported r0.1.0 mesh is also checked as a failing baseline.

The full assembly checks retain their existing 0.005 mm³ contact tolerance and exclusions. All 80 registered entrypoints compiled locally after the camera-pod naming migration. The final cradle was re-exported after recutting its camera bores. The revised assembly passes 555 motion poses, all four overtravel stop controls, 30 service paths, 22 tool probes, 15 optical poses and 111 fixed power-route poses, with zero unintended collisions. Both existing negative controls and the new weak-joint control are detected; no collision tolerance is relaxed for this change.

```sh
pnpm cad:check -- --require-openscad
python3 scripts/camera-pod-booklet/build.py --enclosure --checks-only --output hardware/generated/cradle-enclosure
python3 hardware/generated/cradle-enclosure/source/check_cradle.py
pnpm bom:generate
pnpm bom:check
pnpm docs:check
git diff --check
```

For the optional baseline comparison, export r0.1.0 from commit `84f3b52` in an isolated checkout and pass its canonical-coordinate STL to `check_cradle.py --baseline PATH`. Generated geometry stays outside Git. Current CI builds the revised booklet and CAD pack; earlier checked-in PDFs and previews remain dated snapshots.

## Physical acceptance still required

Reprint r0.1.1 and record material, orientation, layer height, nozzle, wall count and support settings. Inspect support removal, cracks and layer adhesion; measure the real camera, horn, washers and nuts; check free travel with the actual harness and repeat handling. Strength, fatigue, creep and received-part fit remain unverified. The full-pod mass and suspended-operation limits remain those of the enclosure documentation.
