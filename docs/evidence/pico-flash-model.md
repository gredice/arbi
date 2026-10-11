# Signed Pico flash model source evidence

Work record: [#71](https://github.com/gredice/arbi/issues/71). Decision: [ADR-0030](../decisions/0030-isolated-signed-pico-flash-recovery-model.md). Implementation: [guide](../software/pico-flash-model.md).

Native Node fixtures use actual existing Ed25519 release verification, HMAC requests, a 4 MiB regular-file NOR model, fsync and a native SQLite exclusive lock. They exercise valid inactive-slot stage/trial/confirmation, protected configuration and old-image invalidation; bad signatures/digests/size/board/compatibility, preflight, expiry and replay; failed, deadline-bound, clock-invalid and restarted trials; cuts after inactive erase, data/header writes, journal erase/body/footer, trial entry and confirmation/old-header invalidation; concurrent installer refusal and corrupt configuration requiring service. An actual SIGKILL child test verifies a persisted trial restarts on the signed old image with a new inhibited epoch. No private signing key is stored in model flash.

The clean revision and target-link results are recorded after implementation. Host restart/kill and interrupted committed writes are source/native filesystem evidence. They are not removal of board power, real flash endurance/atomicity, boot-ROM execution, measured GPIO timing or physical rescue.

| Required gate | Evidence |
| --- | --- |
| Host authenticity, bounded image/partition/state and isolated failure/recovery logic | Explicit signed native fixtures |
| Pinned target capacity/layout bounds and unavailable installer gate | Cross-build/link source checks |
| On-device image signature verification and real ROM/partition/XIP/key design | Unavailable; host Ed25519 does not implement a Pico verifier |
| Actual USB transfer/flash writes, reset/output behavior and no-confirmation recovery | Unavailable; physical installer disabled |
| Named BOOTSEL/SWD signed rescue rehearsal and board/rig update-safe protection | Unavailable; no board or instrument attached |

#71 remains open. No physical firmware installation, board signing-key/OTP provisioning, electrical output invariant, power-loss guarantee or qualified reviewer acceptance is claimed.
