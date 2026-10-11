# Isolated live producer evidence

[#60](https://github.com/gredice/arbi/issues/60),
[guide](../software/live-producer.md),
[ADR-0041](../decisions/0041-isolated-live-producer.md).

The host reference uses Node 24.19, native private SQLite, actual bounded PNG
encoding/decoding, localhost TCP payload sockets and isolated PostgreSQL 18.4.
Registered fixture device proofs are real ephemeral Ed25519 signatures. Gredice
authorization, original viewer grants, policy, immutable audit and signed usage/
delivery readback use their existing service owners. No physical camera,
selected SBC, Internet provider, cellular link or TURN service was exercised.

| Scenario | Host evidence | Remaining gate |
| --- | --- | --- |
| Boot without demand | Zero encoder calls/camera owners/payload | Hardware boot |
| Two viewers | One encoder/uplink; independent TCP receivers, sessions and actors | Physical concurrency/resource measurement |
| Revoked viewer | Current permissions close original grant; stale frame sends no viewer payload; explicit newer demand serves remaining viewer | Production transport revocation bound |
| Expiry/restart/replay | Expired/stopped generations cannot reopen; native generation journal survives owner replacement | Physical pod restart |
| Idle with frozen UTC | Independent monotonic idle shutdown releases camera | Selected-host timing |
| Health/resource/capture/update conflict | Stops, no old-demand automatic recovery | Actual local inputs/camera contention |
| Budget exhausted/wrong ACK/lost sink | Camera released; bounded timeout quarantines owner | WAN outage/provider behavior |
| Signed usage and audit | Actual payload windows, distinct viewer IDs, same upstream ID; aggregate counts shared uplink once | Carrier/WAN/TURN and full lifecycle completeness |

Payload windows describe the complete narrowly measured fixture payload interval.
Overall delivery coverage remains partial. TCP/IP overhead, retransmissions,
carrier billing, relay paths and playback duration are not inferred from packet
envelope or payload counters. An attempted revoked frame can still count at the
private upstream before admission rejects every viewer; accepted producer
receipts and conservative encoded budget charges remain distinct.

Validation results and clean source identity are recorded after the source
checks complete. Physical and production transport gates remain unverified;
this source report cannot close the bench-dependent issue.

Clean source 89aa7ef612ff71d3d0acbc4135fd5f0c4aa613ee passed all 16 forced
Edge/Dashboard/dependency build, lint and typecheck tasks; 13 native producer
tests (2.263 seconds); the protocol's closed-demand validation test; and all
74 native PostgreSQL checks (49.712 seconds). The database run includes actual
two-viewer TCP payload delivery, signed usage/readback, revocation, independent
expiry and permission changes during policy evaluation. The evidence-only
follow-up changes no tested source. Tests use private fixture identities,
declared health/configuration and the encoded synthetic PNG described above.
