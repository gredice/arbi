# ARBI edge controller

Executable **development-host prototype** for [#23](https://github.com/gredice/arbi/issues/23), implementing [ADR-0008](../../docs/decisions/0008-edge-host-and-local-transport.md). It runs only an isolated `test` realm in `simulation` mode. Diagnostic readiness never enables physical actuation, updates or recording. It implements local connection supervision and bounded state/telemetry admission; optional local jobs, commissioning and cloud recovery are described below; real firmware remains follow-up work.

## Run from the repository root

Use Node.js 24.15.0 (repository minimum 24), pinned pnpm and OpenSSL for disposable test certificates:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @arbi/edge-controller simulate
```

The process generates a private temporary certificate directory, starts two loopback test peers and prints one JSON startup record containing an ephemeral `healthPort` and fresh edge identity. Read `http://127.0.0.1:<healthPort>/healthz` and `/readyz`. Send SIGINT or SIGTERM to close sockets, cancel reconnects, stop the peers and remove temporary credentials. Keys, certificates and configuration paths are never printed. Abrupt process termination may leave its private temporary directory; remove that disposable directory locally after stopping its processes. No generated credential belongs in Git.

`/healthz` returns 200 while the process serves requests. `/readyz` returns 503 until both authenticated peers provide compatible current snapshots, and again on disconnect, expiry or shutdown. Both expose build source digest/version, protocol, new boot/session identity, exact accepted applied configuration identity, module identities, inhibits and configured capabilities. The build digest includes app sources, compiler settings, dependency lockfile, Linux service definition, protocol schemas and built protocol consumers. The historical `appliedBy` remains distinct from the current boot identity. Health binds loopback and limits connections/headers. The default runtime accepts only GET health/readiness; trusted commissioning composition can add the separately authenticated routes described below.

For externally hosted synthetic peers, a private `arbi.edge/1.0` manifest specifies the bounded applied configuration record, independently accepted configuration digest, the edge's certificate file paths and exactly two local enrollment entries. Entries bind module ID/role, loopback port, DNS certificate name and certificate SHA-256. There is no discovery of arbitrary network addresses or trust-on-first-use enrollment. `createSimulation()` in [simulation.ts](src/simulation.ts) produces the executable reference manifest from the committed protocol fixture. Invalid, oversized, unsupported, non-test or hardware configuration exits 78 before opening health or module sockets. This loader only restores a previously accepted synthetic record; optional commissioning is a separate trusted composition.

```sh
node apps/arbi-edge-controller/dist/cli.js --config /absolute/private/simulation.json
node apps/arbi-edge-controller/dist/supervisor.js --config /absolute/private/simulation.json
```

The second command is a portable child-process supervision prototype: at most five starts per minute, 250 ms retry delay on crash, no retry for exit 0 or invalid configuration (78), SIGTERM then SIGKILL after five seconds on shutdown. It has no command journal and replays no commands. Linux uses [the systemd unit](deploy/arbi-edge-controller.service), not the development supervisor. The `/opt/arbi` and `/etc/arbi-edge` paths are installation templates, not a private deployment. An operator must stage the immutable repository build and Node 24 runtime at the declared paths, create the dedicated unprivileged account, and supply private synthetic configuration/credentials before starting it. See the ADR for privileged installation, service confinement and the unfulfilled selected-host acceptance gate.

## Adapter boundary

See [the transport specification and evidence](../../docs/software/edge-runtime.md). `ModuleAdapter` connects using TLS 1.3 mutual authentication and certificate pinning. A fresh challenge, source identity, protocol, test realm/site and accepted configuration digest precede the initial snapshot. Discovery verifies existing enrollment; it cannot grant new trust. The prototype exposes only `state.resync`, authorized explicitly to the synthetic `simulation-diagnostics` service through a bounded, single-use grant. TLS host identity is never human authority. No human permission, UI mode, cloud grant or opaque object can enable actuators here.

The simulated module independently admits that diagnostic command through `@arbi/protocol`. Source/configuration/capability/cursor checks apply to received snapshots and telemetry. Configured unavailable readings retain empty capability qualities; driver encoders and line tension do not become measured data. The simulated module remains locally inhibited and its local stop function has no edge/cloud dependency. This is a source boundary demonstration, not proof of independent physical stopping or a firmware watchdog.

## Validation

```sh
pnpm --filter @arbi/edge-controller lint
pnpm --filter @arbi/edge-controller typecheck
pnpm --filter @arbi/edge-controller test
pnpm --filter @arbi/edge-controller build
pnpm protocol:check
pnpm docs:check
git diff --check
```

Tests require loopback listening, child processes and OpenSSL. Linux additionally requires `systemd-analyze` and the same Node version staged at the unit's declared `/usr/bin/node` path; CI provisions that path explicitly before verifying the unmodified unit. They use disposable synthetic credentials, the current configuration fixture and protocol message vectors. The [committed evidence record](../../docs/evidence/edge-runtime-prototype.md) identifies what was run and which Linux, hardware and physical gates remain unverified.

## Traffic metering

Optional private `metering` settings contain `spoolFile`, `maxRecords`, `maxBytes`, `maxPages` and `linuxLoopback`. Omission is explicitly `not-configured`; there is no implicit production path. Place the file in the service's private `StateDirectory=arbi-edge` when configured. The synthetic `--simulate` consumer uses temporary edge and pod SQLite files, 2,048 records/16 MiB reserved bytes/1,024 pages each, and deletes them only on fixture disposal. These starting budgets are not qualified selected-host capacity.

Authenticated module socket frames are tapped through [@arbi/traffic](../../packages/arbi-traffic/README.md); the simulated pod exercises the same library. Current endpoints and optional five-second Linux `lo` counter collection remain LAN-only. Health exposes partial application coverage, unknown UTC uncertainty, unavailable garden WAN/provider counters, and durable/volatile spool degradation. Counter/payload/provider layers remain separate. Physical actuation, readiness authorization and local stops do not depend on metering health. See [semantics](../../docs/software/device-traffic-metering.md) and [host evidence](../../docs/evidence/device-traffic-metering.md).

## Independent cloud recovery consumer

`pnpm --filter @arbi/edge-controller recover:cloud` runs [the separate diagnostic recovery executable](src/cloud-realtime/cli.ts) after build, with private protected `ARBI_CLOUD_RECOVERY_CONFIG`. [Realtime documentation](../../docs/software/realtime-recovery.md) owns exact fields, current enrollment, scoped short-lived Ably tokens, native PostgreSQL/HTTP recovery, retry/catch-up/traffic limits and the external provider/mobile gate. It does not import the local runtime, supervisor or jobs executor, cannot dispatch actuators and is never started by the existing supervisor. Snapshot/hint/job-poll receipt sends no device acceptance or completion. The [host record](../../docs/evidence/realtime-recovery.md) covers real SDK transport fixtures and a separately spawned consumer/cloud process, not a real provider account or cellular network.

## Durable local job slice

Optional bounded SQLite job storage, transactional audit intent, current local policy and an explicit bounded simulator consumer are documented in [local jobs](../../docs/software/local-jobs.md) with [host evidence](../../docs/evidence/local-jobs.md). Normal TLS enrollment remains diagnostic-only. Run the isolated reference with `pnpm --filter @arbi/edge-controller simulate:jobs --directory /tmp/arbi-isolated-jobs` after building its dependencies. Physical motion, firmware, image bytes and updates remain inhibited/unimplemented.

## Authorized commissioning

[Local commissioning](../../docs/software/commissioning.md) adds authenticated technician enrollment, independent local maintenance authorization, exact-set review, multi-device staging/activation, readiness invalidation and deliberate restart recovery. [Host evidence](../../docs/evidence/commissioning.md) covers fictional site/bed/plant framing and SIGKILL after an independent device commit. Trusted `composeCommissioning` mounts protected loopback handlers and automatically binds its inhibit to local job policy. The dashboard can read its protected identity/block-reason projection. No default runtime or private settings file creates commissioning authority. Run the explicit simulation recipe with `pnpm --filter @arbi/edge-controller simulate:commissioning --directory /tmp/arbi-isolated-commissioning`. Hardware/physical validation remains disabled.
