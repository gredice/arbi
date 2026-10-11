# Calibrated image processing source adapter

Work record: [#58](https://github.com/gredice/arbi/issues/58), [ADR-0034](../decisions/0034-bounded-synthetic-image-rectification.md), [evidence](../evidence/image-processing.md).

[ImageProcessor](../../apps/arbi-edge-controller/src/images/processor.ts) consumes an immutable original reference, PNG bytes and optional private simulation calibration. `originalFromCapture` parses actual #53 receipt metadata and checks job/correlation/target and identity/size/digest bounds. The caller retains original capture metadata and owns authorization/storage. This adapter is not a public media or HTTP boundary.

## Geometry and quality

`arbi.image-calibration/1.0` binds site, target, configuration digest, capture calibration revision and image dimensions. It records intrinsics in pixels (`fx/fy/cx/cy`), normalized radial (`k1/k2`) and tangential (`p1/p2`) coefficients, a bed rectangle/plane in millimetres, frame revision, output dimensions, four ordered red/green/blue/magenta centres and revisioned quality thresholds. Unknown fields, nonfinite values, scope mismatch or physical origin fail. Geometry is never inferred from requested motion/pose; fixtures are fictional.

Each colour needs one 4–256 pixel connected component. Missing, ambiguous, nonconvex or degenerate arrangements fail. Lens inversion needs convergence within 24 iterations. Retain the normalized-bed-to-undistorted-camera homography, intrinsics, bed geometry and observed pixels. Projective denominators must remain positive throughout the target; each bilinear output sample must lie in the source. Unknown target pixels are never silently filled.

Mean luminance (equal RGB weights), fraction at or below 5/at or above 250, and Laplacian variance give distinct exposure/blur rejection under the recorded policy. These source metrics do not establish physical lens focus or outdoor acceptance. A quality-accepted raw capture can still fail marker detection.

## Independent results and replay

`arbi.image-processing/1.0` returns captured original, rectified/failed/unavailable processing, and not-uploaded upload. Missing calibration is unavailable; incompatibility, quality, geometry, integrity, timeout, abort and worker failure have bounded reason codes and no derivative. Quality remains available after a later geometry/detection failure. Physical calibration acceptance is always false.

Derivatives include encoded PNG/checksum/size, original identity/checksum, complete calibration digest/revision, algorithm/frame revision, quality and replay transform. Logical ID binds original identity/checksum, calibration digest and `arbi.colour-plane-rectification/1.0`. Unchanged retries reproduce identity and bytes; calibration changes change identity. The processor has no persistent cache and returns no raw bytes. Storage owns originals/derivatives.

`selectUpload` uses an explicit nonnegative byte allowance and original-first/derived-first preference. It selects only an accepted derivative or original that fits, otherwise queues. Known raw integrity/PNG/dimension failures queue rather than selecting corrupt or unsupported raw bytes. It makes no network call, reservation, deletion or delivery acknowledgement. #66 owns current budget/authorization and terminal-state composition.

## Bounds

| Resource | Source policy |
| --- | --- |
| PNG input | 8 MiB, at most 128 CRC-checked chunks |
| Format | RGB8, noninterlaced IHDR/contiguous IDAT/IEND; unsupported chunks fail |
| Dimensions | 2–512 per dimension, exact bounded inflated rows, at most 786,944 bytes |
| Counted work | At most 8,000,000 units, including input/RGB/quality/detection and 16 per output pixel |
| Worker | One per processor, no queue; old heap 64 MiB, young heap 8 MiB, stack 4 MiB |
| Wall time | Default 2,000 ms; configurable 1–5,000 ms; abort/timeout awaits termination before releasing owner |
| Storage | No writes/cache; one bounded returned derivative; original stays with its owner |

Counted units are a modeled work bound, not CPU instructions. Heap limits exclude some native Buffer memory; bounded allocations, RSS measurements and deployment cgroups supplement them. A trusted composition owns one processor; multiple instances do not form a global scheduler.

After dependency builds:

```sh
pnpm --filter @arbi/edge-controller lint
pnpm --filter @arbi/edge-controller typecheck
pnpm --filter @arbi/edge-controller build
node --test apps/arbi-edge-controller/dist/images/*.test.js
node apps/arbi-edge-controller/dist/images/reference.js
```

The reference performs five 512×512 transformations with a 5,000 ms ceiling, samples whole-process RSS every 5 ms, and records build/host/source provenance and artifact hashes. It does not measure the selected edge device.

Regenerate actual capture integration data after a clean pod build:

```sh
node apps/arbi-pod-firmware/scripts/export-capture-fixture.mjs apps/arbi-edge-controller/fixtures/captured-png.json
```

The producer uses actual applied configuration, protocol admission, synthetic gimbal/camera and native SQLite/files, then removes only its owned private temporary directory. A fresh capture has a new raw ID; its metadata records clean producer source. Its checkerboard lacks coloured markers and must fall back to raw. Physical camera formats, marker family, intrinsics and deployment thresholds remain unavailable.
