# Camera pod STL assembly booklet

Build the actual registered printed mounts, simplified purchased hardware, collision-checked assembly, illustrated A4 booklet, and distributable pack.

The bench exporter explicitly selects the shared active models plus the seven archived models marked `alternativeConfiguration: camera-pod-bench`. This is an alternative bench kit, excluded from current pod BOM and individual model downloads. The enclosure variant substitutes the integrated deck, white optical hood, rain hood and black tray, and uses a one-piece outer head with a separate compact carrier, integrated cradle and pivot support. Its tilt servo is horizontal and 2 mm inboard; the camera axis is Y=3, Z=-45, 14 mm higher than the dry arrangement. The head/carrier turn together in pan. The separate camera cowl and four secondary nuts are omitted; the camera uses four M2 × 8 rear screws and four front captive nuts, without camera washers. The compact kit installs 12 prints from 11 model types; its 12 fabrication models include the optional coupon, and the selected hardware references are listed in the mesh manifest. The fixed fairing, servo boot and rear cowl are archived and excluded from both exports. Dry cradle and pivot support are retained only in the explicit bench alternative. Its Pi moves inward, the converter turns 90 degrees, and the capacitor sits alongside it. The separate historical `camera-pod-*` and `camera-gimbal-*` concept kit is archived and excluded from current exports. Model reuse also checks the shared libraries that define the spider and integrated gimbal.

```bash
python3 -m pip install -r scripts/winch-booklet/requirements.txt
python3 scripts/camera-pod-booklet/build.py --output hardware/generated/camera-pod-booklet
python3 scripts/camera-pod-booklet/build.py --enclosure --output hardware/generated/camera-pod-compact-gimbal
```

OpenSCAD must be the registry-pinned 2021.01. VTK 9.5.2 is pinned for rendering. On macOS, its Cocoa backend needs access to a working OpenGL context; a restricted agent may need to run rendering outside the sandbox. The wrapper reuses rendering/layout helper functions from the winch generator and takes a source snapshot. It does not infer fabrication dimensions from illustrations.

`--reuse-models` requires the same variant, matching CAD input hashes and STL hashes, then reruns assembly/service checks and rendering. `--checks-only` exports and checks without rendering a PDF or creating a ZIP. `--publish` copies the PDF and ZIP into the camera-pod documentation folder when a repository snapshot has been requested.

The assembly definition is `integration.py`. `check_integration.py` checks nominal rigid interference through 555 pan/tilt poses and overtravel stops. `check_service.py` checks assembly paths, staged tool access, the nominal viewing volume, and a deliberately incorrect proud-head regression control. The enclosure adds a 111-pose rigid fixed-power-route proxy and an intentionally misplaced central-drop regression control. The compact-gimbal build passes the staged service paths, the tool envelopes, six port/drain envelopes, 15 optical poses and the 111-pose route check, with both negative controls detected. The paths include complete M2 camera bolts and Ø5 mm front washers through optical hood tunnels, head nut/washer preloading, top-down head bolts, lateral pivot-support fitting and removal of the head, camera and carrier. Regenerate these outcomes whenever the selected revisions change; the earlier cowl-based service report does not apply. Both checkers must pass before the PDF is built. For cradle r0.1.1, `check_cradle.py` also verifies the original bounding box, open interfaces and at least 30 mm² through three horn/frame sections; a deliberately thin joint must fail. Its report is included in the enclosure evidence. Print this cradle with the outer horn face on the bed (−90° about Y, then place on bed); inspect remaining bridges and use local supports where needed. See the [cradle record](../../hardware/assemblies/camera-pod/camera-pod-camera-cradle-check.md).

Populate the carrier outside the body and fit the pan OEM centre screw before installing the camera. At the bench, fasten the stock tilt horn and retainer to the separate cradle before engaging the mounted tilt servo; its case blocks the rear retainer driver afterward. Seat the cradle, secure the tilt OEM centre screw, then slide the opposite support inward along -X from 12 mm to its right. Secure the support and existing M3 pivot before fitting the camera; the previous upward support path collides with this geometry. Slide each body M3 nut and lower washer 13 mm outward from its inward-facing opening, raise the body around the complete neutral carrier, and install four M3 x 12 bolts from above before fitting the upper tray and electronics. For service, support the spider and fixed pan mount with a bench fixture, release the harness and remove the upper stack. At neutral, remove the four upper head bolts/washers and lower the body with its captured lower hardware. With the body off, remove the four rear camera screws, then lower the camera/optical hood with its front nuts. There is no separate cowl-removal stage. The open cradle then admits the OEM pan-centre driver and screw removal before lowering the supported carrier from the fixed servo. The report records the parts removed at each stage and checks 80 mm head-bolt and 65 mm pan-centre driver shafts; handles and wrench turning remain unmodeled.

The 6 mm fixed-power proxy runs from `[10,40,24]` down to `[10,40,1]`, outward above the head to `[10,60,1]`, then down to `[10,60,-61]` and out to `[10,70,-61]`. The nominal route clears the upper tray skirt and moving head in the current sampled checks; actual bend radius, sleeves and flexible loops require physical inspection.

Converter envelope and mounting holes use the [12 October received-unit measurements](../../docs/evidence/buck-converter-2026-10-12.md). PCB thickness, component/pad details, fasteners, servo and capacitor geometry remain nominal. `check_converter.py` checks four mounting bores, screw insertion, board removal, driver/pad access and deliberately shifted hole probes. The historical Standard-camera 16-print solid-volume PETG estimate was 254.516 g at 1.27 g/cm³, excluding electronics and hardware. Inspect the slicer output and weigh the complete assembly against the original flying mass ceiling; this estimate is not sliced or measured mass. Omitting the cowl requires new physical rain checks around the camera connector and CSI loops. The booklet is a supported bench assembly guide. Ingress, temperature, flexible-cable movement and suspended operation remain unverified.

Each build records its variant in `configuration.json`, resolves STL revision filenames from the registry, and includes source/STL hashes, mesh/assembly/figure manifests and geometry/service results. Enclosure artifacts use the `ARBI-camera-pod-enclosure` prefix; `--publish` stores separate enclosure snapshots and `camera-pod-enclosure-check.json` alongside the refreshed bench publication. Earlier r0.1.0 bench evidence is retained in dated files and its revision 2 pack remains in Git history. The current palette is documented in [industrial design conventions](../../docs/project/industrial-design.md).

## CI and drawing style

Bench revision 7 and enclosure revision 10 use the shared white-face line-art
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
variants the winch and corner support from fresh CAD exports on relevant pull requests, and all
four on release runs or manual dispatches. PR PDFs/ZIPs are downloadable for 14 days. The
[CAD release workflow](../../.github/workflows/ci.yml) publishes the
four PDF/ZIP pairs with the same commit's STLs and checksums on `main`. CI does
not use `--publish` or rewrite checked-in snapshots/evidence.

```sh
python3 scripts/check-booklet.py hardware/generated/camera-pod-booklet --variant bench
python3 scripts/check-booklet.py hardware/generated/camera-pod-compact-gimbal --variant enclosure
```

These checks verify pagination, configuration/revision labels, registry filenames,
hashes, non-empty figures and paired PDF/ZIP contents. Visually inspect every PDF
page before updating repository snapshots with `--publish`.

See [mount interfaces and quantities](../../hardware/assemblies/camera-pod/camera-pod-mounts.md) and [geometry evidence](../../hardware/assemblies/camera-pod/camera-pod-geometry-check.md).

## Wide camera and open rear hood

The selected module is Camera Module 3 Wide, confirmed by the owner on
12 October 2026. Reprint only P09 integrated hood r0.1.3 and use assembly r0.4.0.
Its low flared walls, 13.6 mm optical opening and open CSI edge give more room
for the repeat insertion failure reported on 14 October. Camera r0.2.0 and the
booklet share `hardware/lib/raspberry-pi-camera-module-3.scad`.

`check_camera_fit.py` checks the installed fit, padded PCB, four guided loading
paths from ±20 degrees, a larger autofocus allowance, front alignment margin,
rear access and previous-hood collision controls. The guided path aligns over
the final 12 mm before seating; it does not certify arbitrary tilted insertion.
`check_service.py` checks camera bolts/washers, cradle insertion and 102° ×67°
Wide optics. Prepare the camera in the loose hood lens-first on the bench,
align the PCB flat on all four seats, connect the ribbon at the open edge,
then clamp the pair to the cradle. Use four M2 ×8 bolts in the recessed cradle, four nuts and eight
washers. Enclosure revision 10 illustrates this sequence; bench revision 7 is
unchanged. [The current fit record](../../docs/evidence/camera-cover-assembly-2026-10-14.md)
distinguishes these nominal checks from the required reprint/received-unit trial.

## Stock fastener revision

[Proposal #225](../../docs/assemblies/camera-pod/fastener-standardization.md) uses M3 × 12/25 on printed joints and M2 × 8 on Pi, converter and camera. The integrated deck replaces four loose spacers. Existing servo-ear and OEM hardware remain. The enclosure build runs `check_fasteners.py` for stock lengths/counts, actual nominal nut engagement, frame/Pi nut preloading, camera rear-head/front-nut access and deliberate M3-through-PCB interference controls. The converter checker uses a gross inward displacement control because the lower frame nuts remove the old X32 interference. Earlier records and bench hardware are retained for their own configurations.
