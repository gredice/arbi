# Mobile data accounting 1.0

Work record: [#18](https://github.com/gredice/arbi/issues/18), under [mobile-data epic #11](https://github.com/gredice/arbi/issues/11). This implements a **source-level accounting contract and pure reference calculations** in [@arbi/protocol](../../packages/arbi-protocol/README.md). No router, carrier, tariff, deployed collector or physical installation has been validated. The authority and safety boundaries in [ADR-0005](../decisions/0005-software-architecture-and-deployment.md) and [ADR-0006](../decisions/0006-local-safety-authority-and-instrumentation.md) apply.

## Contract and compatibility

The canonical [JSON Schema 2020-12](../../packages/arbi-protocol/schema/accounting.schema.json) declares independent version `arbi-accounting/1.0`. It reuses protocol 1.0 identity, realm, opaque ID and decimal-string counter definitions. [Generated TypeScript bindings](../../packages/arbi-protocol/src/accounting-types.ts), [runtime validation and reference functions](../../packages/arbi-protocol/src/accounting.ts), [executable tests](../../packages/arbi-protocol/src/accounting.test.ts) and [synthetic worked fixtures](../../packages/arbi-protocol/fixtures/accounting.json) accompany it.

Protocol `arbi/1.0` command, event and telemetry schemas, error codes and fixtures are unchanged. Accounting records are separately validated objects; passing one to `validateMessage` is unsupported. Consumers opt into `parseAccounting` for bounded JSON (32 KiB) or `validateAccounting` for decoded external input. Unknown versions, kinds, fields, invalid dates/ranges, unsupported scope and unavailable numeric placeholders fail with stable accounting error codes. TypeScript types alone do not enforce refinements. Non-TypeScript consumers must resolve the message-schema references and apply this document's semantic rules as well as JSON Schema. Existing protocol host conformance checks still run; there is no firmware accounting implementation here.

## Physical and network boundaries

Each observation identifies realm/environment, explicit live or simulation origin, site, collector device/boot/session, opaque link ID, counter epoch, a half-open UTC interval `[start,end)`, direction, layer and scope. `source` identifies the collector, including a collector of carrier reports; attributed `deviceId` identifies the device responsible for traffic, or `null` when unknown. Null attribution is not a fabricated device. IDs in fixtures are synthetic and carry no site coordinates or deployment configuration.

| Boundary | Upload / download perspective | Accounting purpose |
| --- | --- | --- |
| `lan` | From / to the local originating device on the named link | Pod-to-edge Wi-Fi, local Pico/pod control and local-only viewing; no mobile-plan debit |
| `garden-sim` | From / to the garden across the named SIM/mobile uplink | Mobile allowance; count every actual transfer crossing that uplink |
| `cloud-relay` | From / to the relay service on its named ingress/egress link | Relay ingress/egress observations and provider cost evidence; separate from the garden allowance |
| `cloud-viewer` | From / to the cloud media/object service toward viewers | Viewer deliveries and fanout; separate from the garden allowance |

Upload/download always refers to this table, not the observer's operating-system receive/send names. Adapters must map interface direction to the declared boundary. For example, a relay receives a garden upload as a `cloud-relay` download. Physical interface counters can also observe LAN traffic: layer `interface-wan` means interface observation, while `boundary` decides whether that observation is WAN. Router interfaces, bridges, VPN tunnels and encapsulation may observe the same bytes at multiple points. Assign one canonical link/collection point per accounting domain; do not add its duplicate interface views. Provider observations are allowed only on `garden-sim`.

The edge/gateway is the authority for an observed garden-WAN counter once a collector's physical coverage is established. A pod payload counter cannot observe other devices, router management, DNS, transport overhead or carrier charging. Cloud receipt can corroborate a transfer but does not replace garden-WAN observations.

## Layers, authority and coverage

| Layer | What a measured value means | Limits |
| --- | --- | --- |
| `application-payload` | Bytes submitted/received by the instrumented application at its declared boundary | May count unique content or every attempt, according to `includes`; excludes unobserved network overhead and other applications |
| `interface-wan` | Counter delta at the identified interface/collection point | Must establish coverage of the actual SIM/link, retransmissions, encapsulation and other devices; not carrier billing truth |
| `provider` | Usage reported by the configured carrier/provider | May lag, round, omit detail or use different charging rules; no provider capability or invoice parity is assumed |

These are overlapping observations of traffic, not additive categories. Select **one layer, one link and one direction** for a total. Present other layers as comparisons with their own windows and authority. Never calculate payload + interface + provider, total + classified parts, LAN + WAN, or garden + relay + viewers as mobile consumption. A carrier report may be the source for carrier-reported allowance use only when its cycle/direction/charging coverage is known. It is not automatically a fresh per-device breakdown.

`evidence.quality` is `measured`, `estimated` or `unavailable`. An estimate stays estimated after reconciliation. `executionMode: simulation` independently labels synthetic origin even when the simulated counter is measured within its model. These counters never express commanded traffic or grant actuator authority.

`coverage` is `complete`, `partial` or `unknown` **for the selected window and scope**, not for all possible layers. `includes` lists only components known to be included: payload, retries, transport overhead and non-ARBI traffic. An empty list means component inclusion is unreported and requires unknown coverage. A known numeric zero with partial coverage is still partial; it cannot establish zero cycle usage. Missing router/carrier support uses `bytes: null`, unavailable quality, unknown coverage, null observation time and an explicit reason such as `unsupported-counter` or `not-configured`. There is no automatic fallback to zero or an application estimate presented as WAN measurement.

`observedAt` is the timestamp when the delta became available, at or after the interval end. `maxAgeMs` is explicit caller policy. `usageFreshness` computes fresh/stale/unavailable at a supplied UTC time; exact expiry is fresh, one millisecond beyond is stale. A clock reversal/future observation is an error. Freshness describes reporting delay; it does not imply that the observation covers time since its interval ended. Consumers must separately expose period gaps and source-clock uncertainty. A last known counter remains historical evidence; stale values do not establish current remaining allowance.

`bytes` is an unsigned 64-bit integer encoded as a canonical decimal string. It is a **delta**, not a raw cumulative register or successful object size. A collector must detect counter wrap, reset, boot changes and collection gaps before producing a delta. Change `counterEpoch` on a reset; never subtract across epochs, infer an unobserved delta or interpolate a billing-boundary split as measured. A gap is partial/unknown, with reason. Idempotent observation ingestion and durable raw-counter handling belong to follow-up issues.

## Exclusive categories and reconciliation

| Category | Included transfers |
| --- | --- |
| `control`, `heartbeat`, `reconnect` | Intent/state recovery, liveness, reconnect and resubscription operations |
| `auth`, `dns`, `tls` | Identity/enrollment/token refresh, name lookup, handshake and TLS-specific bytes when separably observable |
| `telemetry`, `logs-audit` | Diagnostic/state samples, logs and audit uploads including offline spool flush |
| `thumbnail`, `still` | Preview assets and captured still uploads/downloads |
| `live-video`, `turn` | Actual live media and separately observed TURN control/encapsulation bytes |
| `recording` | Reserved; unavailable with reason `disabled`; no positive recording observation or enablement in 1.0 |
| `ota`, `os-update` | Firmware/application artifacts, OS packages/images, manifests and related download traffic |
| `retry`, `transport-overhead` | Separably observed repeat attempts and remaining framing/acknowledgement/encapsulation overhead |
| `unknown` | Measured or estimated traffic that cannot be assigned to a known category/device |

Classification is an **exclusive partition at the same layer/collection point**, not a set of overlapping tags. For example, a still retry is either counted in `still` with retries included, or moved into `retry`; never both. TLS/TURN bytes separated into their named category leave `transport-overhead`. TURN carries video payload: classify payload in `live-video` and separately observed TURN overhead in `turn`, or retain inseparable wire bytes in one category. Do not invent a measured split. When exact attribution is unavailable, retain a total and its residual; estimates require estimated quality. `includes` indicates component scope, not that each category contains every component.

`boundary-total` rows have null category/device/media. `attributed` rows have a category and a non-null `attributionRevision` naming the exclusive classifier/partition. A null attributed device denotes the unassigned slice, never an all-devices category subtotal overlapping known devices. Before reconciliation, coalesce each device/category into one row for the exact window and selected collector. Per-session/viewer raw records are future ingestion inputs; do not sum overlapping snapshots or different classification revisions. A coalesced multi-session row has null `media`; individual session observations may retain media metadata.

`reconcileUsage(total, parts, nowUtc)` is a bounded reference calculation for one window, not a period-rollup service. It validates every row, accepts at most 128 attribution rows, and requires equal realm, origin mode, site, boundary, link, direction, layer, source identity, counter epoch, classifier revision and interval. Known parts must also declare equal component inclusion. Unavailable parts have no component claim and contribute no invented number. Duplicate observation IDs or device/category partitions are rejected. Cross-layer reconciliation returns `LAYER_MISMATCH`; cross-boundary/epoch/window/source comparisons return `SCOPE_MISMATCH`.

The result reports the selected total, classified bytes, explicitly `unknown` bytes, remaining unattributed bytes, quality, layer, freshness and status. Residual = total − known parts is **unattributed**, not silently inferred TLS or non-ARBI usage. Empty parts leave the whole known total unattributed. A full zero counter with complete coverage can establish zero for that window. A partial/unknown window remains partial even when its parts exactly match. Classification exceeding the total is `inconsistent`, with null residual; do not clamp the conflict to zero. Missing/stale totals have null residual; any stale part makes reconciliation stale. These states must remain visible to future consumers. No result is a carrier invoice.

## Media, captures and downloads

`media` optionally carries direct/relayed/shared topology, session ID, viewer ID and viewer count. Viewer count is metadata and is **never a multiplier** of byte observations. Upstream garden/LAN/relay observations have null viewer ID; per-viewer cloud observations use `cloud-viewer`. Direct or relayed single-viewer rows declare viewer count 1. Multiple independent upstream streams consume their actual summed transfers; a shared upstream consumes only the actual one upstream transfer. A relay does not imply sharing; #43 must establish the implemented topology and actual traffic.

The worked fixtures intentionally separate media, overhead and retries using an exclusive synthetic classifier:

| Fixture | Garden SIM bytes | Other boundary evidence |
| --- | --- | --- |
| Direct live video | 10,000,000 media + 1,000,000 overhead = 11,000,000 upload | Viewer-facing traffic requires separate observations |
| Relayed single viewer | 10,000,000 media + 200,000 TURN + 1,000,000 overhead = 11,200,000 upload | Relay traffic is separately scoped |
| Shared five viewers | Same 11,200,000 upstream upload | 10,000,000 cloud relay ingress and 50,000,000 cloud-to-viewer egress; neither enters garden total |
| Capture and retry | 6,000,000 still + 200,000 thumbnail + 2,000,000 retry + 300,000 overhead = 8,500,000 upload | Pod-to-edge still copies are LAN observations |
| OTA and OS download | 100,000,000 OTA + 50,000,000 OS + 10,000,000 retry + 2,000,000 overhead = 162,000,000 download | Artifact publication is not device installation |
| LAN-only still | Independently observed complete SIM counter = 0 | 6,000,000 LAN bytes; never infer SIM zero merely from a LAN payload |
| Unknown and residual | 1,000 observed = 600 telemetry + 100 explicitly unknown + 300 unattributed | Partial attribution stays visible |

Failed/aborted uploads, repeated downloads and reconnect/auth/signaling traffic consume allowance when they cross the SIM, regardless of successful capture or installation. Object size and nominal video bitrate alone are application estimates. Cached local artifact distribution may be LAN-only; initial artifact downloads cross WAN. Future recordings remain deferred and disabled under [#68](https://github.com/gredice/arbi/issues/68). Counters provide no evidence that a person watched media; audit semantics are independently owned by #19.

## Mobile plan and cycle policy

`MobilePlan` binds a user-supplied plan ID to realm, site and SIM link. Required settings are allowance, monthly cycle, charged directions (`upload`, `download`, `both`), reset and rollover. There is no default allowance, provider, price, router or charging direction. This reference supports monthly cycles only; other carrier periods require an explicitly versioned extension. Plan settings are assumptions until matched to provider evidence.

`DataQuantity` uses a decimal string and explicit unit: **GB = 1,000,000,000 bytes; GiB = 1,073,741,824 bytes**. `quantityToBytes` uses integer arithmetic, rejects overflow and fractional bytes and never uses floating-point rounding. For example 1.5 GiB = 1,610,612,736 bytes. Configured quantities allow up to six decimal places; not every fractional GiB value represents an integer byte. Observations always use bytes.

`BillingCycle` specifies IANA timezone (or UTC), local anchor day/hour/minute, `clamp-last-day` for short months, explicit DST fold choice (`earlier`, `later`, `reject`) and `dstGap: reject`. `billingPeriod` returns half-open UTC boundaries, so an observation exactly at reset belongs to the new cycle. A day-31 anchor clamps to February 28/29 and returns to March 31. Civil UTC offsets follow the configured timezone's rules, not the host timezone. Nonexistent local anchor times and rejected ambiguous anchors return `INVALID_TIME`; choose a valid anchor or explicit fold policy rather than shifting silently. ICU/IANA timezone database versions are runtime dependencies; future deployments should record them with period calculations and review timezone-rule updates. Fixtures cover Europe/Zagreb DST, UTC leap/short months, UTC+14 year transitions and New York gap/fold boundaries.

`reset: each-cycle` resets plan usage at the cycle start; it does not reset physical counters, delete historical observations or undo spending. Direction policy applies only to garden-SIM observations: `directionIsCharged` checks it without claiming billing truth. Charge upload/download independently before combining disjoint directions; never subtract uploads from downloads. Observations spanning cycle boundaries require actual subinterval evidence or an explicitly estimated allocation in #35, not an arbitrary measured split.

`rollover.policy: none` requires null cap. `capped-one-cycle` requires an explicit cap: only the previous cycle's unused **base** allowance may carry once, capped by that setting; older carry expires. `cycleAllowance` accepts caller-supplied prior unused base bytes, rejects values above base allowance and returns null if eligible carry is unknown. It does not infer carry from incomplete counters, compute history, persist resets or enforce budgets. A zero confirmed carry and an unknown carry are different inputs. Each boundary must receive a fresh reviewed carry value; passing the same carry again is not automatic rollover.

Optional `tariff` is null or a **user-supplied assumption** with currency code, overage unit GB/GiB, exact decimal price per unit, proportional/ceiling-unit rule and observed date. No carrier price is embedded. This contract describes a simple overage assumption only: taxes, minimum charges, bundles, roaming, exceptions, discounts and provider rounding may differ. No invoice or currency conversion calculation is implemented; unconfigured tariff means cost unavailable, not free traffic.

## Evidence and follow-up boundaries

Run from the repository root with Node >=24 and pinned pnpm:

```sh
pnpm --filter @arbi/protocol generate
pnpm --filter @arbi/protocol lint
pnpm --filter @arbi/protocol typecheck
pnpm --filter @arbi/protocol test
pnpm --filter @arbi/protocol build
pnpm docs:check
git diff --check
```

Tests validate all worked JSON fixtures and adversarial fields, exact counters, unavailable zero, partial/unknown coverage, stale/reversed clocks, mixed layers/boundaries/epochs/realms, duplicate partitions, disabled recording, media fanout, cycles, units, rollover and directional charging. This is deterministic host/source evidence only. CI, deployed integration, router/carrier reconciliation and physical safety acceptance remain separate facts.

Real counter collection and durable reset/gap handling belong to [#26](https://github.com/gredice/arbi/issues/26); idempotent ingestion/period rollups to [#35](https://github.com/gredice/arbi/issues/35); local budgets to [#45](https://github.com/gredice/arbi/issues/45); reports/settings to [#55](https://github.com/gredice/arbi/issues/55); cellular validation to [#63](https://github.com/gredice/arbi/issues/63). Local stopping never waits for metering, budget, cloud or audit upload. Nothing here enables a real device, recording, motion or update installation, and no physical/installed-system gate is cleared.
