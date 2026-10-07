// Generated from schema/update.schema.json. Run pnpm --filter @arbi/protocol generate.
// Refinements (ranges, formats, conditionals) require validateUpdateRecord at runtime.

import type { Id, Identity, Realm, Actor, Counter } from "./messages.js";
import type { ReleaseManifest, ReleaseBuild, ReleaseDigest, ReleaseVersion } from "./release-types.js";

export type UpdateScope = { "realm": Realm; "executionMode": "simulation" | "hardware"; "siteId": Id; };

export type UpdateAuditContext = { "actor": Actor; "authorizationId": Id; "correlationId": Id; "intentEventId": Id; };

export type UpdateRequest = { "schemaVersion": "arbi.update/1.0"; "scope": UpdateScope; "operationId": Id; "coordinatorId": Id; "source": Identity; "manifest": ReleaseManifest; "expectedInstalledReleaseId": Id; "issuedAt": string; "startDeadline": string; "confirmationDeadline": string; "auditContext": UpdateAuditContext; "budget": { "reservationId": Id; "payloadBytes": Counter; "maximumWanBytes": Counter; "category": "ota" | "os-update"; }; "configurationDataVersion": ReleaseVersion; "direction": "install" | "rollback"; "releaseSetId": Id; };

export type UpdateBootObservation = { "source": Identity; "observedAt": string; "provenance": "local-boot-observation"; "releaseId": Id; "build": ReleaseBuild; "artifactDigest": ReleaseDigest; "configurationDataVersion": ReleaseVersion; "health": "passed" | "failed" | "unknown"; "recordId": Id; "schemaVersion": "arbi.update/1.0"; };

export type UpdateEvent = { "schemaVersion": "arbi.update/1.0"; "operationId": Id; "eventId": Id; "kind": "staged" | "installation-reserved" | "trial" | "confirmed" | "failed" | "rolled-back" | "recovery-required"; "source": Identity; "observedAt": string; "artifactDigest": ReleaseDigest; "boot": (UpdateBootObservation) | (null); "reasonCode": Id; "verification": (UpdateArtifactVerification) | (null); "preflight": (UpdatePreflight) | (null); };

export type UpdateJournal = { "schemaVersion": "arbi.update/1.0"; "request": UpdateRequest; "baseline": UpdateBootObservation; "events": Array<UpdateEvent>; "baselineManifest": ReleaseManifest; };

export type UpdateArtifactVerification = { "manifestDigest": ReleaseDigest; "keyId": Id; "artifactDigest": ReleaseDigest; "recordId": Id; };

export type UpdatePreflight = { "recordId": Id; "independentProtectionOwnerId": Id; "updateSafe": true; };
