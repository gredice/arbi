# ADR-0034: Bounded edge rectification with original fallback

Status: Proposed for source review; physical vision calibration unavailable.

Work record: [#58](https://github.com/gredice/arbi/issues/58). Prerequisite: [traceable capture](0033-traceable-synthetic-capture-sequencing.md).

## Context

Raw capture and upload do not establish rectification or image quality. Unknown calibration, missing markers and processing failure must preserve originals without invented geometry. The physical fiducial family, survey, camera/focus calibration and daylight thresholds remain unqualified.

## Decision

Add an application-owned simulation adapter with closed revisioned calibration bound to original site, target, configuration digest, capture calibration and dimensions. Record intrinsics, radial/tangential distortion, bed rectangle/plane/frame, four surveyed model markers, output size and quality policy. These are fictional fixture coordinates, not accepted installation geometry.

Detect distinct colour components from decoded pixels. Reject ambiguous/missing/oversized/degenerate detections and failed mean/clipping/Laplacian quality checks. Remove distortion with bounded convergence, solve a normalized four-point planar homography, then inverse-map the canonical bed through projective/lens transforms using bilinear sampling. Reject folded geometry and out-of-source samples. The fixture colour family is not an approved physical fiducial system or camera displacement measurement.

Use one isolated worker per processor, no queue, counted work, wall timeout/cancellation and fixed input/output/heap/stack limits. Processing has no filesystem, camera, transport, motion or upload effects. Failure preserves captured-original identity and independent not-uploaded state. Derivatives retain actual PNG digest/size, original identity/digest, complete calibration digest/revision, algorithm/frame revisions, observed points, transform and quality. Canonical identity binds original and calibration; retries retain one logical derivative. [#61](https://github.com/gredice/arbi/issues/61) owns persistence/transfer and [#66](https://github.com/gredice/arbi/issues/66) owns composition.

Consume a committed actual synthetic pod capture/native-store fixture without an app-to-app production dependency or package cycle. Independent Python fixtures check PNG filters. Pure upload selection chooses an accepted derivative or raw original within an explicit byte allowance, otherwise queues; it cannot acknowledge upload or delete originals.

## Consequences

PNG/cryptography, worker bounds and analytical geometry are source/host evidence. RGB8 noninterlaced PNG input/output is limited to 512 pixels per dimension, not full camera resolution. Physical accuracy, marker reliability, quality thresholds and selected edge performance remain required evidence. Normal edge/pod startup gains no camera, motion or WAN capability. See the [guide](../software/image-processing.md) and [evidence](../evidence/image-processing.md).
