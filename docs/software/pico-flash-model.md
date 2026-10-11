# Signed Pico flash recovery model

The [Node model](../../apps/arbi-control-cabinet-firmware/scripts/flash-model.mjs) and [layout](../../apps/arbi-control-cabinet-firmware/update-layout.json) implement isolated source fixtures under [ADR-0030](../decisions/0030-isolated-signed-pico-flash-recovery-model.md). They do not run on a Pico or write board flash. The target C gate always reports physical updates unavailable; ordinary USB capabilities remain state.resync only. Configuration continues declaring its Pico update interface unsupported. No browser, file upload or successful host trial enables physical installation.

The caller supplies a validated test/simulation configuration, exact Pico component identity, current dependency versions, trusted public Ed25519 key and private ephemeral transfer key. The model opens only a private temporary regular-file fixture, obtains a native exclusive SQLite lock and validates persisted configuration/journal/image data. It never opens `/dev`, serial, BOOTSEL or SWD paths. Missing keys, wrong scope or unexpected existing files fail. Signing keys are external to the model and never stored in its flash file; tests use ephemeral signers.

Stage requests carry command/correlation ID, exact source and current receiver boot/session, increasing sequence, deadline within 1,000 local milliseconds, signed-manifest digest and named simulated preflight. HMAC binds the entire bounded request. These are private in-process test envelopes; the physical wire protocol gains no updater command. A failed authentication, old epoch/sequence, expired request, moving/manual/nonisolated preflight or invalid image reaches no active-slot write. Replay never restarts a trial. Preflight fields are trusted synthetic fixtures, not inspected physical restraint evidence; the later controller-specific adapter must own that real binding.

The model authenticates image bytes with the existing release verifier, applies exact target/dependency/configuration/updater/bootloader checks, and rejects unsigned changes, truncation, excessive size or an unreviewed downgrade. It writes only the inactive A/B region, programs complete signed metadata last, authenticates readback and commits a staged descriptor. Image header size is 16 KiB and payload must fit its partition; initial baseline must also fit the independent rescue region. Configuration is protected and unchanged across update stages. A separate configuration migration/recovery design is required for any data-version change.

| Source layout region | Purpose |
| --- | --- |
| 0–4 KiB | Reserved table area; no actual ROM partition table installed |
| 4–256 KiB | Independently signed model rescue copy |
| 256–1,792 KiB | Slot A including bounded signed metadata header |
| 1,792–3,328 KiB | Slot B including bounded signed metadata header |
| 3,328–3,392 KiB | Protected admitted simulation configuration |
| Next two 4 KiB sectors | Alternating hash/footer-committed model state |
| Remaining space | Unallocated; no implicit Wi-Fi/driver/configuration use |

The native file backend enforces 4 KiB erase and 256-byte program units, disallows zero-to-one programming without erase, and fsyncs each write. It is not evidence of actual flash erase/program timing, atomicity or power-loss durability. Journal checksum/footer checks reject torn records; generations never wrap. A completed new record remains discoverable after lost acknowledgement; an incomplete one leaves the prior record usable. A new process gets a new boot/session and cannot continue a persisted trial or restore a command/lease.

Activation starts a synthetic trial with a fresh boot and an 8-second local budget. Current-boot configuration/interface/output health is required before confirmation. Unknown or malformed health is not a passing condition. A failed/expired/restarted/clock-invalid trial rolls back without Internet. Confirmation updates the journal before modeling invalidation of the previous image's first sector. The [RP2350 ROM](https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf) has its own documented 16.7-second watchdog and ordering; this host journal is not that implementation. Reloading its watchdog to wait for cloud approval is not the selected policy.

Status distinguishes verified bytes in a host slot from executed firmware: `firmwareExecuted=false`, `actuationInhibited=true`, physical/remote hardware installation unsupported, and BOOTSEL/SWD recovery un-rehearsed. Real reset cause, boot slot and outputs require an actual adapter. The signed rescue copy supports model recovery if a prior image becomes invalid, but does not prove that secure ROM policy or a real service connector can reach it. Corrupt protected configuration and unusable journals require service rather than automatic reinitialization.

Before a physical implementation, select and inspect ROM partition metadata/XIP relocation, signed IMAGE_DEF/secure-boot trust and provisioning/revocation, protected configuration recovery, actual flash operations under interrupt/core/XIP constraints, output states across resets and update-safe isolation/restraint. Rehearse authenticated upload, no-confirmation/watchdog/power interruption and an unusable application with BOOTSEL/SWD on the exact board. The [source evidence](../evidence/pico-flash-model.md) supplies none of those physical claims; #71 stays open.
