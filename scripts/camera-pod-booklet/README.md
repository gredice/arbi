# Camera pod STL assembly booklet

Build the actual registered printed mounts, simplified purchased hardware, collision-checked assembly, illustrated A4 booklet, and distributable pack.

The bench exporter explicitly selects the shared active models plus the six archived models marked `alternativeConfiguration: camera-pod-bench`. This is an alternative bench kit, excluded from current pod BOM and individual model downloads. The enclosure variant substitutes the integrated deck, white optical hood, rain hood and black tray, and uses a one-piece outer head with a separate compact carrier, integrated cradle and pivot support. Its tilt servo is horizontal and 2 mm inboard; the camera axis is Y=3, Z=-45, 14 mm higher than the dry arrangement. The head/carrier turn together in pan. The separate camera cowl and four secondary nuts are omitted; the camera uses four M2 × 12 screws, four primary nuts and eight washers. The compact kit installs 16 prints from 12 model types and exports 44 meshes: 13 fabrication models including the optional coupon, 30 nominal hardware references and one routing proxy. The fixed fairing, servo boot and rear cowl are archived and excluded from both exports. Dry cradle and pivot support are retained only in the explicit bench alternative. Its Pi moves inward, the converter turns 90 degrees, and the capacitor sits alongside it. The separate historical `camera-pod-*` and `camera-gimbal-*` concept kit is archived and excluded from current exports. Model reuse also checks the shared libraries that define the spider and integrated gimbal.

```bash
python3 -m pip install -r scripts/winch-booklet/requirements.txt
python3 scripts/camera-pod-booklet/build.py --output hardware/generated/camera-pod-booklet
python3 scripts/camera-pod-booklet/build.py --enclosure --output hardware/generated/camera-pod-compact-gimbal
```

OpenSCAD must be the registry-pinned 2021.01. VTK 9.5.2 is pinned for rendering. On macOS, its Cocoa backend needs access to a working OpenGL context; a restricted agent may need to run rendering outside the sandbox. The wrapper reuses rendering/layout helper functions from the winch generator and takes a source snapshot. It does not infer fabrication dimensions from illustrations.

`--reuse-models` requires the same variant, matching CAD input hashes and STL hashes, then reruns assembly/service checks and rendering. `--checks-only` exports and checks without rendering a PDF or creating a ZIP. `--publish` copies the PDF and ZIP into the camera-pod documentation folder when a repository snapshot has been requested.

The assembly definition is `integration.py`. `check_integration.py` checks nominal rigid interference through 555 pan/tilt poses and overtravel stops. `check_service.py` checks assembly paths, staged tool access, the nominal viewing volume, and a deliberately incorrect proud-head regression control. The enclosure adds a 111-pose rigid fixed-power-route proxy and an intentionally misplaced central-drop regression control. The compact-gimbal build passes 30 service paths, 22 tool envelopes, six port/drain envelopes, 15 optical poses and the 111-pose route check, with both negative controls detected. The paths include complete M2 camera bolts and Ø5 mm front washers through optical hood tunnels, head nut/washer preloading, top-down head bolts, lateral pivot-support fitting and removal of the head, camera and carrier. Regenerate these outcomes whenever the selected revisions change; the earlier cowl-based service report does not apply. Both checkers must pass before the PDF is built.

Populate the carrier outside the body and fit the pan OEM centre screw before installing the camera. At the bench, fasten the stock tilt horn and retainer to the separate cradle before engaging the mounted tilt servo; its case blocks the rear retainer driver afterward. Seat the cradle, secure the tilt OEM centre screw, then slide the opposite support inward along -X from 12 mm to its right. Secure the support and existing M3 pivot before fitting the camera; the previous upward support path collides with this geometry. Slide each body M2 nut and lower washer 11 mm outward from its inward-facing opening, raise the body around the complete neutral carrier, and install four M2 x 10 bolts from above before fitting the upper tray and electronics. For service, support the spider and fixed pan mount with a bench fixture, release the harness and remove the upper stack. At neutral, remove the four upper head bolts/washers and lower the body with its captured lower hardware. With the body off, remove the four rear camera nuts/back washers, then lower the camera/optical hood and front fasteners. There is no separate cowl-removal stage. The open cradle then admits the OEM pan-centre driver and screw removal before lowering the supported carrier from the fixed servo. The report records the parts removed at each stage and checks 80 mm head-bolt and 65 mm pan-centre driver shafts; handles and wrench turning remain unmodeled.

The 6 mm fixed-power proxy runs from `[10,40,24]` down to `[10,40,1]`, outward above the head to `[10,60,1]`, then down to `[10,60,-61]` and out to `[10,70,-61]`. The nominal route clears the upper tray skirt and moving head in the current sampled checks; actual bend radius, sleeves and flexible loops require physical inspection.

Servo and power-module geometry remain provisional. The current 16-print solid-volume PETG estimate is 253.753 g at 1.27 g/cm³, excluding electronics and hardware. Inspect the slicer output and weigh the complete assembly against the original flying mass ceiling; this estimate is not sliced or measured mass. Omitting the cowl requires new physical rain checks around the camera connector and CSI loops. The booklet is a supported bench assembly guide. Ingress, temperature, flexible-cable movement and suspended operation remain unverified.

Each build records its variant in `configuration.json`, resolves STL revision filenames from the registry, and includes source/STL hashes, mesh/assembly/figure manifests and geometry/service results. Enclosure artifacts use the `ARBI-camera-pod-enclosure` prefix; `--publish` stores separate enclosure snapshots and `camera-pod-enclosure-check.json` alongside the refreshed bench publication. Earlier r0.1.0 bench evidence is retained in dated files and its revision 2 pack remains in Git history. The current palette is documented in [industrial design conventions](../../docs/project/industrial-design.md).

## CI and drawing style

Bench revision 4 and enclosure revision 5 use the shared white-face line-art
renderer. Visible silhouettes and feature edges make dark cores, small brackets
and hardware readable; the GLB and manifests keep the product palette. Each
configuration has its own header and page total (14 bench, 16 enclosure).

The `overview-exploded` figure separates the whole assembly layer by layer along the spider axis. The compact outer head and its fasteners have a separate layer from the internal carrier; its opposite support separates laterally to the right. The dry variant retains its existing exploded layout. The overview is not placed in the PDF. Its transforms in `figure-manifest.json` are the exploded pose used by the public site (`apps/arbi-docs`).

The enclosure also includes product-color views rendered by `render_preview.py`
from the same CAD meshes. `product-hero` and `product-front` use tilt 70 degrees
to show the optical face. `product-eye-aligned` uses the same pose and looks
along the actual lens axis, retaining the full assembly and its possible
occlusions. `product-neutral`, `assembled-neutral` and the GLB retain tilt 0,
with the camera pointing down; the booklet's line-art `assembled-covered`
remains at tilt 55. `product-electronics` shows the roof removed. `product-underside` and `product-bottom` show the operated underside at neutral; `product-underside-pan90` shows its seam at pan 90 degrees. The tray/head neck check measures actual horizontal STL segments through their 2 mm overlap, bounds clearance for every pan angle, and detects an oversized-neck collision control.
`preview-manifest.json` records each product view's pan/tilt angles, viewing
direction and part transforms separately from the booklet's grayscale
`figure-manifest.json`.

[Booklet jobs in CI](../../.github/workflows/ci.yml) build and check affected camera pod
variants and the winch from fresh CAD exports on relevant pull requests, and all
three on release runs or manual dispatches. PR PDFs/ZIPs are downloadable for 14 days. The
[CAD release workflow](../../.github/workflows/ci.yml) publishes the
three PDF/ZIP pairs with the same commit's STLs and checksums on `main`. CI does
not use `--publish` or rewrite checked-in snapshots/evidence.

```sh
python3 scripts/check-booklet.py hardware/generated/camera-pod-booklet --variant bench
python3 scripts/check-booklet.py hardware/generated/camera-pod-compact-gimbal --variant enclosure
```

These checks verify pagination, configuration/revision labels, registry filenames,
hashes, non-empty figures and paired PDF/ZIP contents. Visually inspect every PDF
page before updating repository snapshots with `--publish`.

See [mount interfaces and quantities](../../hardware/assemblies/camera-pod/camera-pod-mounts.md) and [geometry evidence](../../hardware/assemblies/camera-pod/camera-pod-geometry-check.md).
