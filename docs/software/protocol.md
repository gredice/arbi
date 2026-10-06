# ARBI protocol 1.0

Work record: [#14](https://github.com/gredice/arbi/issues/14). The [package](../../packages/arbi-protocol/README.md), [canonical schema](../../packages/arbi-protocol/schema/message.schema.json), [fixtures](../../packages/arbi-protocol/fixtures/contracts.json) and [reference rules](../../packages/arbi-protocol/src/reference.ts) implement an initial testable software boundary. They do not implement a transport, authenticate devices or validate installed operation. [ADR-0004](../decisions/0004-simulator-boundary.md) requires hardware and simulation to share this boundary; architecture acceptance is owned by [#13](https://github.com/gredice/arbi/issues/13).

## Encoding, version and error boundary

Wire messages are UTF-8 JSON objects, at most 16,384 bytes. Every object rejects unknown properties. The receiver validates before persistence or interpretation, never coerces types or substitutes defaults. `parseMessage` bounds wire text; callers of `validateMessage` must enforce the byte limit before decoding. Non-finite numbers, invalid UTC dates, unsupported types, ranges and versions fail explicitly. No executable code, media bytes, credentials, signing keys, sensitive configuration or arbitrary metadata is permitted in a message.

The current exact compatible version is `arbi/1.0`. Snapshot advertisements list supported protocols and commands. Unknown major **or minor** versions return `UNSUPPORTED_VERSION`; receivers must not assume a newer additive schema is compatible. A future minor version can add a reviewed optional contract/operation, but strict 1.0 receivers still reject it until explicitly upgraded/negotiated. Changed meaning, units or required fields require a major revision. Package version and wire version have separate identities; a package patch may repair a validator without changing the wire contract. No binding is emitted for an unused runtime.

Structural validation uses JSON Schema 2020-12 plus these required semantic checks: uint64 bounds, UTC/uncertainty pairing, deadline/target epoch equality, sample age arithmetic, duplicate metrics and snapshot cursor binding. Other languages must port both layers. The generated TypeScript file describes structural types only. Generation is deterministic and checked in `build`/`lint`.

Validation returns `{ ok: false, error: { code, path } }`, with schema-owned stable codes; callers must branch on `code`, not library prose or diagnostic paths. Top-level dispatch errors take precedence over schema failures; the selected body is validated independently so errors from unrelated variants cannot change the result. Unknown fields return `UNKNOWN_FIELD`, range violations `INVALID_RANGE`, other shape violations `INVALID_MESSAGE`. Admission then checks realm/site/source/target/actor/capability before any replay, lifetime, configuration or lease decision. No rejected input changes the reference ledger or telemetry state.

| Error group | Representative codes | Required handling |
| --- | --- | --- |
| Syntax / compatibility | `INVALID_JSON`, `MESSAGE_TOO_LARGE`, `UNKNOWN_KIND`, `UNKNOWN_TYPE`, `UNKNOWN_FIELD`, `UNSUPPORTED_VERSION`, `INVALID_MESSAGE`, `INVALID_RANGE` | Reject; do not normalize into an executable request |
| Identity / authority | `REALM_MISMATCH`, `SITE_MISMATCH`, `SOURCE_MISMATCH`, `TARGET_MISMATCH`, `NOT_AUTHORIZED`, `UNSUPPORTED_CAPABILITY` | Reject and surface the distinct reason |
| Lifetime / configuration | `TARGET_RESTARTED`, `SESSION_MISMATCH`, `DEADLINE_EXPIRED`, `DEADLINE_TOO_FAR`, `CONFIG_MISMATCH` | Fresh authorization/configuration/clock handshake and a new intent are needed |
| Control / replay | `LEASE_REQUIRED`, `LEASE_STALE`, `LEASE_EXPIRED`, `FAULT_INHIBITED`, `IDEMPOTENCY_CONFLICT`, `SEQUENCE_REPLAY` | Never retry as motion automatically |
| Recovery / quality | `RESYNC_REQUIRED`, `CLOCK_INVALID`, `QUALITY_UNSUPPORTED`, `RESOURCE_LIMIT`, `INVALID_TRANSITION` | Stop interpreting the affected stream, recover or show uncertainty |
| Device outcome | `EXECUTION_FAILED`, `CANCELLED`, `INTERRUPTED` | Preserve the confirmed outcome; interruption does not imply successful physical completion |

## Identity and trusted routing

Every envelope contains `realm` (environment plus resource `namespaceId`), `executionMode` (`simulation` or `hardware`), `siteId`, `messageId`, `source` (device, boot, session), stream sequence and source/ingest times. IDs are opaque bounded ASCII identifiers. All committed fixtures use a synthetic site and coordinates; they contain no deployment identity or credential. Namespace identity persists across ordinary cloud worker replacement; each preview/test installation receives an isolated namespace. A UI simulation label alone grants no authority.

The trusted adapter supplies the expected realm/mode/site and authenticated source. It must derive them from enrollment and current authorization, never from the message or browser claims. Separate production enrollment roots/resources are still required. Reusing a production credential in a preview and checking a text label is insufficient isolation. An edge-module adapter accepts only locally enrolled edge sources; Pico/pod never accept direct browser/cloud authority. A cloud-edge adapter accepts only authorized committed intent retrieved from authoritative state. Broker notifications and replayed events cannot execute commands.

`bootId` changes every process/controller boot that resets its monotonic clock or loses its volatile authority. `sessionId` changes on authenticated command-channel reconnection or renewed local control association. Each command names its exact receiving device/boot/session. An old boot returns `TARGET_RESTARTED`; an old session returns `SESSION_MISMATCH`, including when a prior receipt exists. Neither sequence reset nor reconnect revives an old manual session. Per-device identities are not Gredice human identities; `actor` and correlation carry the original authorized principal across translation to local requests. The local executor must verify authority to cancel the named command and bind outcomes to its exact request source and command ID.

## Time and deadlines

`sourceTime.utc` is ISO UTC with millisecond precision, or `null` when unsynchronized. UTC `uncertaintyMs` must be nonnegative and known with UTC, and `null` when UTC is unknown. `sourceTime.monotonicMs` is milliseconds since the source boot. `ingestTime` is independently recorded by the trusted receiving service (UTC, uncertainty, ingester ID), or `null` before ingestion; ignore any client-supplied ingest assertion. Never overwrite source time with receive time.

A command deadline uses the **receiver's** current boot/session and `expiresMonotonicMs`, obtained from an authenticated fresh handshake. Subtract the receiver's monotonic clock only. Source UTC, ingest UTC and NTP jumps cannot extend command lifetime. Admission requires a strictly future deadline within the locally selected maximum horizon; the reference ceiling is 30,000 ms. Its requested maximum duration must fit entirely within the remaining deadline and current lease lifetime. Real adapters choose tighter horizons where their reviewed policy requires them and stop/cancel at deadline, lease loss or local fault even after admission. An expired command remains history; it never becomes work after reconnect. Negotiating a receiver clock after reconnect requires a new command/session, never rewriting an old deadline.

Times represented as numbers are integers <=2^53-1 for exact JavaScript/C/Python interchange. Monotonic counters must not wrap within a boot; begin a new boot identity before exhaustion. The schema's clock/range ceilings are encoding limits, not commissioned operating limits.

`transportAgeUpperBound` computes conservative transfer age as `ingestUTC - sourceUTC + sourceUncertainty + ingestUncertainty`. Unknown clocks give `null`; a source clock so far in the future that even the uncertainty interval cannot explain it returns `CLOCK_INVALID`. `ageSample` uses the reported source sample age, that trusted delay bound and elapsed **receiver** monotonic time since that metric's receipt. It marks unbounded delay or exceeded freshness as stale, never fresh because a packet just arrived. UTC estimates do not govern motion deadlines.

## Sequences, recovery and duplicates

Sequence and fencing values are canonical decimal **strings** in [0, 2^64-1]. They never pass through a JSON/JavaScript floating-point number. Leading zeros, negatives and overflow are rejected. Sequences are scoped to realm/site/device/boot/session/**kind stream**. A source increments each stream without wrapping. An authenticated snapshot establishes the active source epoch and cursor before receiving deltas; first reference admission uses a fresh negotiated source and local ledger.

A `Cursor` names source identity, event/telemetry stream and sequence. Old/repeated sequence is `SEQUENCE_REPLAY`. Event gaps require `RESYNC_REQUIRED` rather than inventing missing outcomes. Telemetry gaps may be coalesced and are returned as `gap: true`; older packets or per-metric sample times cannot replace newer state. A new boot/session is never auto-adopted because a packet arrived. Reauthorize, obtain a compatible snapshot, clear the old telemetry cache and create a fresh command association; delayed old-session traffic stays rejected.

`state.resync` and `state.snapshot` also carry a nullable `RecoveryCursor` with journal `logId`, `epoch` and opaque `token`. This is the service's **committed** durable recovery position, distinct from a device sequence. Clients do not parse or compare its token or manufacture it from a database sequence. Scope it to the authenticated realm/site/log, obtain snapshot and cursor consistently, then replay bounded committed pages while deduplicating concurrent notifications. A retention/epoch gap requires a new snapshot. The storage/transport adapter in #29 owns commit-safe consistency under concurrent writers; these types alone do not establish it. Local module snapshots may have no cloud cursor. Event snapshots bind their own event cursor to the source and envelope sequence; optional telemetry cursor names that same source epoch.

`commandId` identifies one operation; `correlationId` links a job/audit chain; `idempotencyKey` identifies one immutable intent within source epoch and target association. Retries may change envelope `messageId`, sequence, source/ingest observation times, but not intent, target, actor, deadline, configuration or body. The reference compares canonical semantic content, independent of JSON key order. A matching receipt yields `duplicate`: return the **persisted** prior outcome, including after expiry, without checking it as new work or dispatching it again. Changed content or reused operation identity yields `IDEMPOTENCY_CONFLICT`.

Persist accepted/rejected outcomes and dispatch intent atomically before device effects. Use command identity for lost-response reconciliation, not blind reexecution. The in-memory reference ledger is intentionally bounded and returns `RESOURCE_LIMIT` instead of unsafe eviction. Runtime persistence, rejection deduplication, crash reconciliation, retention and execution guarantees belong to the cloud/edge adapters; restart cannot reset a still-active command association and silently discard its receipts. New epochs prevent replay, and unresolved accepted/running work is explicitly interrupted/unknown until reconciled, never marked completed by assumption.

## Leases, operations and outcomes

A lease carries `id`, `holderId` and uint64 `fence`; trusted local state binds it to the receiver epoch and local monotonic expiry. The exact current fence and holder must match; greater-than-current is also stale. Allocation/renewal is atomic in the authoritative lease store; reconnect revokes old local motion authority. Local executors recheck fencing/liveness while running. Passing admission never bypasses hardware limits, driver alarms, interlocks, allowed workspace or commissioned safety capability.

`control.stop` and `state.resync` need current identity/authorization/deadline/capability but no control lease or matching motion configuration. Stop remains admissible during a fault. Other operations require the current lease and configuration. Cancellation and preview stop are permitted through fault inhibition under that association; the executor still applies target ownership and local policy. Independent local fault/stop paths must continue even if cloud authorization, ledger capacity, database, network or audit fails.

| Operation | Encoded bound / meaning | Local executor responsibility |
| --- | --- | --- |
| `motion.move` | Target x/y/z in mm, named site-frame revision, positive maximum speed and duration | Synchronized local trajectory and stricter approved workspace/speed/tension limits; no inferred measured position |
| `control.stop` | Named stop reason | Apply the reviewed local stopping policy; remote delivery/acknowledgement does not prove a physical stop |
| `camera.gimbal` | Pan/tilt degrees, gimbal-frame revision and duration | Calibrated limits, safe pose during Skycam motion, settle before capture |
| `camera.capture` | Opaque result resource ID and duration | Stop/settle/autofocus interlocks, actual capture outcome; upload is a separately tracked transfer |
| `camera.preview.start` / `.stop` | Viewer-session identity; start bounds duration, resolution, frame rate and bitrate | Explicit authorized viewing, local budget/audit/session expiry/revocation; no implicit stream on dashboard mount |
| `command.cancel` | Named operation ID | Cancel only the permitted current operation; acknowledge the observed result |
| `state.resync` | Optional stream and committed cursors | Bounded authenticated snapshot/replay, never act on recovered history |

Initial lifecycle is `requested` → `accepted` or `rejected`; accepted work becomes `running` → `completed`, `failed` or `cancelled`. Failure/cancellation may occur before running. The reference also permits `requested` → `failed` for explicit interrupted reconciliation. Duplicate identical outcomes are idempotent; regressions, direct requested→completed, and changes to a terminal outcome return `INVALID_TRANSITION`. Rejected/failed/cancelled events need an explicit error; success cannot carry an error. Intermediate events cannot claim a result resource. Completion is the named executor's observation, not proof of motion accuracy, upload success or public-operation safety. Unknown confirmation after a connection loss must stay unresolved until recovery; do not issue a synthetic completed event.

`fault.changed` carries fault identity, raised/cleared state, severity (`info`, `inhibit`, `stop`) and explicit error. A cleared notification alone does not authorize recovery or calibration changes; local accepted procedures remain mandatory. `state.snapshot` reports state/configuration identity and supported protocols/commands/metric qualities. Operating-state names match the existing [interface proposal](../system/interfaces-and-operating-states.md); a `Parked` report does not establish update safety.

## Units, frames and truthful telemetry

The site frame is right-handed: x/y/z axes and datum must come from the named site-frame/calibration revision under #16, never a hidden axis swap. Gimbal angles use the named pod-gimbal calibration and its documented axes/signs. An unavailable frame/calibration blocks affected commands. Scalar line length/tension and power use `none` frame; they are per-axis scalar values, not pod coordinates. Schema bounds prevent invalid encoding; they do not substitute for hardware-specific calibrated limits.

| Metrics | Unit | Frame / meaning |
| --- | --- | --- |
| `position.x/y/z` | `mm` | Named site frame; commanded/estimated/measured are distinct |
| `line.length.a/b/c/d` | `mm` | Per-line scalar, never measured pod position |
| `line.tension.a/b/c/d` | `N` | Per-line force; unavailable without actual measurement capability |
| `power.voltage` | `V` | Supply voltage at the named source module |
| `gimbal.pan/tilt` | `deg` | Named pod-gimbal frame |

Each sample carries metric, unit, frame, quality, value, source sample monotonic time, source `ageMs`, optional measurement/estimate uncertainty in the same unit and reason. A message cannot repeat a metric. Sample age equals envelope source monotonic time minus sample monotonic time and cannot be negative. Preserve reported age rather than resetting it to zero at ingestion; retain the receipt time separately per metric for display aging.

- `measured`: actual installed measurement whose capability permits that label.
- `commanded`: requested/output state, no implied physical achievement.
- `estimated`: model-derived state, no implied sensor observation.
- `stale`: retained value with `originQuality` and `expired` reason; it never becomes fresh again without a new valid sample.
- `unavailable`: `value`, sample time, age, uncertainty and origin quality are all `null`, with a concrete missing/fault/not-reported reason. Zero is a numeric reading only when supported, never a missing-data substitute.

Capability revision changes require a fresh snapshot. Unknown or unadvertised measured/commanded/estimated quality is `QUALITY_UNSUPPORTED`; stale samples are checked against their origin quality. Metrics absent from a message are not zero or new observations. Present them as unavailable before first observation, or age a previously received sample until stale. No current wiring delivers motor encoders to the Pico, and no installed tension/position measurements have accepted evidence. Synthetic fixtures therefore advertise commanded/estimated position and unavailable tension. Commissioned capability and frame/assembly/configuration definitions remain #16's ownership.

## Extension points and evidence limits

The envelope's actor, environment/mode/site/source identity, command/correlation/resource/view-session IDs, sequence and independent timestamps provide join keys for #19's audit model. They do not implement a durable audit store or claim a viewer's attention. #18 owns category/layer/direction/coverage counters, retries, overhead, GB/GiB and billing-period policy; application payload length cannot be reported as WAN or carrier usage. Preview bitrate/duration are bounds, not metered usage or quota reservation.

Updates need separately reviewed manifests/capability/configuration and locally authorized transactions (#24/#73). There is deliberately no update or recording command in 1.0; adding one requires a schema version plus fixtures and its accepted prerequisite. Recording stays deferred/disabled; `recording.start` is an `UNKNOWN_TYPE` fixture. Firmware availability, staged/installed versions and signed verification must not be inferred from web deployment. Docked/Parked alone never grants update permission while power-loss line restraint remains unresolved (#15).

Source tests cover malformed/old-version/range input, duplicate/late commands, fences, source/target reboot/session changes, clock skew, outcome transitions, missing sensors and reordered telemetry. Node consumes generated TypeScript types; every representative payload also round-trips through host Python JSON and a host C11 lexical harness, preserving uint64 strings. These harnesses are not MCU/pod validators, timing/bench tests, a physics simulation or provider interoperability. #20 and runtime owners must extend the same fixtures to their selected target toolchains/decoders and prove semantic rejection there. No physical or deployment validation is claimed by #14.
