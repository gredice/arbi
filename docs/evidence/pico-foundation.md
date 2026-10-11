# Pico foundation evidence

Work record: [#31](https://github.com/gredice/arbi/issues/31). Decision: [ADR-0023](../decisions/0023-pico-diagnostic-foundation.md). Application: [build commands](../../apps/arbi-control-cabinet-firmware/README.md).

Source checks ran on Linux x64 without production credentials. Pinned cross-compilation produced real RP2350 ARM ELF/BIN/UF2 output. The same C core/parser/loader and SDK-pinned mbedTLS implementation compiled as a strict C11 host executable. Build identity records the actual checkout and dirty status.

Eight host test groups cover missing configuration, shared configuration schema/semantics and exact digest, independent HMAC vectors, authenticated diagnostic requests, maximum-size input, corrupt/unauthenticated/version/session frames, truncation/oversize, idle/total timeout, rate overflow, replay/reconnect, duplicate fields, token/depth limits, uint64 encoding, source/target/realm/site/mode/deadline mismatches and unsupported actuator operations. Emitted snapshots pass the shared protocol validator. Every observed state remains inhibited without measurement capability; physical acceptance remains false.

Tested source revision: `a862239063d6f4be2cc83e76e16ec8277b31d735`, clean checkout (`ARBI_BUILD_DIRTY=0`). A separate bootstrap downloaded/extracted the digest-checked compiler packages and exact SDK/submodules, installed pinned CMake/Ninja, and built the target without the earlier manually prepared tools. The final link used 59,832 text bytes, zero data and 57,788 BSS bytes. These are compile/link observations, not measured worst-case stack, interrupt load or physical timing. Fixed receiver state is under 64 KiB, with a separate 4 KiB response buffer.

Both normal and AddressSanitizer/UndefinedBehaviorSanitizer host runs passed all eight test groups. The 25 repository CI-selection/gate tests, script syntax checks, 298-file Markdown link check and whitespace check passed. The source ELF/BIN/UF2 SHA-256 digests were respectively `32d6c9a6741ee58ff5e503731e8d4ff2cbb09f8b6677860db9bcdfa2e67d7d5b`, `aee62623510fe3a4baf2529e156e93ea2166af71f0a96adc082bf0332dedd734` and `df65db4faa532cb77cbb6eb38e6b7ee976f6523a70d4aed41164f54371e1283d`. These identify this local source build; the ELF includes local debug paths and these are not published/signed release checksums.

| Evidence | Result / boundary |
| --- | --- |
| Pinned target cross-compilation | Passed: real MCU architecture/link map |
| Shared-core parser/configuration/authentication | Eight host groups passed; no physical actuation |
| Isolated Pico board boot/reset | **Unverified — no Pico board attached to this workspace** |
| Board USB reconnect, DTR and watchdog | **Unverified — host epoch/timeout tests are separate evidence** |
| Electrical isolation, qualified stop and loaded line restraint | **Blocked/unverified; no reviewed installed adapter or physical test** |
| STEP/DIR timing, encoders, tension, motion accuracy | **Unverified; no actuator outputs/installed measurements here** |
| Signing, protected provisioning and physical installation | **Unavailable in this foundation; no secret or test key linked into the target** |

No board result, waveform or mechanical observation is claimed. The issue's board boot/reconnect record remains outstanding until actual hardware and a reviewed isolated-board procedure are available. Source implementation can merge while that evidence stays explicit and physical enablement remains blocked.
