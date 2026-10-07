import { createPublicKey, verify } from "node:crypto";
import { configurationDigest } from "@arbi/protocol";
import { EnrollmentError } from "./contracts";

/** Signing input is an unambiguous canonical digest with a separate trust-domain prefix. */
export function proofBytes(value: unknown): Buffer {
  return Buffer.from(`arbi-device-proof/1.0:${configurationDigest(value)}`, "utf8");
}
export function publicKey(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{59}$/.test(value)) throw new EnrollmentError("INVALID_REQUEST");
  try {
    const key = createPublicKey({ key: Buffer.from(value, "base64url"), format: "der", type: "spki" });
    if (key.asymmetricKeyType !== "ed25519" || key.export({ format: "der", type: "spki" }).toString("base64url") !== value) {
      throw new Error();
    }
    return value;
  } catch { throw new EnrollmentError("INVALID_REQUEST"); }
}
export function prove(key: string, payload: unknown, signature: unknown): void {
  if (typeof signature !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(signature)) throw new EnrollmentError("DENIED");
  try {
    const bytes = Buffer.from(signature, "base64url");
    if (bytes.toString("base64url") !== signature || !verify(null, proofBytes(payload),
      createPublicKey({ key: Buffer.from(key, "base64url"), type: "spki", format: "der" }), bytes)) throw new Error();
  } catch { throw new EnrollmentError("DENIED"); }
}
