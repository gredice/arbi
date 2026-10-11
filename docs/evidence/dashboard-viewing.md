# Dashboard viewing source evidence

[#65](https://github.com/gredice/arbi/issues/65),
[guide](../software/dashboard-viewing.md),
[ADR-0042](../decisions/0042-explicit-dashboard-viewing.md).

The source composition uses the actual built Next.js app, Chromium, protected
HttpOnly cookie bridge, current Gredice directory, native PostgreSQL 18.4 and
the existing live/session/policy/audit owners. Signaling is simulated and opens
no browser media payload connection. Native encoded fixture TCP payload evidence
belongs to [#60](live-producer.md), separately from these browser observations.

| Check | Source expectation | Physical/transport evidence |
| --- | --- | --- |
| Page/Images/overview/inventory | Zero Start/signaling requests and no media element | Production autoplay unverified |
| Explicit Start, two viewers | Separate server IDs, one producer, scoped current authority | Physical concurrency unavailable |
| Heartbeat/renew | Epoch rotates within original deadline; no second Start | Selected transport reconnect unavailable |
| Revoke/hidden/offline/reload | Closure/clear; reconnect cannot start another session | Physical shutdown timing unavailable |
| Low-data/essential-only | Original policy owner rejects higher profile/optional media | Carrier allowance enforcement unavailable |
| Measurements absent | Unavailable bytes and unobserved playback, distinct from profile estimates | WAN/TURN/player counters unavailable |
| Camera controls | Existing observed local policy remains sole gesture gate | Physical settling/interlocks unverified |

Fixtures declare source/configuration and application-budget policy. The
server-owned 15-second lease is the fallback for lost browser closure or an
unknown start result. This records prototype source checks, not production video,
physical resource/timing measurements or public operation acceptance.

Validation results and clean source identity are recorded after the checks
complete. #65 remains open for its hardware-dependent media validation.
