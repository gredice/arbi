# Pod runtime source evidence

Work record: [#32](https://github.com/gredice/arbi/issues/32). Decision: [ADR-0026](../decisions/0026-inhibited-pod-service.md). Implementation: [guide](../software/pod-runtime.md).

Codex-executed source checks exercise the actual executable/TLS listener and the independently implemented edge module adapter. Ephemeral test certificate keys stay outside the repository. Host integration uses a trusted simulated camera and explicitly simulated health origin. Real SQLite diagnostic/usage stores survive process-epoch replacement without replaying work; canonical authorization evidence remains the edge's validated shared audit event.

The initial nine pod test groups check health provenance and unavailable channels, malformed/timed-out probes, bounded fixed-field logs, no-secret not-ready startup, actual edge TLS handshake/resync/correlation, duplicate and stale-session refusal, incompatible configuration and oversized input, unenrolled certificates/actuator commands/malformed JSON/stalled frames, durable informational records and usage across restart, and an actual SIGKILL/restart/SIGTERM lifecycle under the 64 MiB heap limit. Camera/gimbal adapters have no capture or move method, and each start/disconnect/shutdown invokes inhibition before cleanup.

Clean source `fbd095d5ad2947850f2df4f4258dfd00b00f28b6` built all seven dependency workspaces from fresh local cache misses and passed all nine pod groups. The shared protocol suite passed 464 tests; 18 scoped edge framing/transport/recovery groups passed; all 25 CI planner/gate checks, pod lint/type checks, 308-file Markdown links and whitespace checks passed.

A single two-second development-host observation on Linux x64 / Node 24.19.0 used the actual inhibited child with 64 MiB old-space: 822.3 ms startup, 139,182,080 RSS bytes, 84,084 CPU microseconds over 2,012 ms (4.18% of one CPU). This includes polling/health-request overhead and is not a statistical budget or Pi measurement. Temperature was unavailable and no interface network baseline was collected. Build SHA matched the clean source with `dirty:false`; readiness stayed false and output inhibited. The complete edge host suite's unmodified systemd test requires `/usr/bin/node`; this development environment lacks that path. Scoped transport/regression tests and the actual child executable use the available Node binary. CI stages the expected Node path for its edge service check. This is not selected-image confinement evidence.

Clean follow-up `777710202b62b5be552eef620f6e042bd0282ecc` adds cancellation of startup after shutdown while camera initialization or a listener bind is pending. All ten pod groups passed with `dirty:false`, including a pending-initialization shutdown test that observes startup rejection and prevents restarting the same stopped instance. The original protocol/transport wire and source evidence remain unchanged.

| Required gate | Evidence boundary |
| --- | --- |
| Authenticated bounded service and safe restart | Source/native loopback and actual process checks |
| Camera/gimbal implementation and electrical measurements | Unavailable; output remains inhibited |
| Named Pi 3A+ image startup/restart/resource baseline | Unverified; no device is attached |
| Target systemd confinement and physical power/reset | Unverified; service definition alone cannot qualify it |
| WAN/carrier/network baseline and real camera load | Unavailable; application/LAN observations remain partial |

The issue remains open for its explicit named-device startup/restart and idle CPU/memory/temperature/network evidence. No physical acceptance or qualified sign-off is supplied.
