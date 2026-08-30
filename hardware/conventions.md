# OpenSCAD conventions

## Source of truth

- `.scad` files are canonical custom-part geometry.
- `hardware/models.json` is the release-entrypoint and design-revision registry.
- `hardware/models.schema.json` is the machine-validated registry contract; the registry pins the exact supported OpenSCAD version.
- Exported meshes are derived artifacts. Publish them from tagged source through CI or a GitHub release.
- A BOM or assembly revision that depends on fit must name the compatible model revision.

## Units and coordinates

- All dimensions are millimetres.
- Use a right-handed coordinate system.
- Model a printable part in its intended default export orientation when practical.
- State any assembly coordinate frame, datum, mating surface, axis, and required transformation in the owning README.
- Use descriptive parameter names with a unit suffix when the unit is not obvious.

## Parametric design

- Expose dimensions that govern interfaces, tolerances, material thickness, fastener clearance, or printer adaptation.
- Validate parameters with `assert()` so impossible combinations fail visibly.
- Reuse modules from `hardware/lib/arbi.scad` before copying geometry.
- Pass facet counts explicitly for curved release geometry; do not rely on a developer's global `$fn`.
- Use a small named epsilon for subtractive geometry rather than unexplained offsets.
- Avoid absolute include paths, environment-specific fonts, or external assets that are not committed.

## Revisions and status

Model revisions use semantic `major.minor.patch` form:

- patch: source correction with no intended physical-interface change;
- minor: backwards-compatible parameter or geometry addition;
- major: mating, fit, envelope, assembly, or other physical compatibility break.

Initial models use `concept-unvalidated`. Change status only with linked evidence:

- `prototype`: a specific revision has been fabricated and inspected;
- `validated`: defined acceptance checks passed under recorded conditions;
- `released`: approved for a named repository release/build configuration;
- `deprecated`: retained for reproducibility but not recommended for new builds.

Git history records development. The explicit model revision identifies a physical interface that builds and BOMs can reference.

## Tolerances and safety

- Do not bury printer clearances, press fits, bearing fits, or fastener clearances in decorative constants.
- Record material, print process, layer direction, infill/perimeters, inserts, fastener torque, and environmental assumptions in validation records rather than implying they follow from geometry.
- Printed parts that carry tension, retain a moving line, support overhead equipment, isolate conductors, or participate in docking require physical and safety review.
- OpenSCAD compilation, a visually plausible render, and a successful print do not prove load capacity, fatigue life, insulation, UV resistance, weather resistance, or safe operation.
