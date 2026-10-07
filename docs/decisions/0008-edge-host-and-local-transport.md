# ADR-0008: Edge host and bounded local transport

- Status: Accepted when merged; proposed until then
- Date: 2026-10-07
- Work record: [#23](https://github.com/gredice/arbi/issues/23), parent [#6](https://github.com/gredice/arbi/issues/6)
- Prerequisites: [ADR-0005](0005-software-architecture-and-deployment.md), [ADR-0006](0006-local-safety-authority-and-instrumentation.md), [configuration 1.0](../software/configuration.md)
- Evidence: [development-host prototype](../evidence/edge-runtime-prototype.md)

## Context

The selected edge runtime is supervised Node.js/TypeScript on Linux, with future SQLite/filesystem persistence. It owns local policy and orchestration; the Pico owns synchronized STEP/DIR and independent local command deadlines, and the existing Pi camera pod owns camera/gimbal behavior. Neither the physical cabinet host nor its power, storage, recovery access or module wiring is accepted. A transport prototype must not silently select Wi-Fi as the motion control loop or reuse the camera pod as the edge.

## Decision

Select Debian 13 with systemd and the repository-pinned Node 24 runtime as the **target OS/runtime**, and implement TLS 1.3 framed local diagnostic transport against two loopback simulated modules now. **Hardware activation is blocked** until a reviewed host/interface amendment identifies the exact cabinet host, manufacturer/revision, storage medium, power supply/converter/protection, thermal/environmental envelope, networking and recovery access, and links their evidence. No physical host SKU, purchase or BOM change is accepted by this ADR. Debian supports the target amd64/arm64 class; actual architecture/image and driver support must be verified for the eventual selection.

The selected-host minimum **starting budget**, pending measurement, is a separate cabinet Linux machine with two CPU cores, 4 GiB RAM and at least 64 GiB nonvolatile storage. Prefer serviceable eMMC/SSD with documented power-loss behavior over an unqualified removable card. The existing Pi 3A+ camera pod is not this host. A dedicated wired cabinet link to the Pico is required before motion firmware activation; USB serial or an electrically reviewed isolated serial interface remains unresolved. Its connectors, framing/authentication, throughput, EMI, reset effects and privileges must be reviewed together with #31 and the cabinet design. This TLS simulation is not a claim that the Pico can run TLS, nor a replacement for synchronized local STEP/DIR. Pod LAN TLS is a candidate physical adapter after its networking and runtime tests; the current implementation accepts loopback only.

| Budget or requirement | Prototype enforcement / unresolved acceptance |
| --- | --- |
| Process memory / CPU | systemd 384 MiB high / 512 MiB maximum, one CPU quota; Node 256 MiB old-space limit. Actual RSS/CPU under load on selected host unverified. |
| Processes / handles | systemd 32 tasks, 128 file descriptors, no core dumps. Prototype uses one edge child and two test peers; Linux enforcement unverified locally. |
| Module connections | Exactly two enrolled modules, one active connection per module; no wildcard endpoint or network scan. |
| Frames / queue | 4-byte length plus at most 16,384 bytes; fixed bounded decoder allocation per link; at most 32 incoming frames/second/link and 32,768 queued output bytes. Overflow disconnects and clears grants; no command replay queue. |
| Freshness / reconnect | 1,500 ms accepted-message/handshake timeout; reconnect starts at 250 ms, doubles to 5,000 ms plus up to 25% jitter. These diagnostic bounds are not physical stopping limits. |
| Grants | At most 16 per module; 500 ms expiry; single-use diagnostic grants bind edge boot/session, module boot/session and connection generation. |
| Health / configuration | Loopback health: 8 connections, 4 KiB headers, 2-second request/header bounds. Settings max 256 KiB; individual credential files max 16 KiB. |
| Future durable storage | Reserve at least 2 GiB free for OS/recovery and control/fault evidence; propose 128 MiB journal, 256 MiB audit/usage outbox and 8 GiB capture spool. These quotas are requirements for #30/#51/#66, not implemented disk accounting or durability. Disk-full must inhibit new affected work without delaying stopping. |
| Recovery | Five supervisor starts/minute, bounded stop; no restored moving state or lease. Readiness needs fresh authenticated state after every crash. Recovery image, storage corruption, power-loss and manual access proof remain gates. |

## Supervision, power and recovery

The [Linux service](../../apps/arbi-edge-controller/deploy/arbi-edge-controller.service) runs one foreground process under a dedicated `arbi-edge` account. `Type=exec` only proves execution of the binary; HTTP readiness proves the diagnostic handshake/configuration state. `Restart=on-failure` retries crashes after two seconds, and start limiting requires operator attention after five starts in a minute. Exit 78 prevents a restart loop on invalid configuration. SIGTERM closes health and module sockets and cancels reconnects; systemd terminates the control group after five seconds if shutdown stalls. A portable [child-process supervisor](../../apps/arbi-edge-controller/src/supervisor.ts) exercises the development boundary; it is not a systemd test or a substitute for a selected-host record.

The initial service needs no root, GPIO, serial, camera, raw network, firmware flashing or administration capability. Root/operator privileges are required only to provision the immutable `/opt/arbi` release, Node binary, service account, protected `/etc/arbi-edge` synthetic manifest/credentials and unit. The service has an empty capability bounding set, private devices, read-only system/home protection, closed device policy, loopback-only network policy and private temporary storage. No `dialout`, GPIO or broad device group membership is granted. Any real device access needs a reviewed exact-device allowlist, least-privilege udev rule and measured reset/disconnect behavior in a later adapter change. Confinement support and effective enforcement must be inspected on the selected Linux image.

The cabinet's nominal 48 V baseline is not permission to connect an arbitrary computer/converter. Exact DC conversion, current/inrush, protection, earthing, enclosure, cooling, brownout behavior and safe power-off restraint are unresolved. UPS/hold-up alone is not a stopping guarantee. Before hardware activation, document accessible physical isolation and local console/recovery media, read-only diagnostic access, authenticated maintenance access on a bounded network, offline backup/restore, and deliberate return-to-service procedures. Do not expose an inbound Internet administration port. OS/application updates remain disabled until #44/#76/#78 and target-specific restraint/recovery gates pass.

The OS owns wall-clock synchronization. Protocol local freshness/deadlines use process monotonic clocks and boot/session identity; unrelated module clocks are not subtracted. Prototype source UTC is null with unknown uncertainty. Wall-clock correctness, offline drift, carrier/WAN accounting, power-loss SQLite durability and firmware watchdog timing are not established by this work.

## Transport and authority

The [local transport specification](../software/edge-runtime.md) binds mutual TLS certificate trust plus an exact pinned enrolled certificate to the module role and test installation. Private local module identity is separate from cloud enrollment #21 and human authorization #17. This synthetic provisioning seam cannot enroll production devices. New credentials/endpoints require deliberate local manifest replacement and service restart; no discovery response adds trust. A certificate, protocol-compatible snapshot or `Ready` state grants no actuator or update authority.

The edge initiates local connections and accepts state/telemetry only from a current negotiated identity. Malformed, oversized, flooded, unauthenticated, incompatible, wrong-site/realm/configuration, replayed or stale peers lose readiness. Disconnect/restart invalidates local grants before reconnect; a new challenge, module session and snapshot are required. There is no prior-command replay or operator lease restoration. This slice allows only an explicitly authorized synthetic service diagnostic `state.resync`; jobs, manual leases, captures and actuators remain absent.

Local stopping/fault inhibition must remain independent of the Linux process, database, Internet, audit upload and supervisor. The simulated peers are always inhibited and expose a separate local stop function. This does not establish a physical stop circuit, safe torque removal or line restraint. Driver encoders do not report measured Pico position or line tension. `Parked` is not update-safe.

## Alternatives and consequences

Reuse the camera pod as edge: rejected because it changes accepted ownership and resource/failure domains without evidence. Wi-Fi motion generation: rejected because synchronized motion and local stopping belong to the Pico. Unauthenticated TCP or trust-on-first-use discovery: rejected because reconnection could adopt a hostile module. Selecting a specific computer without cabinet power/storage/environment facts: deferred behind the explicit activation gate allowed by #23.

The prototype provides an executable connection boundary for later consumers while leaving the exact host and real transports reviewable. #30 owns durable local workflow, #40 calibration activation, #29 cloud broker, #31/#32 actual module runtimes; #79 retains installed and qualified physical acceptance. Closing #23 can accept the OS, source slice and honestly labeled development prototype; it clears none of those gates.

## Primary references checked 2026-10-07

- [Debian 13 release information](https://www.debian.org/releases/trixie/): target distribution selection, not image qualification.
- [Node TLS documentation](https://nodejs.org/api/tls.html): explicit peer verification, client authentication and ALPN; runtime behavior is tested on pinned Node 24.15.0.
- systemd v257 primary manuals: [service](https://github.com/systemd/systemd/blob/v257/man/systemd.service.xml), [execution](https://github.com/systemd/systemd/blob/v257/man/systemd.exec.xml), [resource controls](https://github.com/systemd/systemd/blob/v257/man/systemd.resource-control.xml). The selected image must verify both unit syntax and effective restrictions.
