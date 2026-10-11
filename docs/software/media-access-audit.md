# Media access audit and delivery visibility

Work record: [#56](https://github.com/gredice/arbi/issues/56), [ADR-0015](../decisions/0015-media-audit-visibility.md). This extends [live sessions](live-sessions.md) and existing protected [media storage](image-storage.md).

## Live reports

The existing `live/device` proof accepts `kind: delivery` with `summary` containing `viewerUsageId`, nullable `upstreamUsageId`/`relayUsageId`, and source `startMonotonicMs`/`endMonotonicMs`. Reports retain the original viewer actor/session/intent, current producer generation, current target/configuration, signed source clock and immutable event ID. Exact retries acknowledge one recorded report, including a lost acknowledgement. Browser credentials and advisory reports cannot use this device path.

The summary must reference existing uncorrected accounting windows. The viewer window is `cloud-viewer`/download/`live-video`, with that viewer ID and producer session ID. Shared upstream is `garden-sim`/upload/`live-video`; shared relay is `cloud-relay`/download/`turn`. Both shared windows have a null viewer ID and the same producer session ID. All use application-payload accounting, the current source identity, shared topology and explicit bytes. These references retain the counter's evidence quality/coverage; they never establish interface-WAN or carrier billing truth.

Delivery observations require measured payload counters. Estimated/unavailable counters cannot become a bytes-delivered event. Zero-byte windows remain valid accounting facts but do not establish packet delivery. A shared window may start before a later viewer joined, within that producer's first matching grant; the viewer's own downstream interval must remain within that viewer's authority. Later accounting corrections retain the immutable original audit/report fact and are interpreted through the accounting reader.

Intervals span 1–15 seconds within viewer authority and agree with a known source UTC clock (at most 1 second uncertainty). Per-viewer summaries arrive at most once per 5 seconds, at most 32 per logical session, and cannot reuse another viewer's window, overlap the previous source interval, exceed the profile rate, or silently convert unavailable bytes to zero. Reports share the existing 4096-per-site immutable ledger cap. A corrected, absent, forged, wrong-scope, old-generation or unauthorized reference is rejected.

Two viewer summaries may point to the same upstream/relay ID. Their downstream histories remain separate, while garden/relay totals come from those unique usage windows exactly once. Audit `byteCount` describes only that viewer's downstream payload interval. Shared references live in the immutable report with the same ID as the audit event; the usage reader remains the sole traffic rollup authority. No audit byte count should be summed with WAN/provider totals.

The session view exposes the latest delivery reference and a closure record. The closure's authority-duration upper bound is not an observed playback duration; `playbackDurationMs` stays null and `remoteStopObserved` stays false. Timeout may be reconciled on the next trusted synchronization/read; the independent producer lease expires regardless. An explicit browser end stops authority, while tab close/crash/mobile loss falls back to lease expiry. Missing intervals remain unknown, including the tail before an unobserved end.

## Still URLs and caches

The existing site/media boundary authorizes each viewer independently. Access prepares one stored grant and audited intent/access-grant before asking the object adapter to sign a GET URL. Required audit failure rolls back that preparation and prevents GET signing. Signing failure retains the original grant/intent, sets issuance failed/revoked, records the related service failure and returns no URL. Successful preparation records signing-response readiness separately from delivery; the current directory/resource/session is rechecked before exposing the response.

If the resource changes after signing, the response is withheld and the prepared grant is revoked with a linked failure. A lost final SQL commit acknowledgement retains any already-issued state and revokes it rather than rewriting that fact as unissued. The server's private object-integrity reads remain separate from signing a viewer capability.

The URL lasts at most 30 seconds and never beyond the original human session. Direct object storage cannot recheck membership per GET or recall an individual bearer URL. A previously issued URL may be replayed/shared until expiry; already downloaded browser/cache bytes may remain afterward. Revocation denies new authority and documents this residual deadline. Cache hits, GET replay, downstream packet delivery and actual playback have no trusted observer in this adapter. Object length is storage metadata; transfer/WAN/provider/retry bytes remain null. Access audit contains no URL, provider token or signing key.

There are at most 4096 retained still grants per site. The SQL guards preserve original authority and monotonic revocation, block deletion/truncation, and work with unchanged legacy grants. Full ledgers require a separately reviewed privileged retention policy rather than automatic public deletion.

## Direct, relay and recording gates

The isolated live adapter transports signaling only. A selected physical direct path needs a trusted endpoint meter for downstream delivery and the garden boundary for WAN truth. TURN/relay paths need trusted provider/service observations; relay ingress/fanout, upstream SIM and per-viewer delivery remain distinct. Loss of one observer is a gap, not zero traffic or evidence that a stream stopped. Provider credential selection/rotation and real first-frame/NAT/resource checks remain [#43](https://github.com/gredice/arbi/issues/43)/[#60](https://github.com/gredice/arbi/issues/60).

`recordingAuditHook` offers reserved start/stop/failure/playback/export/delete mappings and disabled authorization descriptors. It creates no session, grant, encoder or storage mutation. Contract fixtures verify current Gredice denial and reject recording success/access-grant events under audit 1.0. Activation requires a new reviewed contract and the [recording policy](recording-policy.md) gates.
