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

## Software evidence

- [Transport capability review and bounded local recovery experiment](evidence/software-transport-feasibility.md)
- [Protocol 1.0 contracts, semantic rules and host reference-test boundary](software/protocol.md)
- [Configuration 1.0, calibration identity and transactional apply/rollback reference boundary](software/configuration.md)
- [Authorized site commissioning, multi-device staging and deliberate recovery](software/commissioning.md), with [host evidence](evidence/commissioning.md)
- [Mobile data accounting 1.0 contracts, boundary rules and executable worked fixtures](software/mobile-data-accounting.md)
- [Device transfer instrumentation, durable raw counters and explicit Linux/router coverage](software/device-traffic-metering.md), with [host evidence](evidence/device-traffic-metering.md)
- [Durable usage ingestion, billing-period rollups and explicit accounting uncertainty](software/usage-rollups.md), with [host evidence](evidence/usage-rollups.md)
- [Edge transfer budgets, essential traffic bounds and verified artifact recovery](software/transfer-budgets.md), with [host evidence](evidence/transfer-budgets.md)
- [Cross-runtime reference vectors, independent host consumers and offline workspace checks](software/reference-fixtures.md)
- [Scenario 1.0 contracts, deterministic offline runner and independent host evidence](software/scenarios.md)
- [Bounded plant/module model 1.0, virtual sensors and independent host evidence](software/bounded-plant-model.md)
- [Gredice identity, site permissions and executable request authorization boundary](software/site-authorization.md)
- [Audit 1.0 vocabulary, privacy and evidence semantics](software/audit-events.md)
- [Deferred recording, playback, custody and retention activation policy](software/recording-policy.md)
- [Transactional audit admission, SQLite spool and deduplicated ingestion](software/audit-durability.md)
- [Release/update 1.0 manifests, mixed-version paths and pure recovery reference](software/release-updates.md)
- [Gated web builds, immutable Linux application releases and read-only dashboard catalog](software/software-publication.md)
- [Device enrollment, inventory and credential lifecycle with isolated PostgreSQL evidence](software/device-enrollment.md)
- [Image metadata, private Blob direct grants, lifecycle cleanup and isolated PostgreSQL/HTTP evidence](software/image-storage.md)
- [Durable cloud command jobs, exclusive manual leases and isolated PostgreSQL/HTTP evidence](software/command-jobs.md)
- [Current state, bounded telemetry/event history and configured assembly inventory](software/telemetry-history.md), with [host evidence](evidence/telemetry-history.md)
- [Outbound realtime routing, scoped Ably SDK tokens and commit-safe authoritative recovery](software/realtime-recovery.md), with [host evidence](evidence/realtime-recovery.md)
- [Authenticated user/engineering dashboard shell, explicit synthetic test provider and setup](software/dashboard-shell.md), with [dated source/hosted evidence](evidence/dashboard-shell.md)
- [Supervised edge runtime, local framing and diagnostic authority](software/edge-runtime.md), with [development-host evidence](evidence/edge-runtime-prototype.md)
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

## Documentation ownership

Cross-discipline item types are not separate subsystems. A fastener used on a winch belongs to the winch assembly; a cable from the cabinet to a corner has named endpoints and an owning interface. Shared standards may describe conventions, but the assembly documentation owns quantities, fit, routing, acceptance, and maintenance.

Design decisions belong in ADRs. Work items and unresolved questions belong in GitHub issues, with links back to the affected document. Procurement data belongs in the repository BOM rather than being copied into prose. Private notes, chats, external pages, spreadsheets, and dashboards are not project records.
