# Device traffic metering host evidence

- Date: 2026-10-07.
- Work record: [#26](https://github.com/gredice/arbi/issues/26), parent [#11](https://github.com/gredice/arbi/issues/11).
- Tested source: [@arbi/traffic 0.1.0](../../packages/arbi-traffic/README.md), [edge integration](../../apps/arbi-edge-controller/src/metering.ts) and [simulated pod adapter](../../apps/arbi-edge-controller/src/simulation.ts); the linked PR and merge identify the reviewed source revision.
- Configuration: committed synthetic test inputs only, temporary SQLite files and per-run TLS credentials, explicit `test` realm/`simulation` origin and LAN scope. No real site, modem, provider credential or deployment configuration.
- Equipment/runtime: macOS development host, Node 24.15.0, pnpm 11.5.2, Node SQLite, OpenSSL and localhost TLS sockets. Linux counter fixtures model bounded sysfs/procfs reads; they are distinct from the mandatory native Linux CI comparison.
- Reviewer: implementation self-review; the PR records automated/independent review availability and required CI results.

## Portable source and host checks

The [portable metering suite](../../packages/arbi-traffic/src/traffic.test.ts) passes its committed checks without skips. The edge suite adds two socket/storage checks to the existing diagnostic runtime tests. On macOS the Linux `systemd-analyze` check remains skipped because the OS is unsupported; the native metering collector has a separate explicit Linux CI command and never silently skips there.

| Case | Executed observation / limit |
| --- | --- |
| Known-size upload / retry | Failed attempt retains 6,144 submitted bytes; complete repeat submits 7,168 bytes. Total attempted bytes are 13,312, with distinct IDs and retry link, rather than successful object size. This fixture tests the submission seam, not wire delivery. |
| Partial receive | Consumer abort retains 4,096 yielded bytes; receive-stream failure retains its 123-byte prefix. Outcomes remain aborted/failed. |
| TLS host comparison | Actual per-run authenticated pod/edge sockets exchange discovery, snapshots and authorized diagnostics. Sum of observed pod-upload frames equals edge-download buffers; edge-upload equals pod-download. Byte counts are actual plaintext application frames; TLS/TCP/IP overhead and other host traffic remain outside that payload tap. |
| Precise raw counters | Registers above Number's safe-integer range produce exact 1,001-byte upload and 120-byte download deltas. Interface total has null device/category and reconciliation with no parts leaves all bytes unattributed. |
| Discontinuity | Decrease, implausible huge jump, interface replacement, boot change, coverage change, failed poll and an oversized offline sample interval produce null deltas and new epochs. The next clean window resumes ordinary differences. |
| Verified rollover | Synthetic 32-bit register with a separately verified wrap count changes from 4,294,967,290 to 10 and yields exactly 16 bytes. Unverified decreases, removed wrap evidence and excessive wraps reset instead of inventing huge usage. |
| Uncertain clocks | Unknown source uncertainty, reversed UTC and a one-hour UTC jump retain raw/delta evidence with no invented accounting interval. Current edge defaults explicitly have unknown UTC uncertainty. |
| Process restart / offline replay | Raw baselines and committed attempts survive close/reopen; open attempts become crashed partial records once. Terminal IDs/hashes replay identically; wrong/non-prefix receipts cannot delete them. |
| Actual process crash | A child commits a 777-byte prefix and is SIGKILLed. Reopening its file recovers exactly 777 bytes with crashed/collection-gap status. This does not simulate storage-hardware power loss. |
| Capacity / disk failure | Logical two-record capacity preserves existing pending data and marks losses; the next counter sample rebaselines a gap. A 32-page SQLite limit is exercised until a write fails; data/rows stay bounded, status degrades, and no silent pending-data eviction occurs. |
| Local stop separation | Edge with a one-record exhausted spool still negotiates diagnostics. The simulated pod's local stop runs independently; diagnostics remain callable and shutdown closes links before accounting cleanup. No physical stopping latency is claimed. |
| Router seam | Explicit garden boundary/directions/coverage with bounded synthetic reports gives an exact 100-byte delta. Missing support, oversized/invalid snapshots, timeout and ignored cancellation retain unavailable/gap status. No vendor device or invoice is involved. |
| Linux fixture seam | Synthetic RX/TX registers preserve values above 2^53, hash interface identity, detect changed ifindex, and reject loopback as garden WAN. This checks parsing/mapping; native evidence is separate below. |

Commands: `pnpm --filter @arbi/traffic test`, `pnpm --filter @arbi/edge-controller test`, workspace `pnpm lint`, `pnpm typecheck`, `pnpm test --concurrency=1`, `pnpm build`, `pnpm docs:check`, `pnpm protocol:check`, `pnpm scenario:check` and `git diff --check`. The PR records final command outcomes and aggregate CI after rebasing onto merged peer work. Loopback listeners require host permission on this workstation; sandbox `listen EPERM` was rerun with that permission, without altering the tests.

## Native Linux collection and transfer comparison

[The native check](../../packages/arbi-traffic/scripts/linux-native.mjs) is an explicit step in [workspace CI](../../.github/workflows/ci.yml): `pnpm --filter @arbi/traffic test:linux`. It requires Linux, readable boot ID/uptime/network namespace and `lo` sysfs counters; absence fails rather than skips. This macOS host cannot execute that owning OS collector. CI evidence and exact numeric output must be read back in the PR before merge.

The test reads actual `/sys/class/net/lo/statistics/tx_bytes` and `rx_bytes` before and after real TCP streams on `127.0.0.1`. It submits a 65,536-byte prefix, deliberately interrupts that application attempt, then repeats a full 262,144-byte transfer and receives a 32,768-byte reply. The peer must receive the exact prefix/full sizes. Application attempts total 327,680 upload and 32,768 download bytes. Each loopback interface direction observes both sides' transmit/receive traffic, so each raw counter delta must be at least 360,448 bytes, including kernel overhead and any concurrent host-loopback traffic. The test logs those independently observed deltas and collection-point coverage. It does not subtract them into invented measured TLS/TURN/background categories.

Coverage is partial: the host namespace's loopback point contains both TCP directions and possibly non-ARBI traffic. This comparison proves collection and a lower-bound relationship to known-size transfers, not exact packet isolation, WAN routing, modem reset behavior or billing parity. Byte layers and duplicate loopback perspectives overlap and are never added as mobile usage. No raw interface IDs, boot IDs, private endpoint or authentication material are printed.

## Unverified external gates

The selected cabinet Linux host/image, real camera pod, filesystem power-loss/corruption recovery, systemd confinement under actual storage, physical link/SIM coverage, modem/router vendor protocol, provider charging and carrier invoice parity remain unverified. A fixture router response is not hardware integration; a native Linux runner is not installed operation. There was no loaded bench, HIL actuator, cellular WAN, provider account or physical acceptance.

#35 owns cloud ingestion and billing-period rollups; #45 owns transfer policy; #55 owns UI; #63 owns integrated cellular/router/provider evidence. Recording stays disabled/deferred. Source, host network, native CI, provider integration, bench/HIL, installed operation and qualified physical acceptance are separate facts.
