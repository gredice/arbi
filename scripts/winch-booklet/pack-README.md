# ARBI winch — STL assembly booklet and model pack

Revision 9, 7 October 2026. All dimensions are millimetres. Import the STL files into your slicer or CAD tool in **mm**; STL does not encode units.

Open `ARBI-winch-assembly-STL.pdf` for the 20-page assembly booklet. It covers the passive-line winch, which still uses a motor: two drum sections, a nominal 340 mm shaft and a 550 × 180 × 8 mm aluminium base. The illustrations are rendered from the included STL meshes. Small fasteners are omitted from some overview views for clarity; page 14 gives the fastener quantities.

## Contents

| Path | Contents |
| --- | --- |
| `models/arbi/` | 42 fabrication STLs (including front/rear metal-saddle shapes; do not print those) exported from canonical ARBI OpenSCAD sources |
| `models/reference/` | 44 nominal hardware, base-plate, pole and routing reference STLs for assembly illustrations |
| `source/arbi-hardware/` | ARBI winch CAD snapshot, model registry and existing assembly documentation |
| `source/reference-parts.scad` | Editable reference geometry for purchased parts |
| `source/*.py` | Export, STL rendering and booklet-generation scripts |
| `figures/` | STL-rendered assembly illustrations used by the booklet |
| `*-mesh-manifest.json` | STL filenames, bounds, triangle counts and SHA-256 hashes |
| `figure-manifest.json` | Source STL and placement matrix for every illustrated component |
| `source-snapshot-hashes.json` | Hashes of the bundled ARBI SCAD source files |

The source snapshot is from [gredice/arbi](https://github.com/gredice/arbi). See `source-provenance.json` for the base commit and `source-snapshot-hashes.json` for exact CAD inputs. The source remains canonical. Coupling cover revision 0.1.1 fixes the motor fastener interference. The current full-cover kit is r0.3.0, with reused r0.2.0/r0.1.0 components; see the selective reprint list in the full-cover guide. ARBI source licensing is in `source/LICENSE-ARBI`; the bundled font licence is in `source/fonts/LICENSE.txt`.

## ARBI fabrication parts

Resolve current filenames from `source/arbi-hardware/models.json`: passive left/right and powered right use r0.3.0; the new pole middle/fascia and pole kit use r0.1.0. Other hoods, shutters and clips reuse r0.2.0, the coupling guard r0.1.1, and remaining prints r0.1.0.

| Booklet ID | Filename stem | Quantity for one passive winch |
| --- | --- | ---: |
| P01 | `winch-drum-passive-1` | 1 |
| P02 | `winch-drum-passive-2` | 1 |
| P03 | `winch-drum-flange` | 1 |
| P04 | `winch-drum-flange-right` | 1 |
| P05 | `winch-drum-clamp-half` | 2 |
| P06 | `winch-drum-tail-clamp` | 1 |
| P07 | `winch-drum-alignment-pin` | 3 |
| P08 | `winch-bearing-lower` | 2 |
| P09 | `winch-bearing-cap` | 2 |
| P10 | `winch-motor-stand` | 1 |
| P11 | `winch-coupling-guard` | 1 |
| Optional feet | `winch-desk-foot-short` | 2 |
| Optional feet | `winch-desk-foot-long` | 2 |

The other three fabrication files, `winch-drum-powered-1`, `winch-drum-powered-2` and `winch-drum-powered-3`, are included for the powered variant. They are not used in this booklet. Do not mix passive and powered drum sections. The powered base and shaft arrangement needs separate validation.

See the bundled `source/arbi-hardware/assemblies/winch/` documentation for the design's print settings, materials, geometry checks and desk-foot orientation. Print at 100% scale. The parts retain the source project's concept-unvalidated status; closed mesh validation does not establish physical fit or load capacity.

## Purchased-part and base references

`models/reference/` contains illustrative meshes for the 608 bearings, inner-ring spacers, collars, jaw coupling hubs and spider, motor, shafts, threaded rods, washers, nuts, bolts and both base-plate variants. These are **reference geometry, not printable functional substitutes** for bought hardware or the metal base. Threads and internals are simplified.

The motor model represents the StepperOnline `23HS40-5004D-E1000` in the [4-CLYS30-V20 kit](https://www.omc-stepperonline.com/ys-series-4-axis-closed-loop-stepper-cnc-kit-v2-0-3-00nm-424-83oz-in-nema-23-motor-w-2-0m-cables-power-supply-4-clys30-v20). Its 57 × 57 mm frame, 122 mm body, 8 mm shaft diameter, 22 mm shaft projection and 15 mm D-flat length follow the supplier listing checked on 27 September 2026. The supplier STEP download was unavailable. Mounting pitch, pilot details and fastener holes use the current ARBI CAD assumptions and must be checked against the received motor. The exact motor-to-stand bolts are therefore left hardware-dependent in the booklet.

Collar outlines and coupling teeth are nominal, based on the current CAD envelope. The booklet's 5 mm shaft-tip gap and hub engagement are a nominal arrangement within that envelope, not a substitute for the actual coupling supplier's installation dimensions. The base-plate STLs are exported from the ARBI `wm_base()` CAD module. The bundled `passive-base-drilling-A4.pdf` is the separate full-size drilling template; the booklet's illustrations are not drilling templates.

## Revised coupling cover

Reprint `winch-coupling-guard-r0.1.1.stl` only. The same motor stand, mounting pattern and M4 cover screws remain compatible. The wider motor end clears a 12 mm diameter motor-fastener envelope projecting at most 14 mm from the coupling-side stand face, plus 1 mm clearance and the full +/-2 mm slot adjustment. Count nuts, washers and screw tips in that envelope. The rear walls are 3 mm thick; the original front shell remains 4 mm. Use 9 mm OD M4 cover washers. A physical fit check is still required.

## Assembly corrections

- The drum sections show the actual helical groove, hollow body and three internal ribs.
- Left and right flanges use the distinct source meshes and correct assembly orientation.
- There is one alignment pin at each of three joints, with the asymmetric tie-rod pattern preserved.
- The right-flange clamp screws are installed before closing the drum, and the split clamp is tightened in the documented order.
- Bearing lowers, caps, inner-ring spacers, collars and motor stand match the source models and their assembly locations.
- The coupling, line-tail routing and optional four desk feet have dedicated views.

## Rebuilding the pack

Requirements: OpenSCAD **2021.01**, Python 3.12 or compatible, and the dependencies in `source/requirements.txt` (including VTK **9.5.2**). A working VTK OpenGL/EGL/OSMesa rendering backend is needed for the illustrations. This pack was rendered using EGL.

Run from this directory:

```sh
python3 -m pip install -r source/requirements.txt
python3 source/export_arbi.py
python3 source/export_reference.py
python3 source/check-winch-cover-meshes.py models/arbi --record full-cover-check.json
python3 source/check-winch-pole-meshes.py models/arbi --record round-pole-check.json
python3 source/render_figures.py
python3 source/build_booklet.py
```

Export scripts check closed surfaces, consistent triangle winding, positive volume and one connected mesh body. All 86 supplied STL files passed those checks, and their file hashes were checked against the manifests. All PDF pages were rendered and visually reviewed. A physical assembly or load test has not been performed.

To change text or layout while keeping the supplied figures, run only the final command. To revise a purchased-part approximation, edit `source/reference-parts.scad`, export the reference meshes, then rerender and rebuild. Update the illustrations and manifests together when changing model geometry or placement.

Appearance: rounded white full-cover panels and removable payout shutters over the charcoal core. Full-cover r0.3.0 requires extra base holes but no drivetrain reprints. See pages 15-20 and source/arbi-hardware/assemblies/winch/full-cover.md for passive/powered counts, fasteners, post orientation and service. Remove +Y shutters first, then lift main panels +Z from left to right; refit main panels right to left and shutters last. Physical fit, heat, weather, safe guarding and powered slip-ring/harness integration remain unverified.

The base-plate-*-covered references include the additional shell/anchor holes.
The older passive drilling template omits them. New fabrication IDs: variant
left/middle/right main panels, powered transition panel, variant payout shutter, identical clip and cable
anchor. Per passive kit: 3 main panels, 2 shutters, 12 clips, 1 anchor. Per powered:
5 main panels (left, index-1 pole middle, index-2 plain middle, index-3 transition, right),
4 shutters, 20 clips, 1 anchor. The transition's payout aperture stops at X=580.3
mm; substituting a third middle would leave the bearing/coupling wall open.
The cable anchor remains r0.1.0. Common fascia strips, rear-left/right shields, bench blank and new lower pole fascia are r0.1.0; the full-cover guide lists selective r0.3.0 replacements. Remove fascia and rear shields before any shell screw. See booklet page 19 for quantities, post opening and release sequence. Key retention requires physical testing.

The near-motor CL57Y driver is not represented by the mechanical CAD or contained
in this shell. Its protected mounting/enclosure remains corner-station electrical
work; no completed driver enclosure is inferred by this pack.

## Round pole and bottom looms - revision 9

The current r0.3.0 cover layout replaces the right-end loom ports with two lower apertures beside the pole. Replace the passive left/right and powered right, use the powered pole middle at index 1 and plain middle at index 2, and fit one lower pole fascia per winch. Reuse the other hoods, shutters and clips. Move the independent anchor to X=W/2+60, Y=-60 and add its new hole pair. Closed apertures require releasing/disconnecting fixed looms before removing the lower pole fascia/hood.

The round-pole kit has two metal front and two metal rear saddles, two printed rear nut covers, two underside closures and one non-structural two-loom guide. Default timber diameter is 120 mm; matching parameter studies are 100/120/140 mm. **Do not print the metal saddles.** The supplied default geometry is a machining envelope, not a load-rated manufacturing drawing. Confirm received bolt stacks, timber shape, material, cap/guide fit and structural capacity. Full details and records are in the bundled round-pole.md and round-pole-check.json. Do not combine the round and flat mounting stacks.
