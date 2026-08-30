# ARBI engineering documentation

ARBI is an outdoor four-cable camera robot for repeatable images of raised beds. This documentation is organized by physical assembly so that each assembly owns its mechanics, electronics, cabling, fasteners, printed parts, software, tests, and maintenance information.

The committed material is a **design baseline**, not proof of a built or safe installation. Values described as targets or starting points remain unverified until an acceptance record is committed and linked from the relevant document. The repository and its GitHub records are the project's only authority; see the [repository source-of-truth policy](project/repository-source-of-truth.md).

## Start here

- [Goals and V1 scope](project/goals-and-v1-scope.md)
- [Current design status](project/design-status.md)
- [System architecture](system/architecture.md)
- [Site geometry](system/site-geometry.md)
- [Interfaces and operating states](system/interfaces-and-operating-states.md)
- [Safety case](system/safety-case.md)
- [Prototype and commissioning plan](operations/prototype-and-commissioning.md)
- [Repository source-of-truth policy](project/repository-source-of-truth.md)

## Physical assemblies

- [Site installation](assemblies/site-installation/README.md)
- [Corner station](assemblies/corner-station/README.md)
- [Winch](assemblies/winch/README.md)
- [Positioning lines](assemblies/positioning-lines/README.md)
- [Camera pod](assemblies/camera-pod/README.md)
- [Dock](assemblies/dock/README.md)
- [Control cabinet](assemblies/control-cabinet/README.md)

## Operations

- [Imaging and calibration](operations/imaging-and-calibration.md)
- [Weather, parking, and maintenance](operations/weather-parking-and-maintenance.md)
- [Prototype and commissioning](operations/prototype-and-commissioning.md)

## Decision records

- [ADR-0001: Organize engineering information by physical assembly](decisions/0001-physical-assembly-taxonomy.md)
- [ADR-0002: Treat OpenSCAD files as canonical model sources](decisions/0002-openscad-canonical-sources.md)
- [ADR-0003: Separate parts, assembly quantities, and supplier offers](decisions/0003-bom-separation.md)
- [ADR-0004: Share contracts between hardware control and simulation](decisions/0004-simulator-boundary.md)

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
