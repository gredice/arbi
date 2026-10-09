# Winch-line ownership source check

- Date: 2026-10-09
- Baseline: `a278d8c6c6dc03d37c37db27352043ee02bd40e4`
- Scope: ADR-0010 documentation, BOM and CAD registry ownership

The four `visualization` entrypoints for Dyneema, red/black AWG26 conductors and
the capsule slip ring moved from `hardware/assemblies/positioning-lines` to
`hardware/assemblies/winch`. Their source bytes and include depth are unchanged.
The registry changes only their assembly, entrypoint path and documentation.
Model IDs, geometry descriptions, dimensions, revisions, statuses, artifact
roles and release output names are unchanged; no costed fabrication identity
changed.

Before refreshing `bom/catalog/fabrication.json` provenance, the previous registry
checksum was checked against this baseline and all 114 recorded SCAD checksums
were checked against the current source. The four moved visualizations are not
fabrication-cost inputs; their bytes were separately compared with the baseline.
All matched. Only the registry metadata fingerprint was updated in the
fabrication evidence; source digests, volume records, STL checksums and capture provenance
were retained. No new volume calculation or physical measurement is claimed.

The winch set now directly owns the same 180 m Dyneema, 50 m of each conductor
and one slip ring previously owned by the positioning-line set. The build
includes support and winch definitions once each. BOM regressions verify
required quantities, single ownership, known goods totals and hierarchy
validation; public-site regressions verify root numbering, child lookup and
part ownership.

This is source and accounting evidence only. The line construction, terminations,
slip-ring integration and installed system remain concept-unvalidated.
