# ADR-0014: Bounded live-session authority

- Status: Accepted when merged; proposed until then
- Date: 2026-10-11
- Work record: [#38](https://github.com/gredice/arbi/issues/38), parent [#4](https://github.com/gredice/arbi/issues/4)
- Evidence: [native session tests](../evidence/live-sessions.md)

## Decision

One durable authority owns viewer grants, signaling, renewal, end, administrative revocation, policy decisions and desired producer demand. It uses the existing current Gredice directory/resource boundary and the inventory transaction lock. Each viewer retains its original human actor/session and audit intent; there is at most one upstream producer per registered device. Independently authorized viewers share that producer while retaining separate grants and downstream limits.

Only explicit isolated composition is implemented. A trusted device-approval callback and mandatory bandwidth evaluator select from at most four bounded `isolated-signaling` profiles. No physical transport, endpoint, TURN credential, producer, token key or fixture identity is a deployment default. Production realms and branch previews cannot select this test path. NAT/relay and camera runtime selection remain [#43](https://github.com/gredice/arbi/issues/43) prerequisites for physical media implementation.

Viewer tokens bind realm, site, producer/device/boot/configuration, profile, actor, human session, epoch and original expiry. Leases last at most 15 seconds; a logical session lasts at most five minutes and grants at most 32 token epochs. Renewals require an unexpired current token, current human permission and a fresh bounded policy result. Renewal invalidates earlier epochs. Tokens are returned privately, never stored as credential strings in audit. End, administrative revocation and device/configuration replacement remove authority. A denied policy has a durable intent/denial and no token; successful grants are recorded individually.

Each producer has one replaceable desired generation, rather than an unbounded command queue. Admission commits with required audit before external adapter work. Adapter delivery retries the identical generation after a lost acknowledgement. Adapters must fence earlier generations, deduplicate signaling tuples and expire demand independently of cloud/client activity. The implemented adapter has no encoder, relay, network media or actuator; its monotonic lease checks establish only isolated host behavior. HTTP admission, adapter lease acknowledgement and connection observations remain distinct.

Registered devices may submit bounded Ed25519-signed connection reports through a dedicated credential boundary. The authority derives the original viewer actor and scope from the stored grant and preserves device source clocks. Immutable report deduplication resolves a lost end acknowledgement after closure. A signed connection report is an observation, not first-frame evidence, measured WAN traffic or mechanical state. Browser playback reports use separate `browser-observation` evidence and remain advisory; they cannot renew a lease, establish device playback or supply delivered-byte evidence.

## Bounds and recovery

The site admits at most 16 active viewers, four per device/profile, 32 producer identities, 4096 viewer records and 4096 immutable device reports. Policy history contains at most 33 append-only decisions per viewer. Signaling has one pending sequence per viewer and a 4 KiB message/reply limit. HTTP permits four active calls per server instance and an 8 KiB body; dependency/adapter calls have 750 ms bounds. Full ledgers fail capacity explicitly until a reviewed privileged retention extension is available.

Migration `0011-live.sql` preserves immutable identity, closed sessions, policy history and reports. Active live intents cannot be retired through the audit steward. Isolated backup fingerprints include the new tables; restoring an older snapshot permits only newly introduced empty tables. Restore quarantine closes viewer authority, fences desired demand to zero, retains immutable evidence and clears delivery observations. It does not assert that an external producer stopped or rotate unimplemented provider credentials. No automatic reactivation is added.
