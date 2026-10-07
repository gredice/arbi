# Payload STL assembly booklet

Build the actual registered printed mounts, simplified purchased hardware, collision-checked assembly, illustrated A4 booklet, and distributable pack.

The default bench exporter selects the shared `camera-pod-spider` and the `payload-*` fabrication models for this bench arrangement. The enclosure variant replaces the bench electronics cover with the white rain hood and adds a black lower tray, removable pan fairing and servo boot, plus a white rear camera cowl. The separate `camera-pod-*` and `camera-gimbal-*` concept kit remains registered but is not included in this booklet. Model reuse also checks the shared camera-pod library that defines the spider.

```bash
python3 -m pip install -r scripts/winch-booklet/requirements.txt
python3 scripts/payload-booklet/build.py --output hardware/generated/payload-booklet
python3 scripts/payload-booklet/build.py --enclosure --output hardware/generated/payload-enclosure
```

OpenSCAD must be the registry-pinned 2021.01. VTK 9.5.2 is pinned for rendering. On macOS, its Cocoa backend needs access to a working OpenGL context; a restricted agent may need to run rendering outside the sandbox. The wrapper reuses rendering/layout helper functions from the winch generator and takes a source snapshot. It does not infer fabrication dimensions from illustrations.

`--reuse-models` requires the same variant, matching CAD input hashes and STL hashes, then reruns assembly/service checks and rendering. `--checks-only` exports and checks without rendering a PDF or creating a ZIP. `--publish` copies the PDF and ZIP into the camera-pod documentation folder when a repository snapshot has been requested.

The assembly definition is `integration.py`. `check_integration.py` checks nominal rigid interference through 555 pan/tilt poses and overtravel stops. `check_service.py` checks assembly paths, local short-driver access, the nominal viewing volume, and a deliberately incorrect proud-head regression control. The enclosure adds a 111-pose rigid fixed-power-route proxy and an intentionally incorrect straight-route regression control, plus hood/captive-nut, tray/fairing, boot and cowl service paths, local fastener-tool access and nominal downward power/CSI/servo lead-envelope checks. Both checkers must pass before the PDF is built.

Servo and power-module geometry remain provisional. The full-solid printed mass is too high to demonstrate the original flying mass ceiling. The booklet is a supported bench assembly guide. Ingress, temperature, flexible-cable movement and suspended operation remain unverified.

Each build records its variant in `configuration.json`, resolves STL revision filenames from the registry, and includes source/STL hashes, mesh/assembly/figure manifests and geometry/service results. Enclosure artifacts use the `ARBI-payload-enclosure` prefix; `--publish` stores separate enclosure snapshots and `payload-enclosure-check.json` without replacing the original dated bench evidence.

See [mount interfaces and quantities](../../hardware/assemblies/camera-pod/payload-mounts.md) and [geometry evidence](../../hardware/assemblies/camera-pod/payload-geometry-check.md).
