# ADR-0033: Traceable capture sequencing with native isolated persistence

Status: Proposed for source review; physical camera activation unavailable.

Work record: [#53](https://github.com/gredice/arbi/issues/53). Prerequisite: [calibrated gimbal source model](0032-simulation-only-calibrated-gimbal.md).

## Context

Framing, focus, raw capture, processing and upload have different outcomes. Restart must not redo a camera action whose acknowledgement was lost. Camera and live preview need one bounded local owner, while real camera settings and focus/lighting metrics still require a named bench.

## Decision

Add an application-owned synthetic capture coordinator consuming actual shared configuration/command/lease admission and the actual gimbal model. Require paired framing/capture commands with the same actor, source, correlation and lease. The profile is a private revisioned simulation record, bound to configuration and calibration, with explicit exposure/gain/focus/lens range and bounded synthetic resolution. Require stopped main motion and completed fresh synthetic gimbal settling before initializing the camera, applying the profile, autofocus, optional preview and still capture. Renew authority and stop/settling evidence across every asynchronous camera boundary. Step and overall wall-clock bounds supplement the local monotonic deadline; abort late callbacks and refuse a non-advancing scheduler clock.

Reserve a native SQLite receipt before camera effects. Use a single native exclusive storage owner and one coordinator per camera; preview contention returns a durable busy failure. A non-evicting bounded ledger caches semantic retries without dispatching again. Bind raw PNG identity/digest, original request and actor, job/target, source epoch, profile/runtime/configuration/calibration, declared clock quality, requested/available pose, gimbal state, focus and optional preview. Missing pose/time stays unavailable; aged simulated estimates stay stale. Processing and upload are independently not started.

In a private temporary model directory, acknowledge an image intent before writing a new regular file, then write/fsync/rename/directory-fsync, verify bounded PNG structure/CRC/decompressed capacity and SHA readback, and commit its receipt. Restart promotes a valid committed image or records an explicit interrupted result; it never repeats an uncertain camera action. Refuse payload/receipt pressure rather than deleting unacknowledged data. [#61](https://github.com/gredice/arbi/issues/61) owns retention/ownership transfer and transfer accounting; [#58](https://github.com/gredice/arbi/issues/58) owns processing, quality and derivatives.

## Consequences

Actual Node cryptography, PNG encoding/validation, SQLite, filesystem durability ordering and killed-process recovery are source/native evidence. The synthetic camera uses a bounded reference image, not a real lens or full-resolution Camera Module 3 photograph. Ordinary pod startup remains inhibited with unavailable camera/servo adapters and diagnostic-only admission. Physical exposure/focus/framing/latency, representative lighting, measured settling and live preview contention remain required bench evidence. No capture completion is an upload, rectification, media grant or cloud audit receipt. See the [guide](../software/capture-sequencing.md) and [evidence](../evidence/capture-sequencing.md).
