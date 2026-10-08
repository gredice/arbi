# Corner head round-timber metal saddle pair

> Generated from canonical BOM inputs by `pnpm bom:generate`. Do not edit this page by hand.

[BOM](../../README.md) · [All items](README.md) · [Canonical part catalog](../../catalog/parts.json)

- Part ID: `corner-head-round-saddles`
- Unit: each
- Kind: component
- Lifecycle: planned
- Disciplines: mechanical
- Traits: fabricated

## Requirements

- One front and one rear machined METAL saddle per round-pole station. Nominal 100/120/140 mm studies; measure taper/ovality. Material, contact, corrosion, tolerance and capacity require review. Do not print for structural use.

## Notes

Historical metal-head alternative; excluded from baseline and printed-head selection. Sources remain metal machining/fit envelopes. See docs/assemblies/corner-station/design-package.md#historical-metal-alternatives. No price or engineering qualification asserted.

## Used in

Quantities are per assembly definition, before build multipliers. Optional and deferred usages are shown even when excluded from a scenario. Procurement stock is not an installed physical owner.

| Assembly or purchasing bucket | Quantity | Inclusion | Usage note |
| --- | ---: | --- | --- |
| [Corner support set](../../../docs/assemblies/corner-station/README.md) | 4 each | optional | Historical round metal head only: four pairs (eight machined metal parts); omit for printed-head selection. |

[Canonical assembly quantities](../../assemblies/assemblies.json)

## BOM reports

- [ARBI V1 — Zagreb repository baseline](../arbi-v1-hr-zagreb.md) — not included by this build/inclusion policy.

## Fabrication

- Process: openscad
- Model status: concept-unvalidated
- [hardware/assemblies/corner-station/corner-head-front-saddle.scad](../../../hardware/assemblies/corner-station/corner-head-front-saddle.scad) — module `corner_head_front_saddle`; revision 0.1.0.
- [hardware/assemblies/corner-station/corner-head-rear-saddle.scad](../../../hardware/assemblies/corner-station/corner-head-rear-saddle.scad) — module `corner_head_rear_saddle`; revision 0.1.0.

Catalog lifecycle, procurement, and generated documentation do not establish physical validation. See the owning assembly for evidence and acceptance requirements.
