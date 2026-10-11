# Pod runtime source evidence

Work record: [#32](https://github.com/gredice/arbi/issues/32). Decision: [ADR-0026](../decisions/0026-inhibited-pod-service.md). Implementation: [guide](../software/pod-runtime.md).

Codex-executed source checks exercise the actual executable/TLS listener and the independently implemented edge module adapter. Ephemeral test certificate keys stay outside the repository. Host integration uses a trusted simulated camera and explicitly simulated health origin. Real SQLite diagnostic/usage stores survive process-epoch replacement without replaying work; canonical authorization evidence remains the edge's validated shared audit event.

Nine pod test groups check health provenance and unavailable channels, malformed/timed-out probes, bounded fixed-field logs, no-secret not-ready startup, actual edge TLS handshake/resync/correlation, duplicate and stale-session refusal, incompatible configuration and oversized input, unenrolled certificates/actuator commands/malformed JSON/stalled frames, durable informational records and usage across restart, and an actual SIGKILL/restart/SIGTERM lifecycle under the 64 MiB heap limit. Camera/gimbal adapters have no capture or move method, and each start/disconnect/shutdown invokes inhibition before cleanup.

The clean tested revision, development-host baseline and final validation counts are recorded after committing the implementation. The complete edge host suite's unmodified systemd test requires `/usr/bin/node`; this development environment lacks that path. Scoped transport/regression tests and the actual child executable use the available Node binary. CI stages the expected Node path for its edge service check. This is not selected-image confinement evidence.

| Required gate | Evidence boundary |
| --- | --- |
| Authenticated bounded service and safe restart | Source/native loopback and actual process checks |
| Camera/gimbal implementation and electrical measurements | Unavailable; output remains inhibited |
| Named Pi 3A+ image startup/restart/resource baseline | Unverified; no device is attached |
| Target systemd confinement and physical power/reset | Unverified; service definition alone cannot qualify it |
| WAN/carrier/network baseline and real camera load | Unavailable; application/LAN observations remain partial |

The issue remains open for its explicit named-device startup/restart and idle CPU/memory/temperature/network evidence. No physical acceptance or qualified sign-off is supplied.
