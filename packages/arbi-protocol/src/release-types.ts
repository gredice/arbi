// Generated from schema/release.schema.json. Run pnpm --filter @arbi/protocol generate.
// Refinements (ranges, formats, conditionals) require validateReleaseRecord at runtime.

import type { Id, Identity, Realm } from "./messages.js";
import type { ConfigurationComponent, ConfigurationEvidence } from "./configuration-types.js";

export type ReleaseVersion = string;

export type ReleaseDigest = string;

export type ReleaseVersionRange = { "min": ReleaseVersion; "max": ReleaseVersion; };

export type ReleaseContractRange = { "min": string; "max": string; };

export type ReleaseTarget = { "moduleId": Id; "targetClass": "pico-motion" | "pi-pod" | "linux-edge"; "boardId": Id; "hardwareId": Id; "hardwareRevision": Id; "assemblyId": Id; "assemblyRevision": Id; };

export type ReleaseCapability = ({ "kind": "unavailable"; "reason": Id; }) | ({ "kind": "reference-only"; "targets": Array<"firmware" | "application" | "os">; "method": "simulated-trial-boot"; "evidence": ConfigurationEvidence; });

export type ReleaseModule = { "component": ConfigurationComponent; "boardId": Id; "targetClass": "pico-motion" | "pi-pod" | "linux-edge" | "driver" | "passive"; "updaterVersion": (ReleaseVersion) | (null); "bootloaderVersion": (ReleaseVersion) | (null); "capability": ReleaseCapability; };

export type ReleaseInventory = { "schemaVersion": "arbi.release/1.0"; "realm": Realm; "executionMode": "simulation" | "hardware"; "siteId": Id; "configurationRevision": Id; "modules": Array<ReleaseModule>; };

export type ReleaseBuild = { "version": ReleaseVersion; "buildId": Id; "commit": string; };

export type ReleaseSignature = { "algorithm": "ed25519"; "keyId": Id; "value": string; };

export type ReleaseArtifact = { "artifactId": Id; "kind": "firmware" | "application" | "os"; "sha256": ReleaseDigest; "sizeBytes": number; "signature": ReleaseSignature; };

export type ReleaseDependency = { "moduleId": Id; "versions": ReleaseVersionRange; };

export type ReleaseMigration = { "from": ReleaseVersion; "to": ReleaseVersion; "rollbackTo": (ReleaseVersion) | (null); "recordId": Id; };

export type ReleaseConfiguration = { "schemaRange": ReleaseContractRange; "dataRange": ReleaseVersionRange; "migration": (ReleaseMigration) | (null); };

export type ReleaseManifest = { "schemaVersion": "arbi.release/1.0"; "releaseId": Id; "target": ReleaseTarget; "build": ReleaseBuild; "artifact": ReleaseArtifact; "channel": "development" | "candidate" | "stable"; "protocolRange": ReleaseContractRange; "configuration": ReleaseConfiguration; "minimumUpdater": ReleaseVersion; "minimumBootloader": (ReleaseVersion) | (null); "dependencies": Array<ReleaseDependency>; };

export type ReleaseSelection = { "moduleId": Id; "releaseId": Id; "configurationDataVersion": ReleaseVersion; };

export type ReleaseOrder = { "moduleId": Id; "after": Array<Id>; };

export type ReleaseRollbackPath = { "afterStep": number; "steps": Array<ReleaseSelection>; };

export type ReleaseSet = { "schemaVersion": "arbi.release/1.0"; "releaseSetId": Id; "manifests": Array<ReleaseManifest>; "initial": Array<ReleaseSelection>; "desired": Array<ReleaseSelection>; "order": Array<ReleaseOrder>; "steps": Array<ReleaseSelection>; "rollbackPaths": Array<ReleaseRollbackPath>; };
