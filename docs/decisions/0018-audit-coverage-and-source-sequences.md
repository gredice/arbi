# ADR-0018: Audit coverage and independent cloud source sequences

Status: accepted when the issue PR merges. Work record: [#64](https://github.com/gredice/arbi/issues/64).

## Decision

The committed [coverage inventory](../software/audit-coverage.json) maps every dashboard HTTP route, privileged device entrypoint and existing internal configuration/update/recording hook to required facts, executable evidence and observability limits. CI rejects an added HTTP route without an inventory entry. An inventory assertion is coverage bookkeeping; the linked source/native scenarios establish behavior.

Cloud job/realtime/live audit sequences are allocated per exact canonical audit stream (realm, execution mode, site and service source epoch). The existing registry row lock serializes allocations and admissions. A transaction-local reservation starts at the stream's committed maximum and advances for each event; a rollback discards reservations. Protocol commands retain their independent counter. This avoids reporting commands or other service epochs as missing audit events without adding another counter ledger.

A live service outcome emitted by a replacement service uses that service's own source epoch and monotonic clock while retaining the original requesting actor, intent and correlation links. It cannot inherit the prior service's clock identity. Original historical events, stream sequences, gaps and hash chains are never rewritten.

## Evidence and limits

Native integration exercises direct operator/viewer API access, concurrent services, repeated submissions, required audit failures and recovery. Immutable protocol reports preserve accepted/running/contradictory outcomes separately from terminal audit facts. Signed offline audit replay preserves original source identity/clocks and explicit missing ranges; receipt loss does not duplicate execution or history.

A contiguous cloud audit stream proves continuity of committed facts for that producer, not physical execution, completeness of provider instrumentation or absence of an unobserved action. Protocol-derived terminal audit sequences cover selected protocol evidence; skipped sequence numbers must not be described as proven missing audit records. Failed/unacknowledged writes and disconnected buffers can leave observable gaps. Those remain explicit. Mandatory admission fails closed when audit acknowledgement is unavailable; denied actions stay denied when best-effort denial logging fails.

Provider identity lifecycle, physical model/calibration/capture evidence, real media packet/playback observations and installed update outcomes remain independently gated in the inventory. Reserved recording hooks stay disabled. Public exports contain closed metadata and pseudonyms, never credentials, URLs, raw media or real site coordinates.
