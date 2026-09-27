# Optional passive winch desk-foot kit

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `winch-desk-feet`
- Unit: each
- Kind: component
- Lifecycle: active
- Disciplines: mechanical
- Traits: fabricated, printed

## Requirements

- One bench kit contains two short and two long feet for the passive 550 x 180 x 8 mm base, using its existing 50 x 120 mm post-hole pattern.
- 35 mm plate underside height; existing mounting fasteners may protrude at most 25 mm below the plate.
- Attach with four M8 x 35 bolts, eight standard M8 washers and four M8 nuts; these are separate from the printed parts.
- Unloaded desk assembly and rotation checks only; physical fit and stability are unverified.

## Notes

Optional bench fixture, excluded from installed-system assembly quantities and procurement totals. Print settings and installation: hardware/assemblies/winch/desk-feet.md. No structural or loaded-line qualification.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |

No assembly usage recorded.

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md) — not included by this build/inclusion policy.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/winch/winch-desk-foot-short.scad](../../../hardware/assemblies/winch/winch-desk-foot-short.scad) — module `wdf_print_foot`; revision 0.1.0.
- [hardware/assemblies/winch/winch-desk-foot-long.scad](../../../hardware/assemblies/winch/winch-desk-foot-long.scad) — module `wdf_print_foot`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
