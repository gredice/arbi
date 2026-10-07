// Generated from schema/configuration.schema.json. Run pnpm --filter @arbi/protocol generate.
// Refinements (ranges, formats, conditionals) require validateConfigurationRecord at runtime.

import type { Id, Realm, Identity, Actor, VectorMm, SiteFrame, GimbalFrame, Capability, Sample } from "./messages.js";

export type ConfigurationEvidence = { "id": Id; "recordRevision": Id; "stage": "design" | "simulation" | "bench" | "secured-frame" | "installed" | "qualified-review"; "result": "passed" | "failed" | "unverified"; "reviewerId": Id; };

export type ConfigurationUpdate = ({ "kind": "unsupported"; "reason": Id; }) | ({ "kind": "supported"; "interfaceId": Id; "targets": Array<"firmware" | "application" | "os">; "evidence": ConfigurationEvidence; });

export type ConfigurationComponent = ({ "id": Id; "hardwareId": Id; "hardwareRevision": Id; "assemblyId": Id; "assemblyRevision": Id; "kind": "passive"; }) | ({ "id": Id; "hardwareId": Id; "hardwareRevision": Id; "assemblyId": Id; "assemblyRevision": Id; "kind": "module"; "role": "edge" | "pico" | "pod" | "driver" | "peripheral"; "firmwareVersion": (Id) | (null); "update": ConfigurationUpdate; });

export type ConfigurationSignal = { "id": Id; "physicalComponentId": (Id) | (null); "ownerComponentId": Id; "interfaceId": Id; "metric": (Capability["metric"]) | (null); "frame": Sample["frame"]; "reading": ({ "kind": "unavailable"; "reason": "sensor-not-installed" | "not-reported" | "sensor-fault"; }) | ({ "kind": "reported"; "qualities": Capability["qualities"]; "evidence": ConfigurationEvidence; }); };

export type ConfigurationAnchor = { "line": "a" | "b" | "c" | "d"; "componentId": Id; "positionMm": VectorMm; };

export type ConfigurationBox = { "minMm": VectorMm; "maxMm": VectorMm; };

export type ConfigurationBed = { "bedId": Id; "mappingRevision": Id; "bounds": ConfigurationBox; };

export type ConfigurationPlant = { "plantId": Id; "bedId": Id; "mappingRevision": Id; "positionMm": VectorMm; };

export type ConfigurationGeometry = { "revision": Id; "siteFrame": SiteFrame; "gimbalFrame": GimbalFrame; "convention": "right-handed-x-y-z-mm-deg"; "anchors": Array<ConfigurationAnchor>; "beds": Array<ConfigurationBed>; "plants": Array<ConfigurationPlant>; };

export type ConfigurationRange = { "min": number; "max": number; };

export type ConfigurationLimits = { "revision": Id; "workspace": ConfigurationBox; "maxSpeedMmPerS": number; "maxAccelerationMmPerS2": number; "tensionN": ConfigurationRange; "panDeg": ConfigurationRange; "tiltDeg": ConfigurationRange; };

export type ConfigurationCalibration = { "revision": Id; "previousRevision": (Id) | (null); "hardwareDigest": string; "geometryDigest": string; "limitsDigest": string; "scope": "simulation" | "bench" | "installed"; "lineLengthOffsetsMm": { "a": number; "b": number; "c": number; "d": number; }; "gimbalZeroDeg": { "pan": number; "tilt": number; }; "uncertaintyMm": number; "evidence": Array<ConfigurationEvidence>; };

export type Configuration = { "schemaVersion": "arbi.configuration/1.0"; "revision": Id; "previousRevision": (Id) | (null); "realm": Realm; "executionMode": "simulation" | "hardware"; "siteId": Id; "components": Array<ConfigurationComponent>; "signals": Array<ConfigurationSignal>; "geometry": ConfigurationGeometry; "limits": ConfigurationLimits; "calibration": (ConfigurationCalibration) | (null); };

export type ConfigurationEditContext = { "actor": Actor; "authorizationId": Id; "correlationId": Id; "reasonCode": Id; "previousConfigRevision": (Id) | (null); "previousCalibrationRevision": (Id) | (null); };

export type ConfigurationTransition = ({ "kind": "apply"; }) | ({ "kind": "rollback"; "targetRevision": Id; });

export type ConfigurationRequest = { "schemaVersion": "arbi.configuration/1.0"; "transactionId": Id; "expectedAppliedRevision": (Id) | (null); "target": Identity; "transition": ConfigurationTransition; "configuration": Configuration; "auditContext": ConfigurationEditContext; };

export type AppliedConfiguration = { "schemaVersion": "arbi.configuration/1.0"; "request": ConfigurationRequest; "appliedBy": Identity; "configurationDigest": string; };

export type ConfigurationReport = { "schemaVersion": "arbi.configuration/1.0"; "type": "configuration.applied" | "configuration.boot"; "source": Identity; "transactionId": Id; "appliedRevision": Id; "configurationDigest": string; "calibrationRevision": Id; "hardwareDigest": string; "inhibited": true; };

export type ConfigurationJournal = { "schemaVersion": "arbi.configuration/1.0"; "appliedTransactionId": (Id) | (null); "commits": Array<AppliedConfiguration>; };
