# Pico diagnostic firmware

The [control cabinet application](../../apps/arbi-control-cabinet-firmware/README.md) implements a real Pico 2 W build and the same C11 diagnostic core on the host. It always reports an inhibited `Fault` snapshot, advertises `state.resync` only and reports no measurement capabilities. `control.stop` is not advertised: a foundation acknowledgement would not prove a physical stop.

## Framing and admission

An incoming frame is four bytes of big-endian length followed by:

| Bytes | Meaning |
| --- | --- |
| 1 | Local framing version, exactly `1` |
| 16 | Current receiver session nonce |
| 8 | Big-endian transport sequence: starts at zero, increments exactly, never wraps |
| 1–16,384 | Existing `arbi/1.0` JSON command payload |
| 32 | HMAC-SHA-256 |

Length includes the 57 bytes of local metadata/tag overhead and excludes its own four bytes; valid lengths are 58–16,441. HMAC input is ASCII `arbi-usb/1.0` plus one NUL, then the length prefix through the payload. The 32-byte key comes from trusted local enrollment. MAC verification precedes nonce/sequence/JSON admission. Independent Node HMAC vectors check the actual C implementation.

The decoder owns a fixed 16,445-byte frame buffer and 2,048 JSON tokens, permits depth at most 16, and allocates no message heap memory. Partial frames expire after 250 ms idle or 1,000 ms total, including slow byte trickles. At most 32 complete frames per one-second window are processed. Overflow, corruption, session mismatch and transport replay poison the link and erase its key. Remaining bytes are discarded until local session reset; reconnect is not a replay queue.

JSON accepts unescaped printable ASCII strings and JSON numbers/literals/arrays/objects, rejects duplicate keys, and validates IDs/integer counter bounds without floating point. The strict diagnostic body requires both cursors null. The envelope/context reject unknown/missing fields, bind enrolled source/current target boot/session, match test realm/site/mode, and require a receiver-monotonic deadline within 10 seconds. This profile requires null UTC/uncertainty and null ingest time. Other valid shared-schema spellings/cursor requests are rejected by this narrower profile. Unsupported actuator types cannot enter an executor.

## Configuration and enrollment

An `AdmittedProfile` contains canonical full `arbi.configuration/1.0` bytes, revision and SHA-256 digest. Preparation validates the shared synthetic configuration's schema and semantic geometry/inventory before producing the host profile. The C loader checks bounded size, exact canonical content, digest and identities. Mutation, truncation, unsupported version, overflow or missing profile leaves the receiver unconfigured/inhibited. Correctly formed arbitrary configuration is not an admitted profile; a content digest is not authorization.

Only test/simulation profiles are accepted. The target links no profile or key, and cannot change either through USB. A later reviewed provisioner must bind the per-device secret, current peer and trusted hardware configuration, addressing access permissions, custody/rotation, reset/disconnect, isolation and recovery. No key is derived from public identifiers; no test key is compiled into the target. Plain diagnostic output is unsigned and cannot establish control authority.

## Identity and target loop

Every `arbi.pico-status/1.0` diagnostic includes firmware version, actual source SHA/dirty flag, board, nullable active configuration digest, active revision, configured/enrolled flags, readiness reason and last result. Its nested `snapshot` is a shared-schema-valid `arbi/1.0` event with device/boot/session/protocol/capability/cursor identities. Successful resynchronization does not clear `HARDWARE_READINESS_UNVERIFIED`.

Startup configures no motor GPIO, Wi-Fi, UART, drivers or telemetry sensors. Device ID comes from the SDK board identifier; boot ID is random per boot; session/nonce change on reconnect. The loop consumes at most 256 input bytes per tick and emits at most one public diagnostic per second while USB DTR is connected. A two-second watchdog is refreshed locally. Reconnect clears configuration/key/associations but retains the boot epoch. Status sequence restarts under a new session. This is source behavior; physical USB/watchdog behavior remains unverified.

ELF/BIN/UF2 files are source-build artifacts, not signed releases, provisioned images, isolated-board boot evidence or instructions to connect loaded machinery. See the [hardware evidence gates](../evidence/pico-foundation.md).
