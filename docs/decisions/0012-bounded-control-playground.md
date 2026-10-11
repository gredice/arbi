# ADR-0012: Bounded simulated control playground

- Status: Accepted when merged; proposed until then
- Date: 2026-10-11
- Work record: [#49](https://github.com/gredice/arbi/issues/49), parent [#5](https://github.com/gredice/arbi/issues/5)
- Prerequisites: [durable jobs](../software/command-jobs.md), [local manual authority](../software/manual-control.md), [dashboard shell](../software/dashboard-shell.md)
- Evidence: [control playground](../evidence/control-playground.md)

## Decision

The playground uses the existing durable jobs and exclusive control lease authority. A new protected `controls` read returns the current authenticated receiver snapshot, original receiver ingestion time, current operator/lease projection and at most 20 recent jobs. Reads do not acquire control or submit work. Cloud admission, signed device acknowledgement, execution and terminal result remain separate fields.

Only the explicitly configured isolated test issuer offers the browser control bridge. A separate private operator code selects a fixed server profile; engineering mode, form fields and engineer/viewer codes cannot grant manipulation. Delivery rechecks the original stored server session and current directory, including original expiry, revocation, membership and resource scope after process restart. This reconstruction uses the isolated issuer's private signing key and is not a production Gredice adapter.

Manual entry is explicit. Each pointer/key gesture submits one bounded position request, rather than a repeating stream. The UI never renews a lease automatically. Explicit re-entry retires an owned prior lease and acquires a higher fence because the local journal cannot reopen a timed-out fence. Focus loss, hiding, offline, expiry and teardown remove browser intent; an attempted remote stop is best effort. Neither a remote response nor a UI timer establishes a stopped physical state. The local simulator independently enforces command deadlines, monotonic manual deadman and configuration/state/interlock checks.

The independent browser-harness controller runs the existing native local job journal, orchestrator and bounded module adapters, and signs real HTTP snapshots/outcomes. It receives ephemeral device credentials over private IPC. It is absent from the deployed application. Its stopped/reference witnesses and plants are explicit synthetic inputs. The application supports neither physical motor endpoints nor automatic local recovery.

Lost acknowledgement can be resolved by an explicit retry of the identical in-memory request key/body. Refresh/reconnect read durable observations and never restore a gesture, retry, lease entry or capture request from browser storage. Hidden/offline observations are cleared; an expired or unavailable observation disables actions. Gimbal requests require reported Ready state and advertised support, followed by the local stationary gate. Maintenance has no command implementation.

## Limits

Positions, frames and bed/plant choices are bounded synthetic examples. Return to simulated home is a position request, not a physical reference or homing proof. Capture produces a virtual capture witness; no camera bytes or image storage are invented. Command limits (400 ms manual request; 750 ms independent deadman in the host fixture) are development parameters, not measured hardware timing. Live enablement still requires #50/#67 and installed-system evidence. Local journal recovery remains an explicit local operator operation.
