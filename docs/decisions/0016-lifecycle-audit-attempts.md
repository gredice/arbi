# ADR-0016: Bounded command attempts and lifecycle evidence

- Status: Accepted when merged; proposed until then
- Date: 2026-10-11
- Work record: [#46](https://github.com/gredice/arbi/issues/46), parent [#12](https://github.com/gredice/arbi/issues/12)
- Evidence: [lifecycle audit](../evidence/lifecycle-audit.md)

## Decision

Keep command admission, authenticated nonterminal receipts and actual terminal evidence separate. Add a bounded, audit-authorized timeline over the existing job, immutable report and canonical audit stores. A successful request or a repeated poll remains cloud admission. Conflicting terminal reports remain visible and never replace the first terminal projection.

Successful human boundary checks remain individual facts. A retry of the same normalized command also produces an individual authorization event linked to the original intent, with no new logical command or dispatch. Admission retains the configuration, enrolled software revision and control lease; device outcome conversion preserves those bindings.

Denied and stale HTTP attempts use native PostgreSQL counters under the existing registry lock. Each site has at most 32 actor/session/class buckets and one mixed overflow bucket in a UTC minute. The first denial is a canonical immutable fact. Repeated counts persist across processes; on the next denial after a minute boundary, counts above one become immutable closed summaries before old counters are removed. A closed count includes its first event; readers must replace that count rather than add both. Counts saturate at one billion and explicitly report saturation. Mixed counts never credit the first actor with other actors' attempts. Request payloads, credentials and coordinates are not retained in the counters.

Optional audit metadata records lease, software revision, fixed recovery policy, and bounded denial summaries. Existing events remain valid. Producers and strict readers must deploy the matching schema together; the ordinary runtime remains unconfigured and physical updates remain disabled. This is an additive source revision of the isolated audit 1.0 implementation, not a promise that an older strict reader will accept new fields.

Commissioning commits include separate calibration changes whenever revision identity changes, using only sanitized revision/state summaries. Device-driven restart and reconciliation retain explicit policy identities. Update adapters can derive requested and terminal installation/rollback evidence from an already-admitted, coherently replayable journal; staging cannot establish installation. These conversion functions authenticate nothing and require trusted storage/source/clock bindings and durable audit composition at the owning update adapter.

## Limits

Open counts are durable mutable projections, not immutable closed events. The shared Gredice boundary preserves best-effort denial logging when storage fails; it denies access but cannot guarantee those attempts were persisted. Successful sensitive admission still requires durable evidence. They remain available through the protected attempts reader even if there is no later denial. The source implementation does not enable home, firmware activation, installed calibration or physical motion. Those adapters must preserve the same provenance distinctions as they become available.
