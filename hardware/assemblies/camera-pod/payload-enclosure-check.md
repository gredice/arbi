# Payload enclosure CAD check — 7 October 2026

## Scope and status

CAD-only inspection and calculation for the [integrated rain enclosure](payload-enclosure.md), with unchanged `camera-pod-spider` r0.1.0, revised `payload-electronics-deck` and `payload-pan-yoke` r0.1.1, five new enclosure models r0.1.0 and the other reused models r0.1.0. All remain **concept-unvalidated**. No physical fit, flexible-harness, powered, rain, thermal or suspended test is claimed.

The [machine-readable record](payload-enclosure-check.json) records exact revisions, source/checker hashes, all 48 mesh SHA256 digests, sampled intersections, service paths, routing/clamp probes and installed-piece volumes. Codex reviewed those reports against the current canonical sources and exported meshes. Received servo/horn, converter/capacitor, connector and fastener dimensions remain unverified.

![Actual assembled CAD preview](../../../docs/assemblies/camera-pod/enclosure/assembled-cad.png)

This is the modeled neutral assembly. The separate [selected appearance concept](../../../docs/assemblies/camera-pod/enclosure/integrated-concept.png) is an illustration, not dimensional or fit evidence.

## Results

| Check | Result |
| --- | --- |
| Model compilation | All 49 registered models compiled with OpenSCAD 2021.01; source proof only. |
| Mesh export | 15 fabrication STLs, including the non-installed fit coupon; 32 nominal stock/hardware references and one power-route proxy. All 48 meshes are closed, consistently wound, positive-volume and single-body. The enclosure installs 18 printed pieces. |
| Neutral assembly | Zero unintended intersections above the 0.005 mm³ numeric threshold. |
| Sampled rigid motion | 555 poses: pan -90…90°, tilt 0…70°, every 5°; zero unintended cross-group intersections. Sampled checking is not continuous proof. |
| Stop controls | Contacts detected at pan -96/+96° and tilt -6/+76°; nominal limits remain ±95° and -5…75°. |
| Assembly/service paths | 20 paths; zero failures. Fairing descent requires pan=45°, tilt=0° and includes the installed boot as an obstacle. Boot and cowl use staged neutral-pose removals. |
| Local tools | 28 driver/socket probes clear at the specified assembly stages; handles and arbitrary wrenches are not represented. |
| Wire ports | Five nominal lead/connector proxies clear; the fixed CSI proxy uses Y=-28 within the deck slot. |
| Fixed power route | Nominal Ø6 mm tube clears 111 poses: pan -90…90° every 5°, tilt 0/35/70°. The deliberately incorrect straight-down route intersects the pan yoke by 75.29455 mm³. |
| Cowl clamp | Four annular probes confirm support contact on existing camera nuts and seating below added rear nuts. Physical nut height, print dimensions and tightening remain unverified. |
| Optical volume | Standard-camera 66° × 41° nominal viewing pyramid to 80 mm clears 15 poses: pan -90/-45/0/45/90°, tilt 0/35/70°. |
| Proud-head control | An intentionally proud retainer head intersects the pan mount by 9.96017 mm³; the checker rejects that substitution. |
| BOM | Canonical inputs are valid and generated reports current; 232 existing procurement incompleteness warnings remain. |

Stock-horn/servo spline and OEM centre-screw/servo threaded engagement are intentional exclusions because the simplified servo has no mating socket/thread. They are not verified supplier fits. Neutral checking covers same-group stacks; the motion grid checks relative motion between rigid groups.

## Harness and service limits

The checked power centreline is `[-8,31,24] → [-8,31,-14] → [16,37,-14] → [16,37,-42] → [16,60,-42]`. The outboard turn is below the fairing tower/fastener and above the pan stops. This rigid tube does not establish real bend radii, sleeves, ties, lead construction or service slack. Separate flexible pan/tilt loops for CSI and servo leads remain physical-inspection work.

The fairing removal test precedes incoming-harness installation. A fitted harness must be isolated and disconnected or have measured slack fed during removal. Cowl service lifts 14 mm then withdraws 45 mm toward -Y; boot service withdraws 20 mm toward -X, lowers 15 mm and continues outward. These paths do not prove service with connected flexible cables. See [assembly instructions](payload-enclosure.md) for the hardware, stages and measurement gates.

## Calculated solid-volume mass

Exported solid volumes are multiplied by **1.27 g/cm³ PETG density**. This is not a slicer estimate or weighed print. Infill, walls, supports, material density and manufacturing behavior change actual mass. The non-installed fit coupon and nominal hardware references are excluded; four spacers and two retainers are included.

| Installed group | Printed pieces | Solid volume (cm³) | Full-solid PETG estimate (g) |
| --- | ---: | ---: | ---: |
| Retained core, with revised deck/yoke | 13 | 109.568 | 139.151 |
| White upper rain hood | 1 | 39.557 | 50.237 |
| Black upper rain tray | 1 | 24.321 | 30.888 |
| Black lower pan fairing | 1 | 17.001 | 21.592 |
| Black tilt-servo boot | 1 | 2.566 | 3.258 |
| White rear camera cowl | 1 | 2.528 | 3.210 |
| **Complete printed configuration** | **18** | **195.540** | **248.336** |

The five new shell parts total **109.185 g** and replace the unchanged dry cover's **24.157 g**, a **85.028 g increase** over the same revised core with that cover. The current dry variant calculates to **163.308 g**; the preserved [28 September record](payload-geometry-check-2026-09-28.md) calculates approximately 164.0 g for its earlier revisions. Values above are independently rounded.

**The full-solid prints alone exceed the 170 g complete-pod ceiling. This revision does not demonstrate flight-mass compliance.** The complete pod still targets 100–120 g and must be weighed with electronics, horns, fasteners, wiring, insulation and retention. The owner's earlier 103.05 g sliced result has unspecified installed quantities/support settings and is not extrapolated to the enclosure. Re-slice the chosen 18-piece kit and weigh the completed assembly.

Neutral represented bounds are approximately **169.08 × 169.08 × 126.02 mm**. Dock clearance, line terminations, centre of gravity, balance and structural load remain unverified.

## Revised dry bench regression

A separate dry run inspected r0.1.1 deck/yoke with the unchanged r0.1.0 cover, spider and other reused parts. Its 41 meshes comprise 11 fabrication models, 29 hardware references and a legacy multi-body keep-out. Neutral checking found zero unintended intersections; all 555 motion poses and four stop controls passed, as did eight service paths, ten tool probes, nine optical poses and the proud-head negative control. This supports nominal compatibility with the dry arrangement, without establishing actual fit or flying mass.

The shared mounts source matches the current SHA256 below. The inspected bench exports are identified separately:

```text
payload-electronics-deck r0.1.1
  bf5fca0872add2edcd497903519474b9d2cb144caea6087be720c2bb52b250e9
payload-pan-yoke r0.1.1
  98c24d2c70623b8330a1170532c315eb20bb46c423d4724b61f0014722a0749b
```

The current bench checker SHA256 is `a479f2757c7a7e9df097641bb0f0abfb6426eeb1f81fbe954b1c5cd9d3e3acb0`. Current source/STL hashes and results are in the [dry bench JSON](payload-geometry-check.json). The [dated historical record](payload-geometry-check-2026-09-28.md) retains the earlier r0.1.0 evidence; the [published booklets](../../../docs/assemblies/camera-pod/booklet/README.md) now use the revised kit.

## Source and mesh audit

All final mesh digests matched the exported files, manifest and machine-readable record. These canonical source files matched the inspected export snapshots byte for byte:

```text
hardware/lib/payload-mounts.scad
  489db6bba746e741d4db140c9d9fe4dc92bec7eca1a35b7b1e2ef19439f96039
hardware/lib/payload-enclosure.scad
  b19d4257581e7e5a7d3d42bc5129a5da677406febba4ad74acbf300bb37534ed
scripts/payload-booklet/integration.py
  6ac209ef141615a0c5fe3735eee3a112600f31c6d00afab9aa3c16f969ea7aa9
scripts/payload-booklet/check_integration.py
  a479f2757c7a7e9df097641bb0f0abfb6426eeb1f81fbe954b1c5cd9d3e3acb0
scripts/payload-booklet/check_service.py
  23fd31c0ef77ae46db5b9fd954096dfe85d34783765eec4249ea95f8e9e19b5e
scripts/payload-booklet/reference-parts.scad
  ee5e874c8549bd9cfe1a63f9a7f43e24769086855f7884d0c2bad390e1fab96c
```

Full fabrication/reference STL digests are retained in [payload-enclosure-check.json](payload-enclosure-check.json). The [published enclosure pack](../../../docs/assemblies/camera-pod/booklet/README.md) contains mesh/assembly/figure manifests and source provenance. The current PDF/ZIP are authorized reviewable snapshots. Loose meshes and bulk renders remain ignored; dated earlier evidence is retained separately.

## Repeat and remaining evidence

```bash
python3 scripts/payload-booklet/build.py --enclosure --output hardware/generated/payload-enclosure
python3 scripts/payload-booklet/build.py --output hardware/generated/payload-bench-regression
pnpm cad:check -- --require-openscad
pnpm bom:check
pnpm docs:check
git diff --check
```

Follow the [pipeline setup](../../../scripts/payload-booklet/README.md). The build rejects failed mesh, rigid, service, tool, port, optical, route, clamp and negative-control checks before packaging. It does not run a physical prototype.

Received-hardware fit, flexible harness/ribbon fatigue, servo torque/settling, electrical isolation and retention, complete mass/balance, thermal load/heat soak, rain/drainage/condensation, UV/creep, load capacity, line interfaces and docking still need measured evidence. The shell has no ingress rating; CAD results do not change the weather policy or flight acceptance gates.
