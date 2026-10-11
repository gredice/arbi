# ADR-0015: Owned media access and delivery evidence

- Status: Accepted when merged; proposed until then
- Date: 2026-10-11
- Work record: [#56](https://github.com/gredice/arbi/issues/56), parent [#12](https://github.com/gredice/arbi/issues/12)
- Evidence: [media audit](../evidence/media-audit.md)

## Decision

The existing live authority owns every viewer grant, token epoch, close reason and producer binding. A signed enrolled-device report may attach a bounded delivery summary to that viewer; this does not introduce a second admission/signaling service. Summaries reference existing immutable usage windows, with separately scoped viewer downstream, shared upstream and shared relay references. No report inserts another usage window, multiplies upstream bytes by viewers, or adds different accounting layers together.

The authority validates current source/device/configuration, original human permission, producer generation and viewer epoch. It binds viewer windows to the original viewer and producer, and shared references to that producer. Only existing, uncorrected application-payload windows with matching intervals/source, bounded rates and explicit bytes may establish delivery evidence. Missing coverage stays unknown/partial. A packet interval is not a person watching or a physical camera/first-frame measurement. Browser playback remains advisory.

Closing a viewer records the authority duration upper bound and whether any delivery intervals were reported. Playback duration and remote physical stop remain unobserved. Explicit end, revocation, source replacement and lazy expiry reconciliation retain their distinct reasons; local adapter lease expiry remains independent.

Still-image authority and its required audit transaction precede signed GET capability creation. Prepared, issued and failed issuance are separate stored states. Signing failure revokes the prepared grant and records a linked service failure. The final response is reauthorized through the existing current-directory boundary. Original actor/session/variant/expiry/operation and intent references cannot be rewritten or reinstated by ordinary SQL updates. Migration `0012-media-audit.sql` adds these guards without rewriting legacy grants. Permanent ledgers fail capacity explicitly; no public evidence deletion is added.

Required media audit sets synchronous commit and refuses fsync-off storage. In-memory schema tests opt into an explicitly named test realm with simulation mode; this option cannot bypass durability for a production realm or hardware-mode site. Schema test results are not WAL/power-loss evidence.

Future recording hooks cover start, stop, failure, playback, export and delete, but produce only disabled authorization descriptors under audit 1.0. Existing Gredice recording permissions remain disabled. Recording success/delivery requires the separately reviewed protocol, privacy, hardware and custody gates in the [recording policy](../software/recording-policy.md).
