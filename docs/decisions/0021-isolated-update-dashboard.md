# ADR-0021: Explicit update dashboard and independent web identity

Status: accepted when the issue PR merges. Work record: [#75](https://github.com/gredice/arbi/issues/75).

The release screen reads published artifacts independently of the edge's signed compatible release selection and observed installed slots. An unavailable public publisher cannot hide update history. Each manifest exposes target, board, hardware revision, channel, version, commit, digest, signature and size. Missing release notes remain unavailable. Inventory preserves the accepted hardware capability model: drivers, servos and passive components have no managed update target.

The user selects an ordered prefix of remaining compatible targets and explicit metered consent after reading size, allowance and policy coverage. Request, advance/recovery, cancellation and audited override are explicit actions. Refresh and reconnect read the original durable operation. A nonsecret request key and operation ID in the URL permit recovery after a lost response; no protected result or credential enters browser persistence. Current server authorization, actor ownership, transfer policy and target-specific local preflight remain authoritative. The UI cannot authorize a reboot or equate Parked/docked with safe retention.

The web build embeds its own Git revision, dirty-tree status, build timestamp, environment and provenance. This describes the compiled web application independently of device release manifests. Unknown build identity remains unknown. Reading published artifacts never creates desired device state, and staged bytes never establish installed health.

A private test harness runs Chromium, the built Next.js BFF, actual Gredice authorization backed by native PostgreSQL, and the existing edge update API with real HTTP Range downloads and persistent SQLite synthetic target slots. Its separate updater profile is active only for the synthetic update site. A constructor-bound loopback proxy forwards the actual user bearer and a private hop credential, strips ambient cookies and bounds responses. It cannot select an external URL or production realm. The ordinary app and Vercel branch previews have no fixture gateway. Private fault controls exist only in the harness-owned local file, with no public endpoint.

Hidden/offline/expired pages abort work and clear protected data. Reading after reconnect requires current authorization; it never replays update commands. The prototype's physical installation flag remains false. Published live artifacts, production deployment, real target flashing, installed job/update locks and qualified physical acceptance retain their separate gates.

See [dashboard behavior](../software/update-dashboard.md), [software evidence](../evidence/update-dashboard.md) and the existing [operation authority](0020-isolated-update-orchestration.md).
