# Payload mount geometry check — 7 October 2026

## Scope and status

CAD-only inspection of the **dry bench mount set with r0.1.1 deck/yoke and remaining prints r0.1.0** with the unchanged **camera-pod-spider r0.1.0**. The source is `hardware/lib/payload-mounts.scad`; the exact assembly transforms and nominal hardware are in `scripts/payload-booklet/integration.py` and `reference-parts.scad`. All fabrication models remain **concept-unvalidated**. No physical fit, powered test or suspended test is claimed.

[Machine-readable results](payload-geometry-check.json) record intersections, source hashes, service paths, tool envelopes, optical checks and calculated solid volume. [Mount interfaces](payload-mounts.md) record the provisional dimensions and required quantities. The downloadable pack contains the full mesh and figure manifests.

This current record supersedes the [28 September r0.1.0 record](payload-geometry-check-2026-09-28.md). That dated record and its separate JSON are retained; the earlier revision 2 pack remains in Git history. The integrated enclosure has [separate evidence](payload-enclosure-check.md) and its own print list.

## Results

| Check | Result |
| --- | --- |
| Mesh export | 11 fabrication + 29 nominal hardware + one legacy keep-out; closed, positive-volume, consistent winding. Fabrication/hardware files each contain one connected body. |
| Neutral assembled pose | No unintended solid intersections above 0.005 mm³ numeric tolerance, including screws, washers, nuts and converter/capacitor ties. |
| Sampled motion | 555 combinations: pan -90…90° and tilt 0…70°, both at 5° increments. No unintended rigid intersections. This is a sampled check, not continuous mathematical proof. |
| Hard stops | Contact is detected at pan -96/+96° and tilt -6/+76°. Nominal first-contact design angles are -95/+95° and -5/+75°. |
| Service paths | Pan and tilt servo insertion, camera/hood insertion, vertical cover removal, cradle seating with opposite support removed, pivot-nut top insertion, and removable support installation pass the represented paths. |
| Local tool access | 15 mm straight tips, Ø2 mm for retainers/camera and Ø2.5 mm for OEM centre access, clear the represented parts at the specified assembly stage. Handles and arbitrary wrenches are not modeled. |
| Optical opening | Camera Standard 66° horizontal × 41° vertical nominal viewing volume to 80 mm clears represented solids at nine pan/tilt combinations: pan -90/0/90°, tilt 0/35/70°. |
| Regression control | An intentionally proud retainer screw head produces a collision at pan 90°. The check rejects substitution of ordinary proud heads for the specified recessed screws. |

### Interferences corrected during design

- Rear camera-connector interference with the initial circular supports: relieved the connector envelope while retaining outside support lands.
- Pivot washer/stop-tab overlap: relieved the inner end of the moving stop tab.
- Pivot nut embedded in the carrier: added a hex pocket with top insertion access.
- Servo-ear and horn-retainer hardware collisions during rotation: specified recessed countersunk screws, moved servo nuts to the outer side of the ears, and checked the full sampled range again.
- Unavailable lateral horn-screw access and blocked spline engagement: offset the camera by 5 mm, added a driver bore, and made the opposite pivot support removable.

The spline/stock-horn and OEM centre-screw/servo engagement pairs are intentional exclusions because the simplified servo model has no internal spline socket or thread. Do not interpret those exclusions as a verified supplier fit.

## Nominal clearances

- Servo body windows: +0.8 mm total in each transverse dimension, 0.4 mm per side.
- Fully seated horn retainers to servo body / mounting plate: approximately 1 mm axial gap; depends on flush countersunk heads.
- Camera rear connector relief: approximately 0.4 mm around the represented connector outline.
- Electronics cover roof: approximately 4.2 mm above the represented tallest Pi/power component.
- M4 frame screw tip below Pi underside: approximately 2.8 mm with the listed M4 x 35 stack.
- Tilt pivot: Ø3.3 printed bore around nominal Ø3 screw; 0.7 mm side gap with a matching shim. This requires adjustment for low friction and physical wear/creep testing.

## Mass and envelope limitation

The complete printed assembly, including the original spider and removable cover, has a calculated **163.308 g full-solid PETG mass at an assumed 1.27 g/cm³**. This excludes electronics, ties and steel hardware. It therefore **does not demonstrate the 170 g complete flying limit**. Infill changes the result, but many thin parts remain effectively solid; weigh the sliced and built configuration. Use this revision for bench fit/assembly work. A lighter chassis/cover and a complete mass/balance check are needed before suspension.

The neutral assembled bounds including nominal hardware are approximately **169.08 × 169.08 × 126.02 mm**. The old `camera-pod-envelope` is a legacy reservation in a different layout convention; it is not treated as proof that this new bench assembly fits the former reserved zones. Dock and line integration remain open.

## Repeat

Run the following commands against current canonical CAD to reproduce this revised dry bench configuration. Use the separately dated source/evidence record when reproducing the earlier r0.1.0 kit.

```bash
python3 scripts/payload-booklet/build.py --output hardware/generated/payload-booklet
pnpm cad:check -- --require-openscad
pnpm bom:generate
pnpm bom:check
pnpm docs:check
```

The build rejects invalid meshes, failed rigid/service checks or a missing regression collision before producing the booklet. Print shrinkage, actual servo/horn/connector dimensions, cable bend radius, lead exits, servo voltage/torque/travel, power performance, line terminations, docking, rain exposure, load capacity and fatigue still need measurement and physical evidence.
