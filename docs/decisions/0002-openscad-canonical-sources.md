# ADR-0002: Treat OpenSCAD files as canonical model sources

- Status: Accepted
- Date: 2026-08-30

## Context

ARBI expects many custom printed parts and requires their complete history in Git. Binary mesh exports do not preserve parameters, design intent, or reviewable changes. The project also needs reproducible models that can later appear in an interactive website and merge into the Gredice monorepo.

## Decision

Version-controlled `.scad` files are the canonical source for custom three-dimensional models.

- Each registered model has a stable model ID and explicit revision/compatibility metadata. Fabrication artifacts link to stable BOM part IDs; non-manufacturing reference envelopes are labeled and do not masquerade as parts.
- Assembly-owned model sources live with the relevant hardware assembly; reusable geometry lives in a small shared OpenSCAD library.
- Dimensions and interfaces are parameterized with units and safe input ranges.
- Print/manufacturing metadata records material, orientation, layer height, infill, supports, tolerances, inserts/fasteners, expected mass, and post-processing.
- CI compiles models and performs available syntax/render/envelope checks.
- STL/3MF previews and other meshes are derived outputs. They may be generated in CI or attached to tagged releases, but are never the only design source.
- A released build identifies the exact OpenSCAD and library revisions used for every printed part.
- Off-the-shelf components may use simplified envelopes when licensing and effort make full geometry inappropriate; simplified models must not imply supplier-certified dimensions.

## Consequences

- Text source and parameter changes are reviewable in pull requests.
- Contributors can reproduce and customize parts without reverse-engineering meshes.
- Generated outputs require a deterministic toolchain and documented OpenSCAD version.
- Visual equality is not sufficient; load-bearing printed parts still need material, creep, fatigue, environmental, and interface evidence.
- Model/library changes may affect multiple assemblies and therefore need compatibility tests.

## Alternatives considered

### Commit only STL or 3MF files

Rejected because exported meshes are hard to review, parameterize, or merge and do not preserve design intent.

### Use an unversioned cloud CAD workspace

Rejected as the canonical source because it would make repository history incomplete and external contribution harder.

### Permit any CAD source without a canonical format

Deferred for exceptional parts. V1 uses OpenSCAD consistently; a future exception requires an ADR that preserves open, versioned, reproducible source.

## References

- [Goals and V1 scope](../project/goals-and-v1-scope.md)
- [Camera pod](../assemblies/camera-pod/README.md)
- [Winch](../assemblies/winch/README.md)
- [Dock](../assemblies/dock/README.md)
