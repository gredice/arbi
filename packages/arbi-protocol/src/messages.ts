// Generated from schema/message.schema.json. Run pnpm --filter @arbi/protocol generate.
// Refinements (ranges, formats, conditionals) require validateMessage at runtime.

export type Id = string;

export type Counter = string;

export type MonotonicMs = number;

export type ErrorCode = "INVALID_JSON" | "MESSAGE_TOO_LARGE" | "UNSUPPORTED_VERSION" | "UNKNOWN_KIND" | "UNKNOWN_TYPE" | "UNKNOWN_FIELD" | "INVALID_MESSAGE" | "INVALID_RANGE" | "REALM_MISMATCH" | "SITE_MISMATCH" | "SOURCE_MISMATCH" | "TARGET_MISMATCH" | "TARGET_RESTARTED" | "SESSION_MISMATCH" | "DEADLINE_EXPIRED" | "DEADLINE_TOO_FAR" | "LEASE_REQUIRED" | "LEASE_STALE" | "LEASE_EXPIRED" | "NOT_AUTHORIZED" | "CONFIG_MISMATCH" | "UNSUPPORTED_CAPABILITY" | "FAULT_INHIBITED" | "IDEMPOTENCY_CONFLICT" | "SEQUENCE_REPLAY" | "RESYNC_REQUIRED" | "CLOCK_INVALID" | "QUALITY_UNSUPPORTED" | "INVALID_TRANSITION" | "EXECUTION_FAILED" | "CANCELLED" | "INTERRUPTED" | "RESOURCE_LIMIT";

export type Realm = { "environment": "production" | "preview" | "test"; "namespaceId": Id; };

export type Identity = { "deviceId": Id; "bootId": Id; "sessionId": Id; };

export type SourceTime = { "utc": (string) | (null); "monotonicMs": number; "uncertaintyMs": (number) | (null); };

export type IngestTime = ({ "utc": string; "uncertaintyMs": number; "deviceId": Id; }) | (null);

export type Actor = { "kind": "human" | "service" | "device"; "id": Id; };

export type Error = { "code": ErrorCode; "retryable": boolean; };

export type Cursor = { "source": Identity; "stream": "event" | "telemetry"; "sequence": Counter; };

export type Target = Identity;

export type Deadline = { "bootId": Id; "sessionId": Id; "expiresMonotonicMs": number; };

export type Lease = ({ "id": Id; "holderId": Id; "fence": Counter; }) | (null);

export type SiteFrame = { "name": "site"; "revision": Id; };

export type GimbalFrame = { "name": "pod-gimbal"; "revision": Id; };

export type NoFrame = { "name": "none"; "revision": null; };

export type VectorMm = { "x": number; "y": number; "z": number; };

export type CommandBody = ({ "type": "motion.move"; "positionMm": VectorMm; "frame": SiteFrame; "maxSpeedMmPerS": number; "maxDurationMs": number; }) | ({ "type": "control.stop"; "reason": "operator" | "lease-lost" | "fault" | "timeout"; }) | ({ "type": "camera.gimbal"; "panDeg": number; "tiltDeg": number; "frame": GimbalFrame; "maxDurationMs": number; }) | ({ "type": "camera.capture"; "resourceId": Id; "maxDurationMs": number; }) | ({ "type": "camera.preview.start"; "viewSessionId": Id; "maxDurationMs": number; "maxWidthPx": number; "maxFps": number; "maxBitrateBitsPerS": number; }) | ({ "type": "camera.preview.stop"; "viewSessionId": Id; }) | ({ "type": "command.cancel"; "commandId": Id; }) | ({ "type": "state.resync"; "cursor": (Cursor) | (null); "committedCursor": (RecoveryCursor) | (null); });

export type CommandContext = { "commandId": Id; "correlationId": Id; "idempotencyKey": Id; "actor": Actor; "target": Target; "deadline": Deadline; "lease": Lease; "configRevision": Id; };

export type Sample = { "metric": "position.x" | "position.y" | "position.z" | "line.length.a" | "line.length.b" | "line.length.c" | "line.length.d" | "line.tension.a" | "line.tension.b" | "line.tension.c" | "line.tension.d" | "power.voltage" | "gimbal.pan" | "gimbal.tilt"; "quality": "measured" | "commanded" | "estimated" | "stale" | "unavailable"; "value": (number) | (null); "unit": "mm" | "N" | "V" | "deg"; "frame": (SiteFrame) | (GimbalFrame) | (NoFrame); "sampleMonotonicMs": (number) | (null); "ageMs": (number) | (null); "uncertainty": (number) | (null); "reason": ("sensor-not-installed" | "sensor-fault" | "not-reported" | "expired") | (null); "originQuality": ("measured" | "commanded" | "estimated") | (null); };

export type Capability = { "metric": "position.x" | "position.y" | "position.z" | "line.length.a" | "line.length.b" | "line.length.c" | "line.length.d" | "line.tension.a" | "line.tension.b" | "line.tension.c" | "line.tension.d" | "power.voltage" | "gimbal.pan" | "gimbal.tilt"; "qualities": Array<"measured" | "commanded" | "estimated">; };

export type TelemetryBody = { "type": "telemetry.samples"; "capabilitiesRevision": Id; "samples": Array<Sample>; };

export type EventBody = ({ "type": "command.outcome"; "commandId": Id; "correlationId": Id; "requestSource": Identity; "outcome": "requested" | "accepted" | "rejected" | "running" | "completed" | "failed" | "cancelled"; "error": (Error) | (null); "resourceId": (Id) | (null); }) | ({ "type": "fault.changed"; "faultId": Id; "state": "raised" | "cleared"; "severity": "info" | "inhibit" | "stop"; "error": Error; }) | ({ "type": "state.snapshot"; "configRevision": Id; "capabilitiesRevision": Id; "capabilities": Array<Capability>; "state": "Boot" | "Homing" | "Ready" | "Moving" | "Settling" | "Capturing" | "Returning" | "Docking" | "Parked" | "Maintenance" | "Fault"; "eventCursor": Cursor; "telemetryCursor": (Cursor) | (null); "committedCursor": (RecoveryCursor) | (null); "supportedCommands": Array<"motion.move" | "control.stop" | "camera.gimbal" | "camera.capture" | "camera.preview.start" | "camera.preview.stop" | "command.cancel" | "state.resync">; "supportedProtocols": Array<"arbi/1.0">; });

export type Command = { "protocol": "arbi/1.0"; "messageId": Id; "realm": Realm; "siteId": Id; "source": Identity; "sequence": Counter; "sourceTime": SourceTime; "ingestTime": IngestTime; "kind": "command"; "body": CommandBody; "command": CommandContext; "executionMode": "simulation" | "hardware"; };

export type Event = { "protocol": "arbi/1.0"; "messageId": Id; "realm": Realm; "siteId": Id; "source": Identity; "sequence": Counter; "sourceTime": SourceTime; "ingestTime": IngestTime; "kind": "event"; "body": EventBody; "executionMode": "simulation" | "hardware"; };

export type Telemetry = { "protocol": "arbi/1.0"; "messageId": Id; "realm": Realm; "siteId": Id; "source": Identity; "sequence": Counter; "sourceTime": SourceTime; "ingestTime": IngestTime; "kind": "telemetry"; "body": TelemetryBody; "executionMode": "simulation" | "hardware"; };

export type RecoveryCursor = { "logId": Id; "epoch": Id; "token": string; };

export type Message = Command | Event | Telemetry;
