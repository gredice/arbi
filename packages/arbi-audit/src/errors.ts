/** Safe HTTP error codes can be consumed without loading SQLite or protocol tools. */
export class AuditError extends Error {
  constructor(readonly code: "INVALID_REQUEST" | "DENIED" | "CONFLICT" | "CAPACITY" | "UNAVAILABLE" | "TAMPER") {
    super(code); this.name = "AuditError";
  }
}
