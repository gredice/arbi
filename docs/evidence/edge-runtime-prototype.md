# Edge runtime development-host prototype evidence

- Date: 2026-10-07
- Work record: [#23](https://github.com/gredice/arbi/issues/23)
- Tested implementation: [edge controller 0.1.0](../../apps/arbi-edge-controller/README.md), build `sourceDigest` generated from committed build inputs; the PR/merge revision identifies the reviewed source.
- Configuration: committed synthetic `@arbi/protocol` configuration 1.0 fixture, `test/fixture-run`, `synthetic-site`, `simulation`, `config-1`; temporary per-run credentials and loopback endpoints.
- Equipment/runtime: macOS development host, Node 24.15.0, pnpm 11.5.2, OpenSSL CLI, child processes and localhost TLS. No selected cabinet host, Linux init system, real Pico or camera pod was connected.
- Reviewer: implementation self-review; repository PR records independent/automated review when available.

## Executed source and development-host checks

`pnpm --filter @arbi/edge-controller test` registers [16 checks](../../apps/arbi-edge-controller/src/edge.test.ts). The macOS run passed 15; Linux-only `systemd-analyze verify` was skipped because this host has no Linux systemd. `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm protocol:check`, `pnpm docs:check` and `git diff --check` passed. Aggregate CI and Linux-only unit syntax results must be recorded in the PR before merge; they remain distinct from physical evidence.

| Scenario | Observation / limit |
| --- | --- |
| Framing / reference compatibility | Current protocol fixtures survive fragmented and coalesced framing; zero/oversized lengths, malformed JSON and invalid UTF-8 reject. Configuration fixture is consumed through its owning validator. |
| Invalid startup | Unknown schema, hardware mode, wrong accepted/applied digest, bad enrollment, remote endpoint and unknown fields reject before sockets. Executable exits 78; supervisor does not restart it. |
| Stop during startup | Shutdown while the health bind is pending settles both operations, opens no module connection and leaves no running health server. A reproduced unresolved-start race was repaired before delivery. |
| Diagnostic health | GET health/readiness exposes current build/protocol/boot and exact applied identity; mutation request receives 404. Unavailable Pico tension retains empty qualities. Actuation, recording and update flags stay false. |
| Disconnect / reboot | Readiness drops, old grant fails, new module boot/session must negotiate and snapshot. Fresh service diagnostic succeeds once; duplicate/tampered grant fails. |
| Silent / partial stream | Partial frame cannot extend readiness; receiver timeout removes readiness and old grant. This establishes diagnostic expiry, not physical stopping time. |
| Hostile / incompatible peer | Version, realm, site and configuration mismatch, incorrect pinned certificate, oversized/malformed messages and stale source/sequence remove readiness. Recovery needs a fresh compatible handshake. |
| Accepted audit consumer | Synthetic diagnostic authorization validates audit 1.0 with no device effect or receipt; ring retains 32 records and exposes dropped count, without durable claims. |
| Crash supervisor | A real child edge process is SIGKILLed; the portable supervisor restarts it with a new boot, and both peers observe zero actuator or replayed diagnostic requests. Clean supervisor stop produces child exit 0 and no restart. No previously executing physical command existed. |
| Independent local stop boundary | Always-inhibited test peer's separate local stop function remains callable through edge/link failure. No independent circuit, actuator, watchdog stop latency or load restraint was tested. |

## Unverified gates

The Linux systemd definition is source configuration; no systemd process/restart, cgroup limit, device sandbox or network rule was exercised on this macOS host. Linux source checks require the test runtime at the unit's declared `/usr/bin/node` path and verify its version matches the running tests. CI explicitly stages the pinned setup-node binary there before running the unchanged unit through `systemd-analyze verify`. The Linux CI unit check passed after this staging fix; it validates directives and executable availability, not a running service or deployment. The portable child test demonstrates the supervision boundary only. Before hardware activation, run unit verification and crash/SIGTERM/invalid-config/reconnect tests on the exact reviewed Linux image/host, inspect effective confinement and record worst-case resource use. Linux CI running portable tests is still not selected-host evidence.

CI package suites and ordinary dashboard fixture files run sequentially to avoid competing database/peer startup starving bounded loopback requests. The media admission assertion preserves its expected status and reports only a redacted failure code. An additional Linux CI run aborted inside V8's `UnregisterWasmAllocation` with `jit_page_->allocations_.erase(addr) == 1`, matching [Node #66366](https://github.com/nodejs/node/issues/66366) and the [upstream V8 fix](https://github.com/v8/v8/commit/9b8ca54d5a). The finite PGlite test process uses a documented test-only `--no-wasm-code-gc` workaround; application runtimes and native PostgreSQL checks keep default V8 behavior. No acceptance assertion or production deadline was relaxed. See the [dashboard fixture notes](../../apps/arbi-dashboard/README.md) for scope and the removal gate. Aggregate required CI must still pass before merge.

Exact cabinet host, OS image/architecture, power conversion/protection, thermal/storage qualification, recovery console/media, USB/serial isolation/EMI, real pod LAN authentication and module firmware interoperability remain unresolved. Physical stopping, total-power-loss restraint, update-safe line clearance, accepted calibration/commissioning and qualified installation are separate gates under [ADR-0006](../decisions/0006-local-safety-authority-and-instrumentation.md). No fixture or green CI clears them.

Durable jobs, audit/usage storage quotas, WAN/carrier attribution, cloud enrollment/broker, firmware installation, live capture and updates are outside this slice. There are no live provider credentials or deployment claims.
