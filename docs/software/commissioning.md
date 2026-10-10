# Authorized site commissioning

[Issue #40](https://github.com/gredice/arbi/issues/40) adds a **simulation-only local commissioning consumer** in the [edge app](../../apps/arbi-edge-controller/src/commissioning/coordinator.ts). It implements existing edge/local operator ownership from [ADR-0006](../decisions/0006-local-safety-authority-and-instrumentation.md), using [configuration 1.0](configuration.md), [Gredice capabilities](site-authorization.md), [audit 1.0](audit-events.md) and [local jobs](local-jobs.md). The [host record](../evidence/commissioning.md) names the tested synthetic revision. Hardware enrollment, actuation, physical calibration and installed readiness remain disabled.

## Records and coordinate references

The app-owned, closed `arbi.commissioning/1.0` record embeds an unchanged configuration 1.0: surveyed rectangular anchors, site/gimbal frame IDs, hardware/assembly/firmware revisions, signal ownership, workspace/operating limits, calibration/evidence and bed/plant mappings. It adds:

- Four winch axes: distinct registered drum/line component IDs, positive payout direction, effective single-layer radius and HOME payout in mm. Hardware/assembly revisions come from the embedded inventory.
- Camera component, site reference frame, optical-origin translation in mm and yaw/pitch offsets in degrees. This bounded framing model rejects nonzero roll; arbitrary moving extrinsics need a future model.
- Dock component/frame, HOME and PRE-DOCK positions, reduced approach speed and latch debounce. Positions must satisfy the calibrated workspace margin.
- Named optical-position/framing targets with an existing bed and optional matching plant. These are explicit commissioned mappings, not an inferred crop survey.

The full set has its own canonical SHA-256 digest. Configuration/calibration digests remain separate; supplement edits require a new configuration revision. Retained revisions are immutable. Field names encode units; unknown fields/units/versions, incorrect frame IDs, invalid component mappings and out-of-workspace values reject. HOME payout must agree with surveyed anchor-to-dock distance plus line offset within declared uncertainty.

`resolveTarget` subtracts optical-origin translation from requested optical position and subtracts yaw/pitch and gimbal zero offsets from framing angles. Optical/pod positions and corrected angles must satisfy accepted bounds. `resolveLineReference` calculates anchor distance plus offset and signed drum turns relative to HOME using circumference `2πr`. [Golden vectors](../../apps/arbi-edge-controller/src/commissioning/commissioning.test.ts) fix the site/bed/plant and payout conventions. These analytical helpers neither measure pose/tension nor issue motor steps.

## Human and local authority

[CommissioningServer](../../apps/arbi-edge-controller/src/commissioning/server.ts) uses `SiteRequestBoundary`: signed dedicated ARBI bearer credentials, current account/site membership, exact configured browser origins and `x-arbi-request: 1`. Writes require `configuration.write` (site engineer), reads `configuration.read`. Device credentials, viewer/operator roles, UI mode and body-supplied actors cannot grant authority. Boundary decisions are durably audited before mutations; unverified actors are never attributed as authenticated humans.

Every privileged operation also requires an independent **local** maintenance authorization bound to the authenticated human/session, site/realm, current edge boot/session and local authorization ID. Its maximum lifetime is 60 seconds, with current stopped, idle and inhibited interlocks. The request cannot supply it. Signed membership and local authorization are rechecked around each asynchronous device operation and before final commit. Revocation, expiry, clock regression and interlock loss block activation.

Enrollment names only an existing trusted adapter ID. Independent discovery supplies actual component/firmware and boot/session identity, site/realm, protocol/readers and reconciled installed hardware digest. Exactly one edge, Pico and pod must match the configuration. Enrollment changes invalidate readiness. This binds local commissioning inventory; it does not mint or replace separate [cloud enrollment credentials](device-enrollment.md).

## Activation and recovery

Trusted composition independently supplies reviewed **exact full-set digests**, accepted calibration digests, installed inventory, hard limits and forward/rollback readers. Requester-supplied evidence flags cannot populate approvals. The explicit isolated runner supplies the fictional fixture approval; hardware mode and physical evidence scopes reject.

Stage validates the record and current enrollment/compatibility, invokes inhibition and atomically records staged identity with audit intent/decision. Rejected candidates retain identity when structurally valid and a bounded reason. Incomplete activation must be recovered before replacing its staged set.

Activation validates every device transition before dispatch, durably records the activating inhibit, prepares the full exact set on **all** devices, then activates. Each independently persisted journal/report must match current module identity, transaction, configuration/calibration/hardware identities, full-set digest and inhibition. Each report/journal is durably recorded. Only after all current observations agree does the coordinator commit active identity and clear its reconciliation block. This is test-realm configuration readiness; other local job/safety prerequisites still apply.

Failures/timeouts, revocation, module restart, firmware/reader/inventory changes and revoked approval keep normal jobs blocked. Devices may temporarily have different applied versions while the **system remains inhibited**; no atomic distributed rollback is claimed. Local stops precede storage. Failures never select motion, HOME or a previous moving state.

Every coordinator startup inhibits and records restart reconciliation. Explicit recovery under current human/local authorization finishes the exact staged set or reconciles the exact active set. Independent device journals include commits whose response/coordinator record was lost, preserving original request, actor and transaction. A matching committed target is observed rather than reapplied. New module epochs require renewed enrollment; retained histories must agree. Incompatible inventory/readers/limits or missing approval prevent recovery. Recovery restores no jobs or leases; restoring metadata alone cannot clear a latched commissioning block. Changed hardware needs an independently reviewed compatible set/recalibration.

## Persistence and consumers

[CommissioningStore](../../apps/arbi-edge-controller/src/commissioning/store.ts) uses bounded SQLite DELETE journaling, FULL/fullfsync, a 100 ms writer timeout, immutable snapshots/audit rows, content verification and exclusive same-host PID/token ownership. State, actor/session, before/after identities, reason code and audit intent/outcome commit together. Defaults: 512 snapshots, 32 MiB logical records and 16,384 pages. Exhaustion blocks new work; automatic history deletion is unsupported. Budgets remain unqualified host starting points. Hashes/triggers do not protect against storage-owner tampering or dishonest storage firmware.

The durable outbox is authoritative. `flushAudit` appends unchanged events to `@arbi/audit` before recording copy acknowledgement; a crash between them deduplicates the append on retry. Historical boots retain attribution. Authorization records mean authorization only. The final local configuration outcome joins its immutable snapshot and independent device journals; it is not motion/physical validation evidence. Audit upload never advances readiness.

Trusted `EdgeRuntime.composeCommissioning(server)` mounts authenticated `GET /sites/<site>/commissioning/status` and `POST .../{enroll,stage,activate,invalidate,recover}` on the bounded loopback listener. POST includes a bounded `reason` ID; enroll adds `deviceId`, stage adds `set`, other fields reject. No default provider or configuration-file switch supplies authority. The coordinator must use the runtime's current identity. `/readyz` exposes the projection and requires its active digest to match the runtime's loaded applied configuration; changed diagnostic/runtime configuration needs explicit reload and reconciliation.

Composition automatically binds commissioning to `EdgeJobs`; an injected authority cannot omit its inhibit. [Job policy](../../apps/arbi-edge-controller/src/jobs/admission.ts) rechecks readiness/exact digest on admission and every phase; stop remains available without readiness. Existing independent diagnostic/job fixtures retain their explicitly preaccepted synthetic boundary.

The dashboard's trusted `readCommissioning(siteId, signal)` adapter supplies the closed `arbi.commissioning-status/1.0` projection. Protected engineering diagnostics with `configuration.read` show active/calibration, staged/rejected identities and blocking reason. Viewer/context reads omit it. Cross-site, malformed, secret-bearing and contradictory projections fail closed; absent composition shows unavailable. This seam returns no site coordinates/local grant and adds no remote write UI.

## Run and remaining gates

After building dependencies, run:

```sh
pnpm --filter @arbi/edge-controller simulate:commissioning --directory /tmp/arbi-isolated-commissioning
```

This explicit isolated recipe creates disposable signed human sessions and three independent simulation SQLite adapters. No signing keys/credentials are printed or persisted. Output includes `physicalActuationEnabled: false`. An existing directory retains history; restart requires deliberate recovery rather than blindly rerunning fresh activation.

Real pairing/transport, protected local presence inputs, credential provisioning, actual extrinsics, surveys and [physical stage gates](../operations/prototype-and-commissioning.md#local-safety-and-update-gates) remain unverified. SIGKILL tests establish process-crash recovery on the development filesystem, not cabinet power-loss durability or physical stopping.
