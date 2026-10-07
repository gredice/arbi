# Audit events and evidence semantics

Work record: [#19](https://github.com/gredice/arbi/issues/19), under the [audit epic #12](https://github.com/gredice/arbi/issues/12). The [canonical audit schema](../../packages/arbi-protocol/schema/audit-event.schema.json), [runtime and join/projection helpers](../../packages/arbi-protocol/src/audit.ts), [generated types](../../packages/arbi-protocol/src/audit-types.ts), [synthetic fixtures](../../packages/arbi-protocol/fixtures/audit-events.json) and [host contract tests](../../packages/arbi-protocol/src/audit.test.ts) implement the vocabulary and boundary rules. [ADR-0005](../decisions/0005-software-architecture-and-deployment.md) and [ADR-0006](../decisions/0006-local-safety-authority-and-instrumentation.md) retain deployment, authority and physical evidence ownership.

## Version and validation

The exact audit version is `arbi.audit/1.0`. It is a separate record schema, not a new `arbi/1.0` command/event body. Existing message schemas, wire version and message fixtures remain compatible and unchanged. No update, home, calibration, schedule or recording actuator command is added. Vocabulary for a future operation grants no capability, access or installation permission.

Consumers use `@arbi/protocol` with `workspace:*`; schema-only consumers use `@arbi/protocol/audit-schema` and resolve its references to the unchanged `@arbi/protocol/schema`. This deliberately reuses protocol `Actor`, `Realm`, `Identity`, `Id`, `Counter`, `SourceTime` and `IngestTime`; it creates no parallel identity or clock definitions.

Use `parseAuditEvent` on UTF-8 JSON text before persistence: maximum 8,192 bytes, no coercion, defaults or removal of extra fields. `validateAuditEvent` validates already decoded input; its caller must bound bytes before decoding. JSON Schema 2020-12 enforces closed objects, enumerations, phase/outcome/effect combinations, action/resource kinds and source-module restrictions. Required runtime refinements are uint64 range, UTC/uncertainty pairing, intent/cause identity, exact device source/target binding, per-action module eligibility, observation interval arithmetic, restricted change context and disabled recording-resource access. Types and schema structure alone are insufficient.

Errors reuse protocol `Result` and stable codes: `INVALID_JSON`, `MESSAGE_TOO_LARGE`, `UNSUPPORTED_VERSION`, `UNKNOWN_FIELD`, `INVALID_MESSAGE`, `INVALID_RANGE`, `CLOCK_INVALID`, `REALM_MISMATCH`, `SITE_MISMATCH`, `SOURCE_MISMATCH`, `TARGET_MISMATCH`, `NOT_AUTHORIZED`, `INVALID_TRANSITION` and `UNSUPPORTED_CAPABILITY`. Errors contain only code and field path; never echo rejected values. Unknown versions fail closed, including an unknown minor version. A future change needs its own reviewed version, migration and conformance fixtures; strict 1.0 consumers cannot silently accept it.

## Identity, time and causal context

| Field | Meaning and required trust |
| --- | --- |
| `eventId` | Opaque immutable audit record ID. Retry the same immutable event under the same ID; append/ingest owns deduplication. |
| `realm`, `executionMode`, `siteId` | Environment, resource namespace, simulation/hardware origin and synthetic or protected site identity. Bind to enrolled inventory and authorization, never UI mode or browser claims. |
| `actor` | Original human, service or device initiator, with bounded opaque ID. It is distinct from the emitter. Scheduled service and local device actions need their own attributable principal; they must not impersonate a human. A failed unauthenticated login can use an opaque attempt principal without claiming verified human identity. |
| `source` | Observing module (`cloud`, `edge`, `motion`, `pod`, `browser`, `media`) and its device/process, boot and local link session. Authenticate this emitter independently of the original actor. |
| `sequence` | Decimal-string uint64 in the emitter's audit stream, scoped by realm/site/module/device/boot/session. It is neither a database commit cursor nor a global clock. Gaps are evidence gaps; reconnect or a new boot cannot turn missing records into success. |
| `sourceTime` | Source UTC and uncertainty (both null if unsynchronized) plus milliseconds since that source boot. Preserve reported time. Compare monotonic times only within one boot. |
| `ingestTime` | Null before receipt; independently stamped UTC, uncertainty and receiver ID after admission. A delayed spool upload never rewrites source time. Source and receipt clocks cannot establish exact global ordering outside their uncertainty. |
| `resource` | Enumerated resource kind, opaque subject ID and nullable reporting device ID. In a device outcome, `deviceId` names the confirming module; a logical capture ID can have separate edge and pod reports. A `device` resource has identical ID and device ID. |
| `links` | Correlation ID, root intent ID, immediate cause ID, nullable job/view-or-control-session/command IDs, exact command request source and target identities. Null means no known binding, never an invented ID. |
| `record` | Only a bounded protocol-event or local-record reference for a device report, never the original payload. Resolve it against the authenticated record before claiming confirmation. |

A root `intent` is self-bound by `links.intentEventId === eventId`, has no immediate cause, and reports `requested`. Other records cannot name themselves as intent or cause. Non-intent operations require a root intent link, except standalone login/authorization checks and service release publication. Local autonomous work should create its own service/device intent context and preserve it through module reports. Direct local stopping must continue even if an intent or audit record cannot be persisted; its gap is explicit and is never a condition of stopping.

`admitAuditEvent` requires trusted realm/mode/site/source, actor, action/evidence/record reference, complete command/correlation links, resource and already redacted metadata/change context. It rejects sender-supplied receipts and stamps the receiver's validated receipt without changing source time or mutating input. The adapter derives bindings from verified authorization, enrollment, known command records and approved revision/resource IDs; copying them from the untrusted event defeats the boundary. Authentication and correctness of the source observation still belong to runtime adapters.

## Evidence and outcomes

| Evidence | Outcomes | Claim supported |
| --- | --- | --- |
| `intent` | `requested` | An attributable request was recorded. No permission or physical result. |
| `authorization` | `allow`, `deny`, `fail` | Server/local policy decision. Allow uses `authorized`; fail uses `storage-failed`; denial preserves a closed policy reason. No delivery or device effect. |
| `access-grant` | `allow`, `deny`, `fail` | A bounded media/resource access decision. Grant ID is a reference, never a token. No stream establishment or human viewing. |
| `device-outcome` | `succeeded`, `fail`, `interrupted` | An authenticated module reported completion, failure or interruption, with exact target/source epoch, command and record identity. `effect: device-reported` identifies provenance, not a sensor measurement or physical safety proof. |
| `service-outcome` | `succeeded`, `fail` | A cloud/edge service result, such as release publication or session revocation. It cannot succeed on a local-effect action and stand in for device completion. |
| `media-observation` | `observed`, `fail`, `interrupted` | Pod/edge/media transport establishment, delivered bytes or connection end, with the actual observing source. |
| `access-observation` | `observed`, `fail`, `interrupted` | Still/history/download/export delivery activity seen by cloud/edge/media. |
| `browser-observation` | `observed` | Untrusted browser live-session heartbeat only. No access grant, delivery claim or device outcome. |
| `connection-loss` | `unknown`, `interrupted` | Cloud/edge lost contact or response, timed out or observed a restart for a named command/target. `effect: unknown` is mandatory. |

`effect: none` means this evidence asserts no device effect, not that no effect occurred. `unknown` means an effect remains unresolved. A device-confirmed failure or cancellation can follow partial work; neither means rollback, zero motion, isolation or safe restraint. A receipt/accept/running acknowledgement is never a terminal device result.

Lost response, expired access, browser loss and target restart cannot manufacture a successful stop, home, movement, capture or update. Preserve the unknown/interrupted observation. A later authenticated module report is a new event correlated to that command; it supplements the earlier uncertainty without deleting or rewriting it. Recording success solely because a connection was closed is invalid.

## Action vocabulary

| Domain | Actions | Resource / evidence boundary |
| --- | --- | --- |
| Identity and permissions | `identity.login`, `authorization.check` | Site-scoped attempts, allow/deny/fail; no credentials or raw login identifiers. |
| Manual authority | `control.session.start/end/revoke/timeout` | Control-session identity; a service result is lease/session management, never movement. |
| Manipulation | `motion.move`, `gimbal.move`, `control.stop`, `motion.home` | Device identity. Motion/Pico and gimbal/pod report their own results; edge can report its own local orchestration result. No home/stop availability is inferred from vocabulary. |
| Calibration/configuration/scheduling | `calibration.change`, `configuration.change`, `schedule.create/update/delete` | Versioned subject identity and tightly redacted change context; authorization differs from local activation. |
| Imaging | `capture.request` | Capture identity links independent edge orchestration, motion, gimbal and capture reports. Camera success does not imply upload success. |
| Releases and OTA | `release.publish`, `update.request/install/rollback` | Release/update identity. Publication is a service result; device installation/rollback requires a local target record and independent accepted preflight. |
| Live viewing | `live.grant/start/end/revoke/timeout/heartbeat` | Explicit viewer session. Grant, media establishment/delivery, service revocation and browser observation remain distinct records. |
| Still/history and delivery | `still.view`, `history.view`, `media.download/export` | Enumerated private resource, bounded access/delivery observations; audit export is itself an access action. |
| Future playback | `playback.view/heartbeat` | Recording resource; denied as disabled in 1.0. |
| Future recording | `recording.start/stop/fail/delete` | Vocabulary only. Every such action in 1.0 must be an authorization denial with reason `disabled` and no device effect. |

Recording, recording-resource downloads/exports and playback remain deferred/disabled under [#68](https://github.com/gredice/arbi/issues/68). There are no successful recording or playback fixtures and no runtime enable flag. `recording.fail` names future failure instrumentation; in this version it can only record rejection of that unsupported reporting/action path. Supporting real recording requires a reviewed later audit version and the separate privacy/retention/session gates. Audit vocabulary never enables a feature in the protocol or UI.

## Trace example and module confirmation

The fixture root `capture-intent` is a human request with `capture-chain` correlation and `job-1`. Its `edge`, `motion`, `pod` and `capture` records preserve that human and intent while naming separate command IDs, request sources and edge/Pico/pod boot/session targets. The host test joins all four reports and rejects changes to actor, correlation, job, session, site, environment, subject, command, request source or reporting target. Each report stands alone; seeing one does not prove all modules completed.

`correlateAuditEvent` checks a known root intent against a child. Capture intent may include motion, gimbal and capture actions. Live grant/start intents can join later live session events; control-session start and update request can join their respective lifecycle events. Unrelated actions fail. Same-action and lifecycle reports retain the logical subject kind/ID, while each reporting device is bound separately. It does not decide whether all expected modules reported, reconcile a database or prove a complete workflow.

`auditFromProtocolOutcome` validates an existing protocol 1.0 `command.outcome` and trusted command/target binding. It projects completed/failed/cancelled terminal records, refuses requested/accepted/running acknowledgements, checks resource identity when supplied, and retains a protocol record reference. It derives the original actor from the validated intent. Interrupted failure remains interrupted. It needs the adapter's authenticated command/source context; JSON/schema alone cannot authenticate a module. Future configuration/update adapters can use `local-record` references once their executable operations exist.

## Viewing limits and privacy

A view authorization means permission was decided. Session establishment means a transport was established. A positive `byteCount` attached to `bytes-delivered` means that source observed bytes, not that a person saw, understood or paid attention to frames. It is an audit observation, not WAN/carrier accounting; [#18](https://github.com/gredice/arbi/issues/18) owns the separate accounting contract.

`observedInterval` is a bounded interval on the observing source's monotonic clock: start <= end <= source report time. It can describe transport activity or browser heartbeat reporting. Do not turn its length into exact watched duration. Background tabs, buffering, disconnected browsers, relays and heartbeat losses make such an inference unsupported. Heartbeat events are explicitly browser observations, never trusted access/delivery evidence. No human-attention or watched-duration field exists.

Every nested object rejects unknown keys. Metadata permits only an enumerated permission/observation, delivered byte count, observation interval and opaque grant/configuration/calibration/schedule/release references. Change context permits an enumerated list of changed categories and before/after revision/status summaries. It contains no raw configuration values, coordinates, camera frames, media chunks, usernames, emails, IP addresses, URLs, headers, bearer tokens, passwords, private keys, signed URLs or free-text reasons. There is no arbitrary bag, free-text detail, config payload or raw protocol payload escape hatch.

Invalid fixtures reject sensitive keys in the envelope and nested actor/source/links/metadata/before/after objects, arbitrary config/coordinates, credential-bearing URLs and key/media encodings in revision fields. Opaque-ID syntax cannot determine whether an arbitrary short string is secretly a credential: trusted admission additionally compares metadata and change context against approved, already redacted references. Never map secrets into ID fields, hash passwords as context, or copy raw rejected input into another log. Privacy redaction and authorization run before append/export; schema validation is not automatic redaction.

## Verification and remaining owners

Run from the repository root with Node >=24 and the pinned pnpm:

```sh
pnpm --filter @arbi/protocol generate
pnpm --filter @arbi/protocol lint
pnpm --filter @arbi/protocol typecheck
pnpm --filter @arbi/protocol test
pnpm --filter @arbi/protocol build
pnpm docs:check
git diff --check
```

Generation checks include the consumed audit bindings. Committed fixtures cover every action, all three actor kinds, allow/deny/fail/unknown/interrupted outcomes, device/source/command bindings and adversarial extra fields. Tests exercise closed-schema privacy checks at every object depth, runtime semantics, trusted receipt/redaction admission, intent joins and protocol terminal projection. Existing protocol 1.0 fixtures and host Python/C round-trips continue to run unchanged.

This is source/host contract evidence. Durable append, idempotent/offline spool and persistence admission policy belong to [#27](https://github.com/gredice/arbi/issues/27); search/export/retention to [#36](https://github.com/gredice/arbi/issues/36); actual manipulation/update instrumentation to [#46](https://github.com/gredice/arbi/issues/46); media instrumentation to [#56](https://github.com/gredice/arbi/issues/56); end-to-end completeness/failure evidence to [#64](https://github.com/gredice/arbi/issues/64). No deployed service, cryptographic provenance, append store, global cursor, browser instrumentation or installed-device effect is implemented here.

Both dashboard modes retain explicit permission checks. Audit persistence failure inhibits applicable new remote actions under ADR-0005, while independent local stop/fault handling continues without cloud/audit connectivity. Driver-local encoders do not supply measured position or tension to the Pico; device reports cannot change that. `Parked` is insufficient reboot authorization. Bench, installed operation, update-safe restraint and qualified physical acceptance remain separately unverified.
