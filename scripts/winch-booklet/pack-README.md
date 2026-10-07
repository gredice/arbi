# ARBI winch — STL assembly booklet and model pack

Revision 5, 7 October 2026. All dimensions are millimetres. Import the STL files into your slicer or CAD tool in **mm**; STL does not encode units.

Open `ARBI-winch-assembly-STL.pdf` for the 18-page assembly booklet. It covers the passive-line winch, which still uses a motor: two drum sections, a nominal 340 mm shaft and a 550 × 180 × 8 mm aluminium base. The illustrations are rendered from the included STL meshes. Small fasteners are omitted from some overview views for clarity; page 14 gives the fastener quantities.

## Contents

| Path | Contents |
| --- | --- |
| `models/arbi/` | 26 fabrication STLs exported from canonical ARBI OpenSCAD sources |
| `models/reference/` | 35 nominal hardware, base-plate and routing reference STLs for assembly illustrations |
| `source/arbi-hardware/` | ARBI winch CAD snapshot, model registry and existing assembly documentation |
| `source/reference-parts.scad` | Editable reference geometry for purchased parts |
| `source/*.py` | Export, STL rendering and booklet-generation scripts |
| `figures/` | STL-rendered assembly illustrations used by the booklet |
| `*-mesh-manifest.json` | STL filenames, bounds, triangle counts and SHA-256 hashes |
| `figure-manifest.json` | Source STL and placement matrix for every illustrated component |
| `source-snapshot-hashes.json` | Hashes of the bundled ARBI SCAD source files |

The source snapshot is from [gredice/arbi](https://github.com/gredice/arbi). See `source-provenance.json` for the base commit and `source-snapshot-hashes.json` for exact CAD inputs. The source remains canonical. Cover revision 0.1.1 fixes the motor fastener interference; other fabrication models remain 0.1.0. ARBI source licensing is in `source/LICENSE-ARBI`; the bundled font licence is in `source/fonts/LICENSE.txt`.

## Printable ARBI parts

Every filename below is in `models/arbi/` and ends with `-r0.1.0.stl`, except the revised coupling cover, which ends with `-r0.1.1.stl`.

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
python3 source/render_figures.py
python3 source/build_booklet.py
```

Export scripts check closed surfaces, consistent triangle winding, positive volume and one connected mesh body. All 61 supplied STL files passed those checks, and their file hashes were checked against the manifests. All PDF pages were rendered and visually reviewed. A physical assembly or load test has not been performed.

To change text or layout while keeping the supplied figures, run only the final command. To revise a purchased-part approximation, edit `source/reference-parts.scad`, export the reference meshes, then rerender and rebuild. Update the illustrations and manifests together when changing model geometry or placement.

Appearance: rounded white full-cover panels and removable payout shutters over the charcoal core. Full-cover r0.1.0 requires extra base holes but no drivetrain reprints. See pages 15-18 and source/arbi-hardware/assemblies/winch/full-cover.md for passive/powered counts, fasteners, post orientation and service. Remove +Y shutters first, then lift main panels +Z from left to right; refit main panels right to left and shutters last. Physical fit, heat, weather, safe guarding and powered slip-ring/harness integration remain unverified.

The base-plate-*-covered references include the additional shell/anchor holes.
The older passive drilling template omits them. New fabrication IDs: variant
left/middle/right main panels, variant payout shutter, identical clip and cable
anchor. Per passive kit: 3 main panels, 2 shutters, 12 clips, 1 anchor. Per powered:
5 main panels (3 middles), 4 shutters, 20 clips, 1 anchor. All are r0.1.0.
