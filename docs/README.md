# ARBI engineering documentation

ARBI is an outdoor four-cable camera robot for repeatable images of raised beds. This documentation is organized by physical assembly so that each assembly owns its mechanics, electronics, cabling, fasteners, printed parts, software, tests, and maintenance information.

The committed material is a **design baseline**, not proof of a built or safe installation. Values described as targets or starting points remain unverified until an acceptance record is committed and linked from the relevant document. The repository and its GitHub records are the project's only authority; see the [repository source-of-truth policy](project/repository-source-of-truth.md).

## Start here

- [Goals and V1 scope](project/goals-and-v1-scope.md)
- [Current design status](project/design-status.md)
- [Industrial design conventions](project/industrial-design.md)
- [Official logo and brand guide](project/brand-identity.md)
- [System architecture](system/architecture.md)
- [Site geometry](system/site-geometry.md)
- [Interfaces and operating states](system/interfaces-and-operating-states.md)
- [Safety case](system/safety-case.md)
- [Local safety interface matrix](system/local-safety-interface-matrix.md)
- [Prototype and commissioning plan](operations/prototype-and-commissioning.md)
- [Repository source-of-truth policy](project/repository-source-of-truth.md)

## Physical assemblies

- [Site installation](assemblies/site-installation/README.md)
- [Corner support set](assemblies/corner-station/README.md), including the [winch set](assemblies/winch/README.md) and its ordinary/powered positioning lines
- [Camera pod](assemblies/camera-pod/README.md)
- [Dock](assemblies/dock/README.md), with a proposed [compact-pod interface package](assemblies/dock/design-package.md),
  [bench plan](assemblies/dock/bench-test-plan.md) and [blank acceptance record](assemblies/dock/acceptance-record.md)
- [Control cabinet](assemblies/control-cabinet/README.md)

## Shared assembly specifications

- [Positioning-line specification](assemblies/positioning-lines/README.md): construction, terminations, inspection and replacement of winch-owned lines

## Components and procurement

- [Bill of materials](../bom/README.md)
- [Individual BOM item pages](../bom/generated/parts/README.md)

## Operations

- [Imaging and calibration](operations/imaging-and-calibration.md)
- [Weather, parking, and maintenance](operations/weather-parking-and-maintenance.md)
- [Prototype and commissioning](operations/prototype-and-commissioning.md)

## Decision records

- [ADR-0001: Organize engineering information by physical assembly](decisions/0001-physical-assembly-taxonomy.md)
- [ADR-0002: Treat OpenSCAD files as canonical model sources](decisions/0002-openscad-canonical-sources.md)
- [ADR-0003: Separate parts, assembly quantities, and supplier offers](decisions/0003-bom-separation.md)
- [ADR-0004: Share contracts between hardware control and simulation](decisions/0004-simulator-boundary.md)
- [ADR-0005: Software architecture and deployment boundaries](decisions/0005-software-architecture-and-deployment.md)
- [ADR-0006: Local safety authority and instrumentation](decisions/0006-local-safety-authority-and-instrumentation.md)
- [ADR-0007: Integrated product design](decisions/0007-integrated-product-design.md)
- [ADR-0008: Edge host and bounded local transport](decisions/0008-edge-host-and-local-transport.md)
- [ADR-0009: Compact integrated camera pod packaging](decisions/0009-compact-integrated-camera-pod.md)
- [ADR-0010: Corner support and winch-line ownership](decisions/0010-corner-support-and-winch-line-ownership.md)

## Received hardware evidence

- [Fixed-5 V converter: receipt, photographs, measured envelope and mounting pattern](evidence/buck-converter-2026-10-12.md)

## Software evidence

- [Transport capability review and bounded local recovery experiment](evidence/software-transport-feasibility.md)
- [Protocol 1.0 contracts, semantic rules and host reference-test boundary](software/protocol.md)
- [Configuration 1.0, calibration identity and transactional apply/rollback reference boundary](software/configuration.md)
- [Authorized site commissioning, multi-device staging and deliberate recovery](software/commissioning.md), with [host evidence](evidence/commissioning.md)
- [Mobile data accounting 1.0 contracts, boundary rules and executable worked fixtures](software/mobile-data-accounting.md)
- [Device transfer instrumentation, durable raw counters and explicit Linux/router coverage](software/device-traffic-metering.md), with [host evidence](evidence/device-traffic-metering.md)
- [Durable usage ingestion, billing-period rollups and explicit accounting uncertainty](software/usage-rollups.md), with [host evidence](evidence/usage-rollups.md)
- [Bounded simulated control playground](software/control-playground.md), with [native/browser evidence](evidence/control-playground.md) and [ADR-0012](decisions/0012-bounded-control-playground.md)
- [Isolated web–cloud–edge protocol integration](software/protocol-integration.md), with [host/browser fault evidence](evidence/protocol-integration.md) and [ADR-0013](decisions/0013-isolated-protocol-integration.md)
- [Bounded live-session authority and isolated signaling](software/live-sessions.md), with [native evidence](evidence/live-sessions.md) and [ADR-0014](decisions/0014-live-session-authority.md)
- [Owned media access, delivery references and visibility limits](software/media-access-audit.md), with [software evidence](evidence/media-audit.md) and [ADR-0015](decisions/0015-media-audit-visibility.md)
- [Cloud health, least privilege and isolated recovery quarantine](software/cloud-operations.md), with [native restore evidence](evidence/cloud-operations.md) and [ADR-0011](decisions/0011-cloud-recovery-quarantine.md)
- [Usage, billing policy and correlated audit dashboard](software/usage-audit-dashboard.md), with [native/browser evidence](evidence/usage-audit-dashboard.md)
- [Configurable usage reports, forecast assumptions and durable budget alerts](software/usage-settings-alerts.md), with [host evidence](evidence/usage-settings-alerts.md)
- [Edge transfer budgets, essential traffic bounds and verified artifact recovery](software/transfer-budgets.md), with [host evidence](evidence/transfer-budgets.md)
- [Cross-runtime reference vectors, independent host consumers and offline workspace checks](software/reference-fixtures.md)
- [Scenario 1.0 contracts, deterministic offline runner and independent host evidence](software/scenarios.md)
- [Bounded plant/module model 1.0, virtual sensors and independent host evidence](software/bounded-plant-model.md)
- [Gredice identity, site permissions and executable request authorization boundary](software/site-authorization.md)
- [Audit 1.0 vocabulary, privacy and evidence semantics](software/audit-events.md)
- [Deferred recording, playback, custody and retention activation policy](software/recording-policy.md)
- [Transactional audit admission, SQLite spool and deduplicated ingestion](software/audit-durability.md)
- [Authorized audit search, bounded export and explicit privileged retention](software/audit-query-retention.md), with [host evidence](evidence/audit-query-retention.md)
- [Release/update 1.0 manifests, mixed-version paths and pure recovery reference](software/release-updates.md)
- [Gated web builds, immutable Linux application releases and read-only dashboard catalog](software/software-publication.md)
- [Device enrollment, inventory and credential lifecycle with isolated PostgreSQL evidence](software/device-enrollment.md)
- [Image metadata, private Blob direct grants, lifecycle cleanup and isolated PostgreSQL/HTTP evidence](software/image-storage.md)
- [Durable cloud command jobs, exclusive manual leases and isolated PostgreSQL/HTTP evidence](software/command-jobs.md)
- [Complete assembly inventory, selected diagnostics and redacted bounded export](software/assembly-diagnostics.md), with [host/browser evidence](evidence/assembly-diagnostics.md)
- [Current state, bounded telemetry/event history and configured assembly inventory](software/telemetry-history.md), with [host evidence](evidence/telemetry-history.md)
- [Outbound realtime routing, scoped Ably SDK tokens and commit-safe authoritative recovery](software/realtime-recovery.md), with [host evidence](evidence/realtime-recovery.md)
- [Authenticated user/engineering dashboard shell, explicit synthetic test provider and setup](software/dashboard-shell.md), with [dated source/hosted evidence](evidence/dashboard-shell.md)
- [Supervised edge runtime, local framing and diagnostic authority](software/edge-runtime.md), with [development-host evidence](evidence/edge-runtime-prototype.md)
- [Bounded edge diagnostic retention, export and prioritized reconnect replay](software/edge-diagnostics.md), with [host/native database evidence](evidence/edge-diagnostics.md)
- [Local manual-control fences and independent deadman](software/manual-control.md), with [host/simulation evidence](evidence/manual-control.md)

## Evidence language

These labels are used throughout the documentation:

- **Requirement** — behavior or constraint the design must satisfy.
- **Baseline** — the current V1 design choice recorded in the repository.
- **Target** — a value the design aims to achieve but has not yet demonstrated.
- **Starting point** — an initial test value that must be tuned from measured results.
- **Unverified** — a claim or selection that still needs analysis, inspection, or testing.
- **Deferred** — intentionally outside the first prototype or V1 baseline.
- **Validated** — supported by a named test record, calculation, or inspection result committed to the repository.

Do not change a claim to **Validated** in prose alone. Link the evidence and record the tested revision, configuration, conditions, equipment, result, and reviewer.

Design and procurement issues use two [BOM warning priorities](../bom/README.md#warning-priorities): **Critical** for temporary workarounds or missing information, and **Warning** for concepts or selections awaiting confirmation. Cable ties are temporary workarounds only and must produce a critical warning on every affected part; the final assembly needs a dedicated fastening or retention solution.

## Documentation ownership

Cross-discipline item types are not separate subsystems. A fastener used on a winch belongs to the winch assembly; a cable from the cabinet to a corner has named endpoints and an owning interface. Shared standards may describe conventions, but the assembly documentation owns quantities, fit, routing, acceptance, and maintenance.

Design decisions belong in ADRs. Work items and unresolved questions belong in GitHub issues, with links back to the affected document. Procurement data belongs in the repository BOM rather than being copied into prose. Private notes, chats, external pages, spreadsheets, and dashboards are not project records.

- [Lifecycle audit and bounded attempts](software/lifecycle-audit.md) — [software evidence](evidence/lifecycle-audit.md).

- [Read-only incident replay](software/incident-replay.md) — [software evidence and physical gate](evidence/incident-replay.md).

- [Audit completeness coverage](software/audit-completeness.md), [redacted software evidence](evidence/audit-completeness.md), and [ADR-0018](decisions/0018-audit-coverage-and-source-sequences.md)

- [Signing trust and migration recovery](software/update-trust-migrations.md), [isolated software evidence](evidence/update-trust-migrations.md), and [ADR-0019](decisions/0019-isolated-trust-and-migration-recovery.md)

- [Isolated update operation API](software/update-operations.md), [software evidence](evidence/update-operations.md), and [ADR-0020](decisions/0020-isolated-update-orchestration.md)

- [Device release and update dashboard](software/update-dashboard.md), [browser/software evidence](evidence/update-dashboard.md), and [ADR-0021](decisions/0021-isolated-update-dashboard.md)

- [Seeded service fault workflows](software/fault-workflows.md), [software evidence](evidence/fault-workflows.md), and [ADR-0022](decisions/0022-seeded-service-fault-workflows.md)

- [Pico 2 W diagnostic firmware](software/pico-foundation.md), [source and hardware evidence boundaries](evidence/pico-foundation.md), and [ADR-0023](decisions/0023-pico-diagnostic-foundation.md)

- [Synchronized PIO pulse scheduler](software/pulse-scheduler.md), [source versus physical timing evidence](evidence/pulse-scheduler.md), and [ADR-0024](decisions/0024-isolated-synchronized-pulse-engine.md)

- [Revision-bound motion geometry](software/motion-geometry.md), [cross-language source evidence](evidence/motion-geometry.md), and [ADR-0025](decisions/0025-revision-bound-motion-model.md)

- [Inhibited pod service runtime](software/pod-runtime.md), [native source versus Pi bench evidence](evidence/pod-runtime.md), and [ADR-0026](decisions/0026-inhibited-pod-service.md)
- [Calibrated gimbal and motion/settling interlocks](software/gimbal-model.md), [source checks and physical gates](evidence/gimbal-model.md), and [ADR-0032](decisions/0032-simulation-only-calibrated-gimbal.md)
- [Traceable autofocus/still capture source sequence](software/capture-sequencing.md), [native source versus camera bench evidence](evidence/capture-sequencing.md), and [ADR-0033](decisions/0033-traceable-synthetic-capture-sequencing.md)
- [Calibrated image-processing source adapter](software/image-processing.md), [fixture/host versus physical evidence](evidence/image-processing.md), and [ADR-0034](decisions/0034-bounded-synthetic-image-rectification.md)
- [Native capture custody and recovery](software/capture-transfer.md), [source versus power/wireless evidence](evidence/capture-transfer.md), and [ADR-0035](decisions/0035-native-capture-custody-and-recovery.md)
- [Capture job and offline media composition](software/capture-orchestration.md), [native simulation evidence](evidence/capture-orchestration.md), and [ADR-0036](decisions/0036-isolated-capture-job-and-media-composition.md)

- [Input and bounded homing model](software/input-homing-model.md), [real interface review requirements](system/input-enable-interface-requirements.md), [source versus wiring/rig evidence](evidence/input-homing-model.md), and [ADR-0027](decisions/0027-unavailable-real-inputs-and-homing-model.md)

- [Local controller expiry, fault latching and deliberate recovery](software/local-controller-recovery.md), [source versus physical response evidence](evidence/local-controller-recovery.md), and [ADR-0028](decisions/0028-simulation-only-local-controller-recovery.md)

- [Bounded MCU model diagnostics and command outcomes](software/mcu-model-diagnostics.md), [source versus measured timing evidence](evidence/mcu-model-diagnostics.md), and [ADR-0029](decisions/0029-bounded-mcu-model-diagnostics.md)

- [Isolated signed Pico flash and trial recovery model](software/pico-flash-model.md), [native source versus device/recovery evidence](evidence/pico-flash-model.md), and [ADR-0030](decisions/0030-isolated-signed-pico-flash-recovery-model.md)
- [Controller-specific update interlocks and service inventory](software/controller-update-model.md), [source and bench acceptance matrix](evidence/controller-update-model.md), and [ADR-0031](decisions/0031-controller-update-owner-interlocks.md)

- [Local WebRTC candidate experiment](software/live-transport-reference.md), [measured host evidence and outstanding transport gates](evidence/live-transport-reference.md), and [ADR-0038](decisions/0038-local-webrtc-candidate-evidence.md)

- [Protected capture history, explicit media access and versioned framing review](software/capture-dashboard.md), [native/API/browser evidence](evidence/capture-dashboard.md), and [ADR-0037](decisions/0037-protected-capture-history-and-framing-review.md)

- [Isolated native Linux slot reference](software/linux-slot-reference.md), [source/file/process recovery evidence](evidence/linux-slot-reference.md), and [ADR-0039](decisions/0039-isolated-native-linux-slots.md)

- [Edge update preflight and recovery integration](software/edge-update-preflight.md), [host versus hardware evidence](evidence/edge-update-preflight.md), and [ADR-0040](decisions/0040-isolated-edge-update-preflight.md)
