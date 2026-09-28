# Payload STL assembly booklet

Build the actual registered printed mounts, simplified purchased hardware, collision-checked assembly, illustrated A4 booklet, and distributable pack.

```bash
python3 -m pip install -r scripts/winch-booklet/requirements.txt
python3 scripts/payload-booklet/build.py --output hardware/generated/payload-booklet
```

OpenSCAD must be the registry-pinned 2021.01. VTK 9.5.2 supports headless rendering in the working environment. The wrapper reuses rendering/layout helper functions from the winch generator and takes a source snapshot. It does not infer fabrication dimensions from illustrations.

`--reuse-models` requires matching CAD input hashes and STL hashes, then reruns assembly/service checks and rendering. `--publish` copies the PDF and ZIP into the camera-pod documentation folder when a repository snapshot has been requested.

The assembly definition is `integration.py`. `check_integration.py` checks nominal rigid interference through 555 pan/tilt poses and overtravel stops. `check_service.py` checks assembly paths, local short-driver access, the nominal viewing volume, and a deliberately incorrect proud-head regression control. Both must pass before the PDF is built.

Servo and power-module geometry remain provisional. The full-solid printed mass is too high to demonstrate the original flying mass ceiling. The booklet is a bench assembly guide, not a suspended-operation approval.

See [mount interfaces and quantities](../../hardware/assemblies/camera-pod/payload-mounts.md) and [geometry evidence](../../hardware/assemblies/camera-pod/payload-geometry-check.md).
