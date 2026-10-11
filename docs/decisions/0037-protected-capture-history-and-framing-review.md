# ADR-0037: Protected capture history and framing review

Status: proposed in the issue #69 PR. Scope: isolated source/API/browser workflows.

## Decision

Use a private Node projection of existing capture, job and stage records. Camera
capture/focus, processing rejection, upload progress and cloud object verification
remain independent. The browser cannot supply an outcome, association or safety
proof. A trusted source resolves bed/plant associations against the exact
historical configuration digest; the upload bridge can preserve a separately
resolved immutable association in protected cloud metadata.

History reads return metadata without object URLs or bytes. Existing native
PostgreSQL media records independently establish delivery. Cloud-only recovery
preserves original capture identity, actor, clocks, pose and processing lineage;
missing native attempt counts, schedules, priorities or hardware revisions stay
unavailable. Keyset history orders stable capture identity. Latest received image
orders verified cloud receipt time and explicitly does not establish capture-time
ordering. Pages have bounded rows and response bytes.

Explicit media access uses the existing current still permission, original
private object inspector/signer and native grant audit. A trusted access budget
must allow issuance; unavailable policy defers. Download issuance returns a link
requiring another explicit gesture. Thumbnail access is separately requested.
Hidden/offline/expired or changed contexts abort reads and clear grants; no action,
configuration mutation, image access or failed read retries automatically.

Framing review reads actual native commissioning sets, historical identities and
canonical local audit events through its current configuration permission.
Editing requires a new configuration revision and changed calibration requires a
new calibration revision. The local coordinator enforces historical calibration
revision immutability even for a separately approved set. Independent reviewed
digests, local short maintenance authority, enrollment, stopped/inhibited devices
and compatibility still own staging/activation. A browser diff grants none of
these conditions.

## Composition and limits

`CaptureTools` is an explicitly configured human BFF with a trusted source port;
ordinary and branch-preview providers remain unconfigured. The source port must
use protected current source admission, not a public unauthenticated callback.
The native integration uses the real commissioning handler, current fixture JWT
policy, native SQLite/PostgreSQL and actual private Blob SDK/HTTP object fixtures.
Renderer-only browser fixtures are separate evidence and cannot approve source
acceptance. No sibling application becomes a runtime dependency; Node adapter
subpaths leave the public actuator/wire/schema profiles unchanged.

References: [#69](https://github.com/gredice/arbi/issues/69),
[guide](../software/capture-dashboard.md), [evidence](../evidence/capture-dashboard.md),
[ADR-0036](0036-isolated-capture-job-and-media-composition.md).
