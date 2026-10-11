# Web–cloud–edge protocol evidence

Work record: [#62](https://github.com/gredice/arbi/issues/62). This is isolated native-host/browser simulation evidence. It does not establish real provider integration, physical stopping, camera/relay operation or installed safety.

The native harness runs the built Next.js application against its own PostgreSQL 18.4 cluster and an independent Node 24 edge controller. The controller uses the committed durable journal, manual fence/deadman, job consumer and simulated module adapters. Authentication uses an ephemeral Ed25519 credential, actual signed HTTP proofs and the same job/telemetry admission boundaries; the browser uses the protected HttpOnly session bridge.

The browser scenarios verify:

- User and separately authorized engineer modes show simulation realm and original telemetry source/receipt clocks; position is estimated and tension unavailable. Operator/engineer permissions remain distinct. Unauthorized, cross-site, device-origin and production-realm injection requests are denied.
- Protocol reordering admits an older signed sample as late history after a newer sample without regressing the current head.
- A browser-issued command completes through real cloud admission and independent local module dispatch/proof. Dropping its device completion acknowledgement causes the exact same immutable report to be retried; SQL retains one report and one command. Operation IDs establish separate local dispatch observations.
- An eight-second link outage ages readings to stale/offline. Reconnection restores current telemetry and observes the completed job without replaying it or entering manual control.
- A 1750 ms poll delay carries a real admitted command past its 1500 ms expiry. The local gate rejects it, no adapter operation dispatches for that command, the cloud records expiry, and refreshing cannot complete or restart it.

The full browser suite passes 17 scenarios. Dashboard lint/type checks, production build, ordinary/preview HTTP denial checks and Markdown links/whitespace pass. The source suite passes 79 checks with 14 native-only skips. The full native PostgreSQL suite passes 51 checks, including current-scope authorization, concurrent admissions, immutable report clocks, raw/history persistence and transaction/audit rollback. Embedded database checks remain source evidence, not WAL/fsync evidence. The projection regression preserves original ingestion age when the newest snapshot arrived through the job receiver rather than the telemetry stream.

The proxy has a 64 KiB request/response bound, eight active requests, sixteen connections, 2.5-second target deadline and 128-fact/64 KiB trace cap. It forwards only the two dedicated signed-device paths to one loopback origin. Its scenario file and traces are private, and no credential/proof body is exported. Missing physical measurements, mobile/provider meters, clock qualification, NAT/encoder selection, bench/HIL and installed review remain open gates.

The [43-fact trace excerpt](protocol-integration-trace.json) preserves actual synthetic IDs and boundary/source timestamps from the successful native run. It includes delayed admission rejection, distinct local operation dispatches, reordered signed telemetry, the repeated identical completion report and a link outage. Boundary wall times are proxy observations; they are not invented device/SQL ingestion times. The excerpt omits normal periodic polls and most repeated snapshots, and is not a continuous measured dataset.
