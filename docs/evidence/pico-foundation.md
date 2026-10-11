# Pico foundation evidence

Work record: [#31](https://github.com/gredice/arbi/issues/31). Decision: [ADR-0023](../decisions/0023-pico-diagnostic-foundation.md). Application: [build commands](../../apps/arbi-control-cabinet-firmware/README.md).

Source checks ran on Linux x64 without production credentials. Pinned cross-compilation produced real RP2350 ARM ELF/BIN/UF2 output. The same C core/parser/loader and SDK-pinned mbedTLS implementation compiled as a strict C11 host executable. Build identity records the actual checkout and dirty status.

Eight host test groups cover missing configuration, shared configuration schema/semantics and exact digest, independent HMAC vectors, authenticated diagnostic requests, maximum-size input, corrupt/unauthenticated/version/session frames, truncation/oversize, idle/total timeout, rate overflow, replay/reconnect, duplicate fields, token/depth limits, uint64 encoding, source/target/realm/site/mode/deadline mismatches and unsupported actuator operations. Emitted snapshots pass the shared protocol validator. Every observed state remains inhibited without measurement capability; physical acceptance remains false.

The initial target link used 59,760 text bytes, zero data and 57,780 BSS bytes. Final revision/build checks will be recorded after validation. These are compile/link observations, not measured worst-case stack, interrupt load or physical timing. Fixed receiver state is under 64 KiB, with a separate 4 KiB response buffer.

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
