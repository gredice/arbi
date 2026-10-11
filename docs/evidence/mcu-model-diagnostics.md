# MCU model diagnostics source evidence

Work record: [#70](https://github.com/gredice/arbi/issues/70). Decision: [ADR-0029](../decisions/0029-bounded-mcu-model-diagnostics.md). Implementation: [guide](../software/mcu-model-diagnostics.md).

Three new host groups check actual C exports against the application-owned JSON Schema and unchanged shared protocol validator; reject zero/measured placeholders for absent encoder/current/tension channels; distinguish unconfigured, commanded/estimated and inhibited/stale samples with retained timestamps/age/frame; keep all real inputs and physical timing unavailable; exercise 10,000 flooded records, reserved fault slots, priority-tier overflow, sequence order, cursor gaps, old-boot boundaries and future-cursor refusal; redact malformed identifiers; and drive actual local controller accepted/rejected/completed/interrupted hooks with exact source/target epochs, command/correlation IDs and copied configuration identity. The model occupies 28,656 host bytes including its ring; no dynamic application buffer grows with flood volume.

Clean revision `824eeabe3b27f55eabdcefacbd8b36f55184914d` (`ARBI_BUILD_DIRTY=0`) passed all 25 groups normally and under AddressSanitizer/UndefinedBehaviorSanitizer across six host binaries. Both target branches built with pinned Pico SDK 2.2.0 / ARM GCC 12.2.1. The ordinary diagnostic image remains 59,832 text / 57,788 BSS bytes; the separate denied-permission link-check retains actual diagnostic/controller functions with 55,096 text / 73,780 BSS bytes, including static export/page buffers. Frozen workspace installation, source lint, JSON Schema/protocol validation, documentation and whitespace passed. Tests also verify sequence exhaustion reports a gap and prior event configuration identity survives a later profile change.

Fixed storage and host/schema results do not demonstrate worst-case hardware interrupt response or SDK formatting/transport timing. Neither ring export nor valid protocol JSON is authenticated device audit evidence by itself.

| Gate | Status |
| --- | --- |
| Bounded source records, quality/provenance, gap/reset semantics | Explicit synthetic host fixtures |
| Real inputs/encoder/current/tension | Unavailable; source marks null |
| Actual pulse/interrupt/fault-response comparison under maximum diagnostics | Unavailable; no board, analyzer or accepted timing trace |
| Authenticated real MCU adapter and durable edge/cloud receipt | Follow-up integration; no fabricated receipt or complete-history claim |

#70 remains open for required hardware timing and real interface integration. No physical readiness, timing qualification, fitted sensor or external reviewer acceptance is claimed.
