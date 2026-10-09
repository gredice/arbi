// micro-pan-tilt-servo — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Uses the existing payload booklet assumption of 20 × 8.5 × 18 mm; not a measured servo or horn.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "servo";
dimensions = [20, 8.5, 18];
arbi_catalog_visualization(shape, dimensions);
