# Corner station OpenSCAD sources

System context: [Corner station assembly documentation](../../../docs/assemblies/corner-station/README.md).

## Through-bolted corner head package

The [design package](../../../docs/assemblies/corner-station/design-package.md)
adds a proposed 200 mm angle arrangement aligned with the round-pole winch,
metal saddle fit solids, removable white weather shields, a shared marking aid,
actual-mesh instructions and explicit acceptance inputs. All seven registered
entrypoints are r0.1.0, `concept-unvalidated`. The 150 mm square arrangement is
a separately labelled historical study, not a combined build kit.

| Model | Purpose |
| --- | --- |
| [corner-head-hood](corner-head-hood.scad) | Non-structural front weather shield, open below |
| [corner-head-roof](corner-head-roof.scad) | Separate lift-off angle roof with independent retention strap |
| [corner-head-rear-cover](corner-head-rear-cover.scad) | Non-structural rear nut shield |
| [corner-head-front-saddle](corner-head-front-saddle.scad) | Machined **metal** round-post front seating envelope |
| [corner-head-rear-saddle](corner-head-rear-saddle.scad) | Machined **metal** full-width rear seating envelope |
| [corner-head-marking-template](corner-head-marking-template.scad) | Shared centre marking aid; remove before powered drilling |
| [corner-head-assembly](corner-head-assembly.scad) | Installed/exploded purchased-hardware layout reference |

Parameters live in [corner-head.scad](../../lib/corner-head.scad). Match
`post_shape`, `post_size_mm`, `bracket_leg_mm` and `line_diameter_mm` across all
exports. Default is round/120/200/1.5; the 4.5 mm powered assumption uses a
different terminal position. Use `bracket_leg_mm=150`, `post_shape="square"`,
`post_size_mm=100` only for the historical square study.

[Build instructions](../../../scripts/corner-support/README.md) produce the PDF,
GLB, mesh figures, source/STL ZIP and nominal hash report. The bought block and
connector are explicitly provisional envelopes; received pin/tang dimensions
must be measured. Neither white shield is a fitted line keeper. Do not print
the saddles as structural parts. See [nominal checks](../../../docs/assemblies/corner-station/geometry-check.md)
and [physical acceptance](../../../docs/assemblies/corner-station/acceptance-record.md).

## Round-pole pulley mount concept

The [split-clamp proposal and dimensions](pole-pulley-mount.md) define an adjustable
round-pole mount with two removable collar halves and a gusseted pulley clevis.
This is a new alternative concept; the through-bolted steel bracket remains the
V1 baseline. The three registered models are revision `0.1.0`,
`concept-unvalidated`:

| Model | Purpose |
| --- | --- |
| [pole-pulley-mount-front](pole-pulley-mount-front.scad) | Front half with two integral gusseted arms; fit/mock-up solid |
| [pole-pulley-mount-rear](pole-pulley-mount-rear.scad) | Removable rear half; fit/mock-up solid |
| [pole-pulley-mount-assembly](pole-pulley-mount-assembly.scad) | Assembly with nominal hardware, pole and generic marine-block envelope |

The common [parametric source](../../lib/pole-pulley-mount.scad) starts at a
120 mm pole and 30 mm sheave. A planned BOM concept pair traces the two custom
parts without adding them to baseline build quantities. The existing keeper
below is a separate concept and has not been fitted to this mount.

## `top-pulley-keeper`

[top-pulley-keeper.scad](top-pulley-keeper.scad) is a two-cheek upper guard concept intended to reduce the chance that an unloaded or transiently moving line leaves the pulley groove. Its default geometry includes two upper semicircular keeper cheeks, mounting legs, fastener holes, and three cross-bridges.

Registry ID and design revision: `top-pulley-keeper` `0.1.0`, status `concept-unvalidated`.

The model does not define the pulley, groove profile, axle, bearing, bracket, line diameter, actual retention gap, installation sequence, fastener locking, UV/weather material, impact response, or inspection limit. A keeper must not become a rubbing surface in normal operation or conceal a derailed/damaged line.

Before prototype use, derive the parameters from the selected pulley and complete corner-station bracket. Verify all line approach angles and tension states, service access, clearance under deflection, wear visibility, keeper strength, fastener retention, and safe failure behavior.

## Appearance

The structural capture/retention parts preview in charcoal following the [industrial design conventions](../../../docs/project/industrial-design.md). Their dimensions and physical design revisions are unchanged. Future protective housings use the rounded white-shell convention while keeping these interfaces visible and accessible.
