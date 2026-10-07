# Corner station OpenSCAD sources

System context: [Corner station assembly documentation](../../../docs/assemblies/corner-station/README.md).

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
