import { configurationDigest, configurationHardwareDigest, type AppliedConfiguration, type Configuration, type ConfigurationBoundary, type Scenario } from "@arbi/protocol";

/** Build the simulation-only applied configuration context consumed by shared command checking. */
export function configuredBoundary(s: Pick<Scenario, "id" | "gate">, config: Configuration): { applied: AppliedConfiguration; boundary: ConfigurationBoundary } {
  return {
    applied: { schemaVersion: config.schemaVersion, configurationDigest: configurationDigest(config), appliedBy: s.gate.receiver,
      request: { schemaVersion: config.schemaVersion, transactionId: "offline-reference", expectedAppliedRevision: null, target: s.gate.receiver, transition: { kind: "apply" }, configuration: config,
        auditContext: { actor: s.gate.actor, authorizationId: "synthetic-offline", correlationId: s.id, reasonCode: "reference-only", previousConfigRevision: null, previousCalibrationRevision: null } } },
    boundary: { receiver: s.gate.receiver, realm: config.realm, siteId: config.siteId, executionMode: "simulation", calibrationScope: "simulation", installedHardwareDigest: configurationHardwareDigest(config), localLimits: config.limits, approvedCalibrationDigests: [configurationDigest(config.calibration)], readableSchemaVersions: [config.schemaVersion], rollbackReadableSchemaVersions: [config.schemaVersion] },
  };
}
