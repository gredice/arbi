# Capture job and offline media composition

Issue #66 connects [local jobs](local-jobs.md),
[pod captures](capture-sequencing.md), [signed edge custody](capture-transfer.md),
[image processing](image-processing.md), [shared transfer budgets](transfer-budgets.md)
and [private media storage](image-storage.md). All new composition is explicit,
isolated and simulation-only. [ADR-0036](../decisions/0036-isolated-capture-job-and-media-composition.md)
records the decision; [evidence](../evidence/capture-orchestration.md) records checks.

## Ownership and scheduling

The edge's `CaptureJobAdapter` wraps the bounded motion adapter and a trusted
pod port. The existing `LocalJobConsumer`/native `JobJournal` admit current
authority and journal every phase before dispatch: move, a distinct stop proof,
gimbal, settle, capture, safe gimbal pose, return, dock and latch. The actual
pod `GimbalModel` independently checks stopped evidence and fresh settling
samples. `CaptureSequencer` performs initialization/profile/autofocus/still
and owns the native raw identity. Semantic duplicates reuse its original
receipt; an uncertain interrupted camera action is never retried.

A failed focus and a failed still remain different pod phases/reasons. Neither
produces a successful PNG. Processing and upload consume only captured data.
The original actor/job/request, source epochs, captured time/clock uncertainty,
requested pose/frame, estimated or unavailable pose/age, gimbal, profile/focus,
software build, configuration and calibration stay in the immutable manifest.
No simulated pose is relabeled as a physical measurement.

`CaptureWorkflow.tick()` runs local jobs independently of
`CaptureWorkflow.mediaStep()`. Each media step stages one owned capture or
attempts one prioritized pending artifact. Raw-first and rectified-first are
explicit local choices. Existing budget admission determines deferred work;
cloud receipt inspection comes first so zero remaining allowance cannot hide
an already completed upload. `stopAndDrain()` inhibits jobs/preview immediately
and drains discretionary work before storage owners close.

## Stage, processing and retention

`CaptureStage` requires a private 0700 direct temporary directory named
`arbi-capture-stage-*`, a test realm and a fixed site. It owns an exclusive
native SQLite kernel lock, synchronous FULL metadata commits, bounded 0600
regular files, checksums, PNG validation, fsync/rename and directory fsync.
Reservations precede payload writes. Startup recovers complete verified files
or marks incomplete/corrupt staging unavailable. No receipt claims retention
when a file is absent or corrupt.

Default ceilings are 64 MiB of payload, 128 capture receipts and 16 MiB of
SQLite pages. Two artifacts per capture, 128 KiB per hashed row and 16 recent
reason events per row bound metadata. Records/tombstones are not recycled.
Quota refusal produces `STAGE_PAYLOAD_QUOTA`; write failures produce
`STAGE_WRITE_FAILED`; receipt capacity rejects with `STAGE_RECEIPT_LIMIT`.
Storage failures propagate if even failure evidence cannot be committed.

The existing bounded processing worker produces either a verified derivative
or an explicit failed/unavailable result. The stage preserves both raw and
derived PNGs, their identities/checksums, actual quality, observed transform
and algorithm/calibration/frame lineage. Each artifact has its own pending,
uploaded or attempts-exhausted state. A raw upload may succeed after missing
calibration or failed rectification; those processing facts remain unchanged.

Retention is explicitly supplied, at most seven days, with a one-day default.
Expiry commits intent, unlinks known stage files, fsyncs the directory and
commits an expired tombstone. Restart completes interrupted expiry. This
releases only the optional staging copy; the signed `CaptureReceiver` custody
store remains a separate bounded owner and is not silently evicted.

## Cloud object identity and provenance

`CaptureUploader` allows one bounded attempt and at most 32 attempts per
artifact. Higher-priority local work defers optional image traffic. Current
authority is checked across IO; the wall limit is at most five seconds. An
uncertain timeout quarantines that coordinator and leaves no overlap or late
local acknowledgement. Restart constructs a new coordinator and inspects the
immutable cloud identity before another PUT. Upload authority is independent
of the original camera command's elapsed deadline.

Each body chunk is at most 64 KiB. The shared `TransferBudget` reserves and
conservatively charges each chunk submitted to the HTTP body; failed/uncertain
attempts retain their debit. Remote byte acceptance is not inferred from that
local submission. Only final object inspection closes the budget reservation
and creates an uploaded receipt. This is application payload evidence, not a
router/provider WAN measurement.

The private `@arbi/protocol/capture-upload` envelope binds the original manifest,
artifact descriptor and processing lineage. It adds no actuator message or
generated wire/schema version. `CaptureMediaUpload` runs behind an explicitly
installed, current service-authorization callback and the existing media store.
It copies the versioned trace through a trusted resolver into the actual
PostgreSQL image row; browser uploads cannot supply a trace. Grant bodies bind
the original SHA/size/dimensions and reject changed provenance on replay.
Raw and derived artifacts get separate private full-image records with explicit
lineage, rather than treating rectification as an uploader-declared thumbnail.

The existing Blob adapter uses its actual SDK and private HTTP object plane
to inspect size, checksum and dimensions. Lost completion responses replay
one PostgreSQL image and one object. A pending five-minute grant may renew
under current service authority while keeping original object/capture identity
and timestamps. Deletion/cleanup remains the media owner's separate policy.

## Preview and recording

`CapturePreview` accepts a trusted current short grant with actor/source,
generation, bitrate, byte ceiling and expiry. It reserves the camera and the
same transfer budget; a still capture and preview cannot share camera ownership.
Start/reconnect/expiry/stop require lifecycle hooks; returned preview bytes have
a separate local-frame hook with observed delivery explicitly false. Frame extraction is conservatively debited; viewer/network delivery still requires the existing authenticated media/usage observations. Stale/reordered generations,
revocation, clock regression, budget/bitrate limits and expiry fail closed.
Frames are bounded to 64 KiB, one concurrent call and a one-second deadline.
Uncertain frame work retains the camera lock until the adapter settles and
quarantines further preview work.

`capturePreviewPolicy` adapts the existing budget's current coverage/revision
and limits to the cloud live service's policy evaluator. It is a snapshot, not
a reservation or delivery observation. The existing native live store keeps
individual actor/session audit, renewal/expiry and shared-producer authority;
its signed device reports remain distinct from browser advisory observations.
The six recording lifecycle/access contracts remain disabled, and authorization
continues to reject recording requests. No recording success is required or claimed.

## Enablement

Normal edge/pod/dashboard startup installs no capture/media composition, camera,
servo, preview encoder, public upload gateway or provider credentials. Tests
use actual native stores and HTTP/SDK adapters with explicitly isolated fixture
authority. Live camera/lighting, physical motion/settling, installed network,
provider tenancy and board/storage power-cut qualification remain unavailable.
