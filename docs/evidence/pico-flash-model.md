# Signed Pico flash model source evidence

Work record: [#71](https://github.com/gredice/arbi/issues/71). Decision: [ADR-0030](../decisions/0030-isolated-signed-pico-flash-recovery-model.md). Implementation: [guide](../software/pico-flash-model.md).

Native Node fixtures use actual existing Ed25519 release verification, HMAC requests, a 4 MiB regular-file NOR model, fsync and a native SQLite exclusive lock. They exercise valid inactive-slot stage/trial/confirmation, protected configuration and old-image invalidation; bad signatures/digests/size/board/compatibility, preflight, expiry and replay; failed, deadline-bound, clock-invalid and restarted trials; cuts after inactive erase, data/header writes, journal erase/body/footer, trial entry and confirmation/old-header invalidation; concurrent installer refusal and corrupt configuration requiring service. An actual SIGKILL child test verifies a persisted trial restarts on the signed old image with a new inhibited epoch. No private signing key is stored in model flash.

Clean source revision `aa5e8da3c7809d5085f677d0214d11add5c4537d` reports `ARBI_BUILD_DIRTY=0`. On Linux x64, Node 24.19.0, the pinned Pico SDK 2.2.0 and ARM GCC 12.2.1, normal and denied bench target builds pass. The normal image uses 59,832 text and 57,788 BSS bytes; the denied bench link retains `arbi_update_physical_available` and uses 38,868 text and 39,612 BSS bytes. All 28 test groups pass normally and with the five C host binaries under AddressSanitizer/UndefinedBehaviorSanitizer. The six Node flash groups exercise native filesystem, cryptography and SQLite behavior; sanitizer coverage applies to C binaries. Package lint, documentation links, CI planner regressions and whitespace checks pass.

Host restart/kill and interrupted committed writes are source/native filesystem evidence. They are not removal of board power, real flash endurance/atomicity, boot-ROM execution, measured GPIO timing or physical rescue.

| Required gate | Evidence |
| --- | --- |
| Host authenticity, bounded image/partition/state and isolated failure/recovery logic | Explicit signed native fixtures |
| Pinned target capacity/layout bounds and unavailable installer gate | Cross-build/link source checks |
| On-device image signature verification and real ROM/partition/XIP/key design | Unavailable; host Ed25519 does not implement a Pico verifier |
| Actual USB transfer/flash writes, reset/output behavior and no-confirmation recovery | Unavailable; physical installer disabled |
| Named BOOTSEL/SWD signed rescue rehearsal and board/rig update-safe protection | Unavailable; no board or instrument attached |

#71 remains open. No physical firmware installation, board signing-key/OTP provisioning, electrical output invariant, power-loss guarantee or qualified reviewer acceptance is claimed.
