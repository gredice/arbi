# ARBI edge controller

Executable **development-host prototype** for [#23](https://github.com/gredice/arbi/issues/23), implementing [ADR-0008](../../docs/decisions/0008-edge-host-and-local-transport.md). It runs only an isolated `test` realm in `simulation` mode. Diagnostic readiness never enables physical actuation, updates or recording. It implements local connection supervision and bounded state/telemetry admission; job persistence, commissioning, cloud connectivity and real firmware belong to subsequent issues.

## Run from the repository root

Use Node.js 24.15.0 (repository minimum 24), pinned pnpm and OpenSSL for disposable test certificates:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @arbi/edge-controller simulate
```

The process generates a private temporary certificate directory, starts two loopback test peers and prints one JSON startup record containing an ephemeral `healthPort` and fresh edge identity. Read `http://127.0.0.1:<healthPort>/healthz` and `/readyz`. Send SIGINT or SIGTERM to close sockets, cancel reconnects, stop the peers and remove temporary credentials. Keys, certificates and configuration paths are never printed. Abrupt process termination may leave its private temporary directory; remove that disposable directory locally after stopping its processes. No generated credential belongs in Git.

`/healthz` returns 200 while the process serves requests. `/readyz` returns 503 until both authenticated peers provide compatible current snapshots, and again on disconnect, expiry or shutdown. Both expose build source digest/version, protocol, new boot/session identity, exact accepted applied configuration identity, module identities, inhibits and configured capabilities. The build digest includes app sources, compiler settings, dependency lockfile, Linux service definition, protocol schemas and built protocol consumers. The historical `appliedBy` remains distinct from the current boot identity. Health binds loopback, limits connections and headers, and accepts only GET health/readiness; it provides no work or control API.

For externally hosted synthetic peers, a private `arbi.edge/1.0` manifest specifies the bounded applied configuration record, independently accepted configuration digest, the edge's certificate file paths and exactly two local enrollment entries. Entries bind module ID/role, loopback port, DNS certificate name and certificate SHA-256. There is no discovery of arbitrary network addresses or trust-on-first-use enrollment. `createSimulation()` in [simulation.ts](src/simulation.ts) produces the executable reference manifest from the committed protocol fixture. Invalid, oversized, unsupported, non-test or hardware configuration exits 78 before opening health or module sockets. Configuration activation/review is not implemented; this loader only restores a previously accepted synthetic record.

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

Tests require loopback listening, child processes and OpenSSL. They use disposable synthetic credentials, the current configuration fixture and protocol message vectors. The [committed evidence record](../../docs/evidence/edge-runtime-prototype.md) identifies what was run and which Linux, hardware and physical gates remain unverified.
