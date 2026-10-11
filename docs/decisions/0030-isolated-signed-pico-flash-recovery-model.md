# ADR-0030: Isolated signed Pico flash recovery model

- Status: Accepted when merged; proposed until then
- Date: 2026-10-11
- Work record: [#71](https://github.com/gredice/arbi/issues/71)
- Prerequisites: [release/update contracts](../software/release-updates.md), [local recovery](0028-simulation-only-local-controller-recovery.md)

## Decision

Implement an isolated Node/native-file model of signed Pico image storage and trial recovery. Reuse the existing Ed25519 release producer/verifier; verify digest, size, exact board/hardware/assembly identity, protocol/configuration ranges, updater/bootloader minimum and current dependency versions. Session-bound HMAC requests enforce current source/target epochs, increasing transport sequence, local expiry and explicitly simulated inhibited/no-manual/isolated-output preflight. They are in-process synthetic transfer requests, not a new USB command or physical installation grant.

Select the [4 MiB layout](../../apps/arbi-control-cabinet-firmware/update-layout.json) for source fixtures: table reserve, an independent signed rescue image, A/B image regions, protected configuration, alternating committed journal sectors and unused space. Erase/program alignment, image/header bounds and contiguous capacity are checked against the pinned SDK's Pico 2 W board capacity. This file is not an RP2350 ROM partition table, executable linker map or flashed image layout. The target compiles its bounds and an always-denied physical-update gate; no updater, device signature verifier, ROM table, flash/OTP or GPIO adapter is activated.

The host model writes only a newly provisioned or inspected regular `flash.bin` in a private `arbi-pico-flash-*` directory directly under the OS temporary directory. It enforces NOR-style erase/program constraints and fsyncs writes. A native SQLite exclusive lock prevents concurrent installers and releases on actual process death. Image metadata carries the signed manifest, and image readback verifies signature/digest again. Configuration is independent and checked against the admitted simulation fixture; migrations are unsupported rather than automatically changing calibration/limits. Alternating hash/footer-committed records preserve an earlier valid state through interrupted erase/program/commit. Corrupt protected configuration or unusable metadata requires local service, never silent reformatting.

The [RP2350 datasheet, section 5.1.17](https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf) documents a fixed 16.7-second trial watchdog and confirmation that invalidates the other image's first sector. Use an 8,000 ms model-local confirmation budget, independent of cloud contact. Confirmation requires the current trial boot, matching configuration and explicitly simulated local configuration/interface/output health. Failed, expired, clock-invalid or restarted trials return to an authenticated old image with fresh inhibited epochs. Successful model confirmation invalidates the old A/B header while retaining a separately signed rescue copy. It does not prove real ROM boot preference, interruption ordering, device keys, OTP security, XIP relocation or rescue access.

## Consequences

This provides actual host cryptographic, native persistence, concurrency, process-kill and failure-stage evidence without implying that Pico firmware can yet update itself. [The guide](../software/pico-flash-model.md) and [source evidence](../evidence/pico-flash-model.md) keep #71 open for device verification, an actual ROM/partition/linker design, output invariants, board interruption and inspected BOOTSEL/SWD rescue. The pinned SDK's `rom_explicit_buy` may modify flash and irreversible OTP rollback rows; no call to it, OTP write, flashing or hardware reboot occurs here. Future physical installation remains disabled until those choices and target-specific isolation/restraint prerequisites are reviewed and proved.
