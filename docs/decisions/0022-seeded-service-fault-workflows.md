# ADR-0022: Seeded service fault workflows and evidence boundaries

Status: accepted when the issue PR merges. Work record: [#77](https://github.com/gredice/arbi/issues/77).

Fault experiments call the existing actual local job consumer, shared transfer budget, authenticated update API, cloud command boundary, live-session authority and private media SDK. They use their durable SQLite/native PostgreSQL journals and explicitly isolated adapters. The experiment owns no alternative command, audit, accounting, release or viewer authority. Ordinary application startup cannot select it.

A bounded unsigned 32-bit seed fixes virtual fault timing. Every scenario declares expected state, bandwidth policy and audit outcome and returns a semantic trace with a SHA-256 digest. Repeating a local seed must reproduce the semantic trace exactly. Random service event IDs, boot/session identifiers and signing keys remain in private journals; public trace aliases preserve correlation and intent relationships without claiming that independent runs share those identities. Host duration is separate from virtual injection time.

Local alarm/reference/sensor/reset/power/deadline/restart/outage cases require operator recovery and never replay old commands. Actual interrupted Range bodies retain their original charge IDs; verification, canary failure and rollback are checked against persisted target observations. The essential health reservation/rate pool remains admissible after optional exhaustion. Its declared synthetic health bytes are separate from actual HTTP artifact byte measurements.

Native cloud cases verify denied/allowed manipulation, revocation before delivery, independent viewers sharing one isolated signaling producer, viewer limits, explicit lower-profile selection and budget shutdown. Isolated signaling has no video payload observation. Recording remains disabled: six reserved lifecycle operations exercise current SDK denial and the existing disabled-event fixtures. A real private Blob SDK fixture reads both the original and retried PUT body while immutable completion retains one image; verified object size is not a claim of carrier usage.

Source tests, native host durability, measured transport payload and physical outcomes remain distinct. No scenario establishes GPIO timing, mechanical stop distance, real capture quality, radio traffic, provider billing or hardware OTA recovery. The complete [scenario guide](../software/fault-workflows.md) and [evidence](../evidence/fault-workflows.md) state these limits.
