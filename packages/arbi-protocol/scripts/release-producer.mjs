import { readFileSync } from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import { bindReleaseInventory, produceRelease, inspectReleaseSet } from "../dist/index.js";

// Offline synthetic availability catalog. No upload, deployment, key storage or installation.
const fixtures = JSON.parse(readFileSync(new URL("../fixtures/releases.json", import.meta.url), "utf8"));
const configuration = JSON.parse(readFileSync(new URL("../fixtures/configuration.json", import.meta.url), "utf8")).valid.configuration;
const requireValue = (r) => { if (!r.ok) throw new Error(r.error.code); return r.value; };
const inventory = requireValue(bindReleaseInventory(fixtures.inventory, configuration));
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const releaseSet = structuredClone(fixtures.releaseSet);
releaseSet.manifests = releaseSet.manifests.map(m => requireValue(produceRelease(m, Buffer.from(fixtures.payloads[m.releaseId]), { keyId: "synthetic-test-key", privateKey })));
requireValue(inspectReleaseSet(releaseSet));
process.stdout.write(JSON.stringify({ schemaVersion: "arbi.reference-release-catalog/1.0", evidence: "offline-synthetic", publicKey: publicKey.export({ type: "spki", format: "pem" }), inventory, releaseSet }, null, 2) + "\n");
