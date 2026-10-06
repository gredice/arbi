# Software transport feasibility: architecture selection

- Date: 2026-10-07
- Decision: [ADR-0005](../decisions/0005-software-architecture-and-deployment.md)
- Scope: provider capability review and local recovery experiment for [#13](https://github.com/gredice/arbi/issues/13)
- Baseline reviewed: `9fe1a42b5ded73b2f8f706644a8e4fa9be931406`
- Review record: self-review and repository PR review; independent provider/bench acceptance is still required

## Question and bounded result

Can an outbound realtime notification path coexist with durable authenticated HTTP recovery when connections, API workers or retained events change, without granting a notification actuator authority?

**Result:** current primary documentation supports selecting Ably for scoped notifications with external Postgres authority. A local, synthetic HTTP/SQLite experiment passes the five scenarios below. This is a bounded feasibility result. It does not test Ably, Neon, Vercel deployment, production enrollment, actual protocol/firmware, live media, TLS, carrier NAT or real stopping behavior. No provider resources, production credentials or physical devices were used.

## Provider observations

These are documentation observations on the date above, not account/provisioning measurements. Recheck availability, limits, regions and quotas during implementation.

| Primary source | Observed capability / constraint | Architecture implication |
| --- | --- | --- |
| [Vercel WebSockets](https://vercel.com/docs/functions/websockets) | Native support is currently public beta and needs Fluid compute. Connections end at function duration limits; reconnection may reach another instance/deployment. Next.js uses an experimental upgrade API. Shared state belongs outside the instance. | Native WebSockets are a viable alternative, not categorically unsupported. Select Ably initially to avoid owning this connection lifecycle alongside the API. |
| [Ably token authentication](https://ably.com/docs/auth/token), [capabilities](https://ably.com/docs/auth/capabilities) and [revocation](https://ably.com/docs/auth/revocation) | Short-lived identified tokens can restrict channel operations. Revocation must be enabled on the issuing API key before token issuance. Changing key capabilities is not an immediate permission change for existing connections. | API controls token scope/lifecycle; browser subscribes and submits intent through authorized HTTP. Test active-session revocation before live use. |
| [Ably connection recovery](https://ably.com/docs/connect/states) | Continuity is limited, typically to about two minutes. Longer loss requires reattachment and recovery of missed state; reconnect backlog is not a universal ordering guarantee. | Application snapshots, durable committed cursors and bounded replay remain necessary. Broker presence/history is not the authoritative job/audit store. |
| [Neon branching workflow](https://neon.com/docs/get-started-with-neon/workflow-primer) | Branching can include parent data; schema-only workflows are available. | Choose separate production/test projects and synthetic test data; a production-derived preview branch is not the isolation policy. PostgreSQL transaction/recovery correctness still requires implementation tests. |
| [Private Blob reads](https://vercel.com/docs/vercel-blob/using-blob-sdk) | The SDK supports private objects and server-side reads with authenticated store access. | Cloud authorizes/audits bounded still access; private storage alone does not implement site authorization or prevent a public downstream cache. |
| [Vercel GitHub integration](https://vercel.com/docs/git/vercel-for-github) | Git pushes/merges drive previews and configured production-branch deployments. | Use trusted isolated preview resources and independent module release/install workflows. A web deploy is not firmware installation. |

Provider SLA, pricing, account access, token-revocation configuration, SDK queue behavior and mobile-network performance are **unverified** here. The selection is an implementation direction, subject to the gates in ADR-0005; it is not evidence that a deployed service meets those gates.

## Executable experiment

Source: [software-recovery.test.mjs](../../scripts/spikes/software-recovery.test.mjs). Run from the repository root:

```bash
node --test scripts/spikes/software-recovery.test.mjs
```

Tested using Node.js `v24.15.0` and SQLite `3.51.3` through `node:sqlite` on the development macOS host. The harness creates temporary synthetic data, random in-memory fixture keys, loopback-only HTTP listeners and separate SQLite reader connections. Two workers share a file-backed single-writer journal; both are closed and a replacement is started. Files/listeners are cleaned up after the run. It reads no environment credentials and implements no actuator action.

The fixture's HMAC credentials, two-row page bound and fixed synthetic time are experimental controls, not the #14 protocol or production enrollment implementation. With notifications absent, clients explicitly retrieve a journal page over HTTP. An expired intent is retained as history and omitted from the fixture's current-intent list; even a current intent is only retrieved, never executed. Production consumers must separately revalidate local authority, state, lease and deadline.

| Scenario | Observed local result | Limit of evidence |
| --- | --- | --- |
| Notifications missing; next page from another worker | Scoped pages return cursors `[1, 2]`, then `[3, 5]`, then `[6]`; each contains at most two rows; expired intent is excluded from current-intent retrieval | No WSS/provider reconnect, slow-consumer load or local motion acceptance tested |
| Duplicate recovery | Both workers return identical pages; journal stays at six rows | No distributed outbox or actuator idempotency tested |
| Worker replacement | New worker reads the same persisted scoped history after the old workers close | Not a separate-process crash, Vercel deployment churn, database restore or power-loss test |
| Scope mismatch | Synthetic production key/environment and mismatched site/device fail with `401`; cross-site query fails with `403`; independently authenticated site B sees only its own row | Fixture authentication only; no assertion about deployed enrollment or provider ACLs |
| Retention gap | Recovery returns `409` and requires a snapshot; a fresh snapshot cursor yields no old work; negative cursor fails with `400` | Snapshot contains only a fixture cursor; complete state plus concurrent commit/replay consistency needs #29 |

Observed result: **6 tests passed, 0 failed** (five scenarios plus their parent). JSON response bodies totaled **1127 bytes** for this fixed workload. That count excludes request bytes, HTTP/TLS/WSS/IP framing, retransmission, reconnect handshakes and carrier accounting; it is not a mobile-data measurement or performance benchmark.

The first sandboxed run could not bind `127.0.0.1` (`listen EPERM`). The same command passed with permission for loopback listening. There was no public listener or external network use in the experiment.

## Required next evidence

- [#21](https://github.com/gredice/arbi/issues/21), [#29](https://github.com/gredice/arbi/issues/29), [#47](https://github.com/gredice/arbi/issues/47): nonproduction provider integration with scoped enrollment, actual token expiry/revocation, separate resources, multi-instance routing, deployment changes, broker outage, reconnect beyond continuity windows, bounded SDK queues/backoff, event gaps and commit-safe concurrent snapshot/replay. Negative test credentials must fail at every production boundary before enrollment is enabled.
- [#23](https://github.com/gredice/arbi/issues/23), [#30](https://github.com/gredice/arbi/issues/30): actual Linux supervision, local adapter deadlines, SQLite/filesystem crash and power-loss durability, disk exhaustion and recovery; none may disable stopping.
- [#26](https://github.com/gredice/arbi/issues/26), [#63](https://github.com/gredice/arbi/issues/63): real interface/transfer counters, reconnect/retry/overhead attribution and carrier comparison. Select heartbeat/recovery intervals from measured usage rather than this response-body count.
- [#43](https://github.com/gredice/arbi/issues/43): Pi 3A+ encoder/resource/capture-concurrency measurements, mobile carrier NAT and relay-only trials, stream topology, per-viewer authorization/revocation and WAN/downstream accounting before selecting live-media runtime/provider.
- [#15](https://github.com/gredice/arbi/issues/15), [#78](https://github.com/gredice/arbi/issues/78), [#79](https://github.com/gredice/arbi/issues/79): local safety authority, update interruption/recovery and staged physical release evidence. Source/simulation acceptance cannot establish field safety or update-safe parked line clearance.
