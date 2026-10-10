# Deferred video recording, playback and retention specification

Work record: [#68](https://github.com/gredice/arbi/issues/68). Accepted as a specification
when this PR merges; recording activation remains outside the initial release. This
does not select an unbenchmarked encoder/stream path or enable a recording endpoint.
[ADR-0005](../decisions/0005-software-architecture-and-deployment.md), the existing
[authorization policy](../../packages/arbi-gredice/src/policy.ts) and
[audit contract](audit-events.md) retain their disabled-recording boundary.

## Ownership and initial behavior

The pod owns camera/encoder arbitration and local capture bytes. The cabinet edge
owns the bounded transfer queue, quota admission and resumable custody handoff. Cloud
Postgres owns site/resource metadata, permission decisions, access sessions, holds and
lifecycle receipts; private object storage holds encrypted media. The browser owns no
camera permission, persistence job or trusted completion evidence. Pub/Sub carries
bounded notifications rather than media. Neither a live-view session nor a new pod
binary grants recording authority.

The first release advertises recording unavailable/deferred, records no video and
automatically uploads none. Every existing `recording.*` permission is denied in
both dashboard modes, irrespective of membership or device capability. The dashboard
footer says recording is disabled; edge health and enrollment bootstrap expose
`recordingEnabled:false`. Protocol 1.0 has no recording command, and audit 1.0 permits
only disabled recording authorization denials. A UI toggle cannot clear these gates.

## Future activation gates

Activation requires a separately reviewed release and all of the following recorded
evidence/configuration. Missing, stale, conflicting or revoked prerequisites deny start:

1. Accepted #43/#60 encoder, resource and NAT/relay measurements for the selected pod;
   accepted #61 storage/restart custody and bounded transfer implementation.
2. A new versioned recording command/audit contract and device capability set covering
   start, stop, partial failure, playback, export and deletion. Existing audit 1.0
   events must not be repurposed to fabricate recording success or deletion.
3. Server-owned role grants, current site/realm/resource binding and short-lived
   record/playback/download permissions; tested revocation and cross-site denial.
4. Explicit site privacy review, subject/incident handling, retention/hold policy,
   quota settings and key ownership, with #36 lifecycle evidence and #64 audit coverage.
5. #55 plan/alert configuration and measured #63 cellular budget evidence; every
   future transfer uses accepted #45 admission rather than bypassing allowance.
6. Named simultaneous preview/still/recording bench tests, storage exhaustion,
   process/power interruption, update contention and installed-system acceptance.

These gates are a conjunction, not a feature flag default. Configuration cannot make
an unsupported protocol or missing hardware capability available. Deployment and pod
rollout remain distinct from activation; capability advertisement alone proves neither
authority nor actual storage/recording. Live/media acceptance remains open in its
own issues because no accepted physical bench result exists in this source change.

## Roles and separate permissions

Future grants are independent, site-scoped and current-directory checked. Existing
viewer/operator/engineer/update-admin roles receive no recording grants today. For a
future policy, an explicitly approved operator may request start and stop their own
session; a designated media viewer may view live only with `live.view`, read recording
metadata only with `recording.read`, and play stored bytes only with a distinct playback
grant. Download/export requires a distinct permission and bounded delivery audit.
Deletion and retention/hold management require a designated site data steward with
explicit lifecycle authority; engineering or update authority alone is insufficient.

Current `recording.create/read/export/delete` names remain reserved and disabled.
Playback, download, retention/hold and administrator interruption need separately
defined capabilities in the later authorization version. Do not treat metadata read,
still/history read, manipulation or live viewing as those future grants. Services may
perform only the recorded session's bounded expiry/stop/recovery or authorized deletion;
they cannot originate unrequested recording. Independent local camera stop/inhibit
must remain available when cloud, audit or permission refresh fails.

## Start, stop and local limits

A future start request contains an idempotency/command ID, site/resource ID, current
target boot/session, policy/configuration revision and bounded expiry. The server
records intent and current authorization before issuing an expiring device grant.
The pod rechecks supported capability, storage, camera resource ownership, local
indication and configured duration/size. Only authenticated pod evidence establishes
actual start; receipt/allow/browser animation does not. Retries resolve the same
logical recording and cannot create another file or extend duration.

Proposed conservative defaults for later bench review: at most one recording per pod,
60 seconds, 8 MiB per recording, 16 KiB streaming I/O chunks and no camera-buffer
allocation tied to whole file size. Pod and edge each cap recording spool at 128 MiB,
with a separately measured minimum free-space reserve. These are ceilings for the
future implementation, not evidence that Pi 3A+ meets them. The policy may reduce
limits; increases require new resource/bandwidth evidence. A bitrate/duration pair
must fit the size reservation including measured container/transport overhead.

Camera arbitration has one explicit owner. Safety/local inhibit and camera stop take
priority; accepted still/capture operations take priority over optional recording.
No recording begins during commissioning/maintenance/update or an unresolved camera
resource state. Concurrent preview/capture/recording is disabled until the selected
encoder and memory/resource bench proves the exact supported combination. The user
must see local recording indication and remaining limits; missing/failed indication
inhibits new start and produces an attributable failure.

Stop, maximum size/duration, expiry/revocation, exhausted storage and local inhibit
close the encoder/file independently of Internet connectivity. Restart never resumes
recording or resends a start. Unfinished files are labelled interrupted/unverified;
recovery reconciles a durable manifest, authenticated module epoch and final digest
before any playback/upload. Unknown partial effects remain unknown, rather than
being relabelled completed because a socket closed. Storage or audit failure stops
new recording and preserves an explicit gap; stopping never awaits audit append.

## Storage, custody, transfer and privacy

Recording metadata contains only opaque site/recording/source identities, original
time with clock quality, policy revision, state, actual byte size, encryption/key
revision and digest. Each custody receipt identifies immutable digest/size, source
and destination resource, transfer/attempt IDs and verified durable receipt. Keep
original provenance through retries; a cloud ingest timestamp cannot replace source
time. Raw bytes, signed URLs, credentials, private keys, surveyed coordinates and
incidental identity details do not enter public issues, protocol/audit logs or exports.

Future local spools require private access controls and encrypted storage with an
operator-owned key lifecycle and tested restart recovery. Cloud objects remain
private, encrypted and accessed only through bounded server-authorized playback or
download sessions. No public object URL, automatic public publication or automatic
recording/upload is permitted. Region, keys, privacy notice and lawful operational
handling require site-owner review before activation, rather than an invented global
assumption. Masks and public visibility are explicit policy, not inferred from motion.

Upload requires per-recording size/digest preflight, persistent allowance reservation,
bounded range/chunk attempts, content verification, retry cap and configured upload
window. Interrupted transfers resume verified offsets or restart within the original
bounded attempt/allowance policy. No upload runs merely because Wi-Fi returns; unknown
mobile coverage follows configured discretionary policy. Quota exhaustion preserves
bounded essential audit/control traffic. Confirmed cloud custody does not itself
authorize deletion of the local copy; the configured lifecycle owns that action.

## Retention and holds

Defaults proposed for future activation are private media deletion seven days after
confirmed capture, 30 days for operational recording manifests, and 90 days for
minimal recording/access/lifecycle audit metadata. The site owner must explicitly
accept or reduce these defaults and document any justified extension before enabling
recording. They do not alter today's immutable audit tables. #36 must implement
controlled lifecycle actions; no background job may disable immutability triggers
or silently edit history to approximate retention.

Retention uses reliable source time plus bounded uncertainty; if capture time cannot
be established, quarantine the file with a finite operator-review deadline and deny
playback/upload. Unknown time must not produce indefinite retention. A policy change
has its own authorization and audit revision; it cannot silently reinterpret a prior
hold. Holds identify scope, purpose category, authorized steward and review/expiry;
they prevent deletion until an explicit audited release. No hold creates viewing
permission or indefinite unreviewed storage.

Deletion first revokes future access and establishes a durable tombstone/intent,
then deletes eligible pod/edge/cloud bytes and reports each authenticated outcome.
Retries are idempotent and reconcile partial/offline copies; only all required
receipts establish completed deletion. Preserve minimized digest/resource and
lifecycle receipts for the accepted audit period, with actor pseudonymization under
the lifecycle policy. Key retirement and backup expiration must be included in
the documented deletion coverage; unlinking one object cannot claim all-copy erasure.

## Audit hooks and required later acceptance

Future contracts must distinguish server intent/authorization, actual pod start/stop
and failure, bytes/custody observations, and uncertain connection loss. Every playback
viewer has a new bounded session/grant with its actor, recording ID, site, expiry and
revocation state. Record authorization and actual delivery start/end/bytes; browser
heartbeats remain untrusted observations, never proof of human attention. Export,
denied cross-site access, retention edits, holds and deletion each have server-owned
evidence. Audit downloads themselves use bounded logging with no recursion.

The later implementation must prove per-recording/per-viewer attribution, no duplicate
start after retries, cross-site denial, expiry/revocation, hold/retention boundary
deletion, partial custody reconciliation, bounded interrupted uploads, full storage,
process/power interruption and resource contention. Named bench records must identify
hardware/firmware/policy revisions, configured versus measured limits, fixture/load,
observer and residual gaps. No test result in this specification clears those gates.

Existing disabled behavior is checked by the Gredice boundary suite, protocol audit
fixtures, edge health/manual tests and dashboard shell. Documentation links and
whitespace are checked for this specification. The required future hooks are defined
here; no storage endpoint, permission activation or recording protocol is introduced.
