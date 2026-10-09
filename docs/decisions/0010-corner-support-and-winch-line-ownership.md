# ADR-0010: Group corner installations and assign lines to their winches

- Status: Accepted
- Date: 2026-10-09
- Supersedes: the root ownership list in [ADR-0001](0001-physical-assembly-taxonomy.md)

## Context

The separate positioning-line set treated rope, two conductors and a slip ring
as a standalone physical system. The slip ring is installed on the powered
winch, while each line is wound onto its own winch. The public system page had
no assembled geometry and obscured these physical relationships.

## Decision

The five physical root owners are the corner support set, camera pod, dock,
control cabinet and site installation. The existing `winch-set` is a child of
`corner-support-set`, covering three ordinary winches and one powered winch.
Winch detail pages remain available under the corner support system.

The winch set owns all four positioning lines. The powered variant additionally
owns its red/black hybrid-line conductors, slip ring, stationary/rotating leads,
mounting and strain relief. Corner supports own posts, guying, heads, pulleys,
keepers and mounting interfaces. The pod owns its attachment hardware and
electrical inlet; line-side terminations belong to the corresponding winch line.

The [positioning-line specification](../assemblies/positioning-lines/README.md)
remains shared engineering documentation for construction, inspection,
replacement and calibration. Its existing document URL is retained, but it is
not a physical BOM owner or a top-level system page. The former
`/systems/positioning-lines` URL redirects to the corner support system.

## BOM and compatibility

- Remove `positioning-line-set` from assembly and build definitions. Transfer
  its 180 m Dyneema, 50 m of each conductor and one slip ring to `winch-set`.
- Preserve part/model identities, geometry revisions, release output names,
  total required/purchased quantities, offer selections and procurement totals.
- Move the four approximate CAD visualizations to the winch source directory.
- `parentAssemblyId` expresses ownership only. Builds explicitly include both
  parent and child definitions once; the calculator does not recursively add
  child quantities. Goods allocations remain direct-owner amounts, so support
  and winch costs are shown separately and are never counted twice.
- Historical protocol/configuration fixtures using `positioning-lines` remain
  unchanged. This documentation/BOM decision does not migrate software contracts.

## Evidence boundary

This changes ownership and navigation, not cable routing, electrical architecture,
mechanical interfaces or control behavior. The hybrid line, slip-ring integration,
terminations and installed system remain unverified. CAD compilation and BOM
regression checks do not establish physical fit, load capacity or cycle life.
