# Edge update preflight and recovery integration

[#76](https://github.com/gredice/arbi/issues/76) consumes the
[existing operation owner](update-operations.md) and
[native Linux file slots](linux-slot-reference.md). The optional
`EdgeUpdatePreflight` connects that owner to `LocalJobConsumer`, `ManualControl`
and an optional `CaptureWorkflow`. It is private, test-realm composition, with
physical installation disabled and no normal startup selection.

Attach its `check`/`prepare` methods as the update owner's `local` hooks, and its
`admissionInhibit` to both job and manual admission. Use the same site/device
scope and actual trusted local authority. The existing available inventory,
release-order compatibility, verified range cache, budget charges, intent/outcome
audit and original operation identity remain their owners' records.

Request checks persist specific block reasons before any artifact traffic.
Motion, active manual control, maintenance, ambiguous docking, unknown/stale
conditions, missing module reconciliation, mismatched configuration and
unavailable local storage block. All revision/epoch/freshness checks use current
local state. An independent target-specific update-safe procedure must pass the
existing evaluator; merely setting Parked, or claiming line clearance without
reviewed evidence, cannot authorize Pico installation.

Before downloading, the private durable lock inhibits new jobs/manual grants.
Local stopping happens before audit/storage/network draining. Retiring the
current manual fence also prevents an unused pre-update lease from becoming new
authority afterward. Preview stops and relinquishes discretionary budget slots.
An unfinished/quarantined frame or unknown media drain cannot pass readiness.
Draining has a configured 10–5000 ms deadline; a late completion cannot activate
the update. Current local conditions are checked again before its sole existing
installation reservation and before rollback. The lock spans Pico, pod and edge
sequencing, including source outages and pending health.

For an interrupted drain, inspect the preserved capture/job/update records and
use private `resumeDrain` with a review ID after current evidence passes. For
changed local epochs, `reviewLocalRecovery` requires fresh human reconciliation
of stopped state, references, dock release and current modules; it retains the
lock and installs nothing. An ambiguous reserved installation remains owned by
the existing target readback/recovery path and must never be resent.

Only `reconcile` may release the lock: it requires a terminal durable operation,
no worker, healthy signed current target readbacks, fresh local conditions and a
review ID. This does not reopen the capture workflow, clear job recovery, restore
a manual session, replay old commands or enable recording. New work needs the
existing owners' deliberate recovery and fresh authority.

Real Pi/cabinet-edge OS boot, Pico passive restraint and line clearance, physical
isolation, supply/storage power loss, installed watchdog timing and approved
hardware/HIL acceptance remain blocked/unverified. The declared isolated
procedure and successful host tests do not pass those field activation gates.
See [evidence](../evidence/edge-update-preflight.md) and
[ADR-0040](../decisions/0040-isolated-edge-update-preflight.md).
