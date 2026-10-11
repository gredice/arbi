# Live-session authorization and isolated signaling

[#38](https://github.com/gredice/arbi/issues/38) implements the prototype authority described by [ADR-0014](../decisions/0014-live-session-authority.md). [Evidence](../evidence/live-sessions.md) covers native database, isolated adapter and HTTP boundaries. The real camera/NAT transport remains unselected and unavailable.

`createLiveServer` requires a trusted current identity/resource directory, native database, private token key, bounded profiles, registered-device approval, current bandwidth evaluator and adapter. Nothing synthesizes those inputs on application startup. Apply the additive `0011-live.sql` after enrollment, audit/jobs and audit lifecycle migrations using the private operator command `pnpm --filter @arbi/dashboard db:migrate:live`. Migration grants no application privileges or media capability.

The configured `/api/sites/:siteId/live/:action` surface accepts protected POST actions:

| Action | Required authority | Purpose |
| --- | --- | --- |
| `start` | Current human `live.view` | Deduplicated request key, approved registered device and configured profile; commits a separate viewer grant |
| `state` | Same original human session and `live.view` | Observes admission, expiry, policy, producer acknowledgement and connection provenance |
| `renew` | Same human session, current viewer token and `live.view` | Rechecks current policy; rotates token epoch within the absolute lifetime |
| `end` | Same original human session and `live.view` | Removes the viewer's authority without requiring a still-valid media token |
| `revoke` | Current `configuration.write` | Records the administrator's request/result and closes the selected viewer |
| `signal` | Same human session, viewer token and `live.view` | One bounded pending sequence; exact reply retry, contradictory/older sequence rejection |
| `advisory` | Same human session, viewer token and `live.view` | Browser-only playing/ended claim; at most one per five seconds and 32 per session |
| `device` | Current approved device/boot/configuration and scoped Ed25519 proof | Immutable connected/ended observation; browser Origin/bearer requests denied |

Human mutations retain exact-origin and request-header checks. Bodies cannot supply role, actor, account, arbitrary endpoint, relay credentials or another realm. Device proof lifetime is at most two seconds. The signed report must name the current viewer epoch and producer generation. A stored identical report may be acknowledged after logical closure, while contradiction, stale scope or forged proof cannot change demand.

Profiles expose declared upstream/downstream rates and maximum viewers. The mandatory evaluator receives current context, approved device, profile and whether an upstream is shared. It returns a versioned allow/deny reason, accounting layer, remaining bytes and permitted upstream rate. Unknown accounting or insufficient policy bounds cannot grant media. Append-only decision history preserves the policy inputs/results on renewal; it does not convert a declared rate into measured usage. Required control and local stopping do not depend on this optional media adapter.

Producer delivery follows COMMIT. An adapter acknowledgement of `leased` means the adapter accepted a bounded desired lease; it does not mean a browser received a frame. The initial `observedConnection` is `unobserved`; only enrolled-device reports change it to `device-reported-connected`/`device-reported-ended`. Browser reports appear separately as advisory. Their observer boot identifier is the server-issued viewer epoch and their supplied clocks remain unverified browser evidence. Neither report channel asserts physical motion state or carrier billing.

The implemented adapter supplies simulated signaling answers and independent monotonic expiry/fencing checks. It opens no camera, video socket, encoder, relay or motor. Selecting a real transport requires the baseline hardware feasibility decision, authenticated producer composition, measured resource/concurrency limits and separately reviewed relay/provider credentials. Detailed observed intervals and byte instrumentation are owned by [#56](https://github.com/gredice/arbi/issues/56); there is no second session authority.

The optional [native producer reference](live-producer.md) connects these grants to bounded encoded fixture payloads and measured per-viewer usage in isolated host integration. It adds no public media route and leaves physical transport selection gated.
