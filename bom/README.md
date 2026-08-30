# Bill of materials

ARBI keeps engineering requirements, physical ownership, supplier identity, purchasable offers, destination-specific quotes, and calculation scenarios as separate versioned JSON inputs. This avoids treating a supplier row or a component type as a physical subsystem.

## Source of truth

The files under `bom/` are the sole canonical BOM records for the project. Parts, assembly quantities, offer selections, quote observations, and calculation policy change only through reviewed Git commits. There is no external database, synchronization job, or row-mapping authority.

Supplier websites and offer URLs are procurement evidence. Dated price, availability, tax, and shipping observations live in quote snapshots. Those references support the repository records but never override them.

## Canonical inputs

- `catalog/parts.json`: stable engineering part identities and requirements. Quantities do not live here.
- `assemblies/assemblies.json`: quantities owned by actual physical assemblies.
- `assemblies/builds.json`: build definitions and assembly instances.
- `catalog/suppliers.json`: stable supplier identities and uniquely owned checkout groups for each seller, warehouse, or basket boundary.
- `catalog/offers.json`: purchasable packages, bundles, URLs, qualification state, MOQ, package contents, and relevant notes.
- `locations/locations.json`: privacy-safe destination and tax context.
- `quotes/*.json`: immutable destination-specific price observations, currencies, exchange rates, timestamps, and checkout-group shipping evidence.
- `scenarios/scenarios.json`: pinned selection and reporting policy.
- `schemas/*.schema.json`: contributor-facing JSON Schema contracts.

Fasteners, cables, electronics, electrical parts, mechanical parts, optics, and printed or fabricated parts are disciplines or traits. They can appear inside every physical assembly; they are not top-level ownership categories.

## Physical ownership

The V1 build has seven canonical physical root owners: the corner-support set, four-winch set, positioning-line set, camera pod, dock, control cabinet, and site installation. Site installation owns installed power and signal routes plus the deferred weather-sensing endpoint rather than promoting cabling or weather into type-based top-level subsystems. A complex root may gain physical child assemblies through `parentAssemblyId`; parent links must stay within the physical hierarchy and cannot self-reference or form cycles.

`shared-procurement-stock` is an explicitly typed, non-physical purchasing exception. It represents assortments whose exact installed size-level allocation is not yet defensible. Reports keep this stock separate and never describe it as subsystem ownership.

OpenSCAD-backed parts link to canonical entries under `hardware/assemblies`. Fabrication status can advance through `planned`, `concept-unvalidated`, `prototype`, `validated`, `released`, and `deprecated`. Planned parts have no claimed manufacturing source; every later status requires at least one linked source. Reference-only geometry studies are not claimed as fabrication sources.

## Offer qualification

Offer qualification is explicit:

- `approved`: engineering compatibility and procurement assumptions have supporting evidence.
- `baseline-selected`: the repository's current pinned selection, not yet approved.
- `candidate`: an alternative awaiting review.
- `unresolved`: a placeholder or materially incomplete offer.

A supplier link, order, or receipt alone is not engineering approval. Add alternate suppliers as new offers so price, packaging, and location comparisons remain reviewable in Git.

## Pricing and shipping

Quantities and money are decimal strings. The calculator uses BigInt-backed exact decimal arithmetic and never totals money with binary floating point.

An offer purchase unit can contain one part, a spool or box quantity, or several component types. This models a kit without assigning the purchasing bundle to the wrong physical assembly. Package rounding exposes purchased quantity and surplus, including:

- 180 m Dyneema from 50 m spools: 200 m purchased, 20 m surplus.
- 85 m Cat5e from a 100 m reel: 100 m purchased, 15 m surplus.
- 16 washers from a 100-piece box: 84 surplus.
- two servos from a three-pack: one surplus.
- five required microswitches from a ten-pack: five surplus.

Shipping belongs to a checkout group and is charged once. A supplier can own multiple checkout groups when seller, basket, or warehouse boundaries create separate charges; each offer selects exactly one group. Null shipping means unknown, never free. Different currencies are converted only through explicit rates committed in the quote snapshot.

`capturedAt` records when a quote snapshot was assembled. It does not claim that every price, availability state, or shipping charge was observed at that instant. Individual rows use `observedAt: null` until a defensible observation time is known, and the calculator reports the missing evidence as a completeness warning.

In-house fabrication offers keep a null goods price until material, energy, machine time, labour, scrap, and safety costs are evidenced. `not-applicable` shipping means only that there is no external shipment; it must never be interpreted as zero fabrication cost.

## Reports

`generated/arbi-v1-hr-zagreb.json` is the deterministic machine-readable result. `generated/arbi-v1-hr-zagreb.md` is the GitHub-readable report.

The current report is intentionally incomplete. It exposes a known partial subtotal but leaves the complete landed total unavailable while package rules, prices, tax treatment, shipping, availability, and qualification remain unresolved. The partial subtotal must not be presented as the project cost.

Shared bundle and checkout shipping values remain separate from physical-assembly goods unless evidence-backed allocation weights exist.

The file calculator supports deterministic pinned selection and honest incomplete reporting. Cheapest-compliant selection, quote-staleness optimization, lead-time planning, and interactive destination comparison are future website capabilities, not current CLI claims.

## Commands

Run from the repository root:

```bash
pnpm --filter @arbi/bom build
pnpm --filter @arbi/bom lint
pnpm --filter @arbi/bom typecheck
pnpm --filter @arbi/bom test
pnpm --filter @arbi/bom generate
pnpm --filter @arbi/bom check
```

`generate` validates every canonical input against the committed JSON Schemas, applies cross-file engineering validation, and writes tracked `<scenario-id>.json` and `<scenario-id>.md` reports for every scenario. `check` performs the same validation, calculates every expected report without modifying files, and fails when a tracked artifact is missing or stale. Pass a scenario ID after either command to operate on one scenario explicitly.

## Contribution workflow

1. Change canonical inputs, never generated reports.
2. Preserve stable IDs; change display names without renaming IDs.
3. Add alternative suppliers as new offers rather than overwriting existing observations.
4. Record package contents, minimum, increment, observed price, currency, destination, tax treatment, checkout group, and observation date. Use null for unknown.
5. Reserve `approved` for an evidence-backed engineering qualification.
6. Add complex physical subassemblies under one of the seven roots with `parentAssemblyId`; keep `shared-procurement-stock` outside the physical hierarchy.
7. Run package tests and `generate`, then commit both canonical inputs and generated changes.
8. Treat calculation, OpenSCAD compilation, procurement, installation, and physical safety validation as separate evidence.
