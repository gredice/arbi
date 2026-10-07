// Generated from schema/audit-event.schema.json. Run pnpm --filter @arbi/protocol generate.
// Refinements (ranges, formats, conditionals) require validateAuditEvent at runtime.

import type { Actor, Counter, Id, Identity, IngestTime, Realm, SourceTime } from "./messages.js";

export type AuditAction = "identity.login" | "authorization.check" | "control.session.start" | "control.session.end" | "control.session.revoke" | "control.session.timeout" | "motion.move" | "gimbal.move" | "control.stop" | "motion.home" | "calibration.change" | "configuration.change" | "schedule.create" | "schedule.update" | "schedule.delete" | "capture.request" | "release.publish" | "update.request" | "update.install" | "update.rollback" | "live.grant" | "live.start" | "live.end" | "live.revoke" | "live.timeout" | "live.heartbeat" | "still.view" | "history.view" | "playback.view" | "playback.heartbeat" | "media.download" | "media.export" | "recording.start" | "recording.stop" | "recording.fail" | "recording.delete";

export type AuditEvidence = "intent" | "authorization" | "access-grant" | "device-outcome" | "service-outcome" | "media-observation" | "access-observation" | "browser-observation" | "connection-loss";

export type AuditOutcome = "requested" | "allow" | "deny" | "succeeded" | "fail" | "unknown" | "interrupted" | "observed";

export type AuditReason = "requested" | "authorized" | "not-authorized" | "invalid-request" | "unsupported" | "disabled" | "local-inhibit" | "completed" | "execution-failed" | "cancelled" | "interrupted" | "connection-lost" | "response-lost" | "source-restarted" | "timeout" | "revoked" | "observed" | "heartbeat" | "storage-failed" | "delivery-failed" | "ended";

export type AuditSource = { "module": "cloud" | "edge" | "motion" | "pod" | "browser" | "media"; "identity": Identity; };

export type AuditResource = { "kind": "site" | "device" | "control-session" | "calibration" | "configuration" | "schedule" | "capture" | "release" | "update" | "live-session" | "still" | "history" | "recording" | "audit"; "id": Id; "deviceId": (Id) | (null); };

export type AuditLinks = { "correlationId": Id; "intentEventId": (Id) | (null); "causationEventId": (Id) | (null); "jobId": (Id) | (null); "sessionId": (Id) | (null); "commandId": (Id) | (null); "requestSource": (Identity) | (null); "target": (Identity) | (null); };

export type AuditRecordReference = { "kind": "protocol-event" | "local-record"; "id": Id; };

export type AuditInterval = { "startMonotonicMs": number; "endMonotonicMs": number; };

export type AuditMetadata = { "permission"?: "login" | "view" | "control" | "capture" | "calibrate" | "configure" | "schedule" | "release" | "update" | "export" | "recording"; "observation"?: "connection-established" | "bytes-delivered" | "connection-ended" | "delivery-started" | "delivery-ended" | "browser-heartbeat"; "byteCount"?: number; "observedInterval"?: AuditInterval; "grantId"?: Id; "configRevision"?: Id; "calibrationRevision"?: Id; "scheduleRevision"?: Id; "releaseId"?: Id; };

export type AuditChangeSummary = { "revisionId": (Id) | (null); "state": "absent" | "draft" | "active" | "retired" | "enabled" | "disabled" | "staged" | "installed" | "failed" | "rolled-back"; };

export type AuditChange = { "fields": Array<"motion-envelope" | "gimbal-limits" | "target-mapping" | "references" | "capture-settings" | "schedule-timing" | "release-selection" | "access-policy" | "privacy-policy">; "before": AuditChangeSummary; "after": AuditChangeSummary; };

export type AuditEvent = { "auditVersion": "arbi.audit/1.0"; "eventId": Id; "realm": Realm; "executionMode": "simulation" | "hardware"; "siteId": Id; "actor": Actor; "source": AuditSource; "sequence": Counter; "sourceTime": SourceTime; "ingestTime": IngestTime; "resource": AuditResource; "action": AuditAction; "evidence": AuditEvidence; "outcome": AuditOutcome; "effect": "none" | "unknown" | "device-reported"; "reason": AuditReason; "links": AuditLinks; "record": (AuditRecordReference) | (null); "metadata": AuditMetadata; "change": (AuditChange) | (null); };
