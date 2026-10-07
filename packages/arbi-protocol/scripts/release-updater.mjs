import { readFileSync } from "node:fs";
import { createPublicKey } from "node:crypto";
import { bindReleaseInventory, configurationDigest, verifyReleaseArtifact, inspectReleaseSet, requestUpdate, admitUpdateEvent, reserveReferenceInstallation, recoverUpdate } from "../dist/index.js";

// Consumes the producer's catalog and the same committed synthetic payload/status vectors.
const requireValue = (r) => { if (!r.ok) throw new Error(r.error.code); return r.value; };
if (process.argv.length !== 3) throw new Error("Usage: node scripts/release-updater.mjs <reference-catalog.json>");
const catalog = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (catalog.schemaVersion !== "arbi.reference-release-catalog/1.0" || catalog.evidence !== "offline-synthetic") throw new Error("INVALID_CATALOG");
const releases = JSON.parse(readFileSync(new URL("../fixtures/releases.json", import.meta.url), "utf8"));
const updates = JSON.parse(readFileSync(new URL("../fixtures/updates.json", import.meta.url), "utf8"));
const configuration = JSON.parse(readFileSync(new URL("../fixtures/configuration.json", import.meta.url), "utf8")).valid.configuration;
const inventory = requireValue(bindReleaseInventory(catalog.inventory, configuration));
const paths = requireValue(inspectReleaseSet(catalog.releaseSet));
const key = createPublicKey(catalog.publicKey); // Ephemeral simulation key from producer, not production trust.
for (const manifest of catalog.releaseSet.manifests) {
  if (typeof releases.payloads[manifest.releaseId] !== "string") throw new Error("UNKNOWN_FIXTURE");
  requireValue(verifyReleaseArtifact(manifest, Buffer.from(releases.payloads[manifest.releaseId]), { keyId: "synthetic-test-key", publicKey: key }));
}
const manifest = catalog.releaseSet.manifests.find(m => m.releaseId === updates.request.manifest.releaseId);
const baselineManifest = catalog.releaseSet.manifests.find(m => m.releaseId === updates.baselineManifest.releaseId);
const request = { ...updates.request, manifest };
let journal = requireValue(requestUpdate([], request, { scope: request.scope, inventory, releaseSet: catalog.releaseSet, currentSelections: paths.updateStates[1], authenticatedSource: request.source, authorizedAuditContext: request.auditContext, baseline: updates.baseline, baselineManifest, nowUtc: request.issuedAt })).journal;
const statuses = [requireValue(recoverUpdate(journal)).status];
let reserved = false;
for (const originalEvent of updates.events) {
  const event = structuredClone(originalEvent);
  if (event.verification) event.verification.manifestDigest = configurationDigest(manifest);
  const boundary = { scope: request.scope, authenticatedSource: event.source, owner: event.boot ? "target" : "edge", nowUtc: event.observedAt, localBootObservation: event.boot, artifactVerification: event.verification, preflight: event.preflight };
  if (event.kind === "installation-reserved") {
    const result = requireValue(reserveReferenceInstallation(journal, event, boundary));
    journal = result.journal; reserved = result.dispatchInstallation; // No actual dispatch mechanism exists.
  } else journal = requireValue(admitUpdateEvent(journal, event, boundary));
  const recovered = requireValue(recoverUpdate(JSON.parse(JSON.stringify(journal))));
  if (recovered.dispatchInstallation !== false) throw new Error("REPLAY_DISPATCH");
  statuses.push(recovered.status);
}
process.stdout.write(JSON.stringify({ evidence: "offline-synthetic", verifiedArtifactCount: catalog.releaseSet.manifests.length, updateStateCount: paths.updateStates.length, rollbackPrefixCount: paths.rollbackStates.length, statuses, installationReserved: reserved, recoveryDispatch: false }, null, 2) + "\n");
