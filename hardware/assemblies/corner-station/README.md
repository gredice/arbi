# Corner station OpenSCAD sources

System context: [Corner station assembly documentation](../../../docs/assemblies/corner-station/README.md).

## `top-pulley-keeper`

[top-pulley-keeper.scad](top-pulley-keeper.scad) is a two-cheek upper guard concept intended to reduce the chance that an unloaded or transiently moving line leaves the pulley groove. Its default geometry includes two upper semicircular keeper cheeks, mounting legs, fastener holes, and three cross-bridges.

Registry ID and design revision: `top-pulley-keeper` `0.1.0`, status `concept-unvalidated`.

The model does not define the pulley, groove profile, axle, bearing, bracket, line diameter, actual retention gap, installation sequence, fastener locking, UV/weather material, impact response, or inspection limit. A keeper must not become a rubbing surface in normal operation or conceal a derailed/damaged line.

Before prototype use, derive the parameters from the selected pulley and complete corner-station bracket. Verify all line approach angles and tension states, service access, clearance under deflection, wear visibility, keeper strength, fastener retention, and safe failure behavior.
