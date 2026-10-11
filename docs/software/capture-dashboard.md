# Capture history and framing review

Work record: [#69](https://github.com/gredice/arbi/issues/69),
[decision](../decisions/0037-protected-capture-history-and-framing-review.md),
[evidence](../evidence/capture-dashboard.md).

[CaptureHistorySource](../../apps/arbi-edge-controller/src/images/history.ts)
projects the actual native stage and an explicitly authenticated pod receipt
reader. Optional native job journal and trusted admission metadata report the
job phase, origin, priority, queue and scheduled UTC; missing owners remain
unavailable. A captured pod receipt without edge staging is separately labelled
`EDGE_CUSTODY_UNAVAILABLE`. Failures cannot acquire a raw manifest. Associations
require the exact historical configuration digest and its target mapping.

[CaptureTools](../../apps/arbi-dashboard/src/dashboard/capture-tools.ts) composes
current Gredice permission/audit, protected native media records and an explicit
source port. `history` supports bed/plant filters and stable-ID keyset pages (at
most four rows/256 KiB; smaller pages for large metadata). Cloud SQL reads are
bounded independently of retained collection size. Raw and processed artifacts
share the original capture identity. The cloud independently inspects matching
provenance and object state; local upload receipts alone cannot create cloud
verified delivery. A cloud-only row exposes native attempts as unknown. `latest`
selects the latest verified cloud receipt; delayed uploads do not rewrite original
capture UTC or pretend to give a chronological capture ordering.

The [dashboard](../../apps/arbi-dashboard/src/dashboard/captures.tsx) reads only
on explicit gestures. Pending/failed focus, processing, upload and verified
object outcomes have separate rows. It shows original clocks/clock quality,
requested and available pose, gimbal/camera state, profile/configuration/calibration
and software build fields. Missing hardware revision remains unavailable.

`access` resolves the particular still resource and checks current permission
before and after existing media grant issuance. Unknown/deferred trusted budget
policy returns an explicit deferral and signs nothing. Full-image access creates
an audited short link, then waits for another click. Thumbnail access is
independent and disabled when no verified thumbnail exists. Browser visibility,
offline, session expiry and component replacement abort pending work and clear
media/metadata. No hidden refresh, media retry or automatic configuration action
occurs. Existing media audit records grant issuance; this UI never claims that a
link proves downloaded bytes.

`review`, `stage` and `activate` delegate to the actual protected local
[commissioning handler](../../apps/arbi-edge-controller/src/commissioning/server.ts).
Review excludes device journals and returns bounded current sets, historical
revision identities and authoritative audit. The editor shows changed paths and
requires a new configuration revision. The local coordinator additionally
rejects a changed calibration under an old calibration revision. A separately
reviewed digest, current local maintenance authorization, compatible devices and
explicit activation remain required. Read recorded status again after rejection
or activation; an edited browser document cannot establish readiness.

Composition remains explicit via `configureDashboard({..., captureTools})`.
The standard isolated shell has no capture provider fallback; an unavailable
provider is visible. The source callback must use protected current admission and
native records. Source/reference wiring, field equipment and public deployment
are separate gates; this slice exposes no new unauthenticated device endpoint.
