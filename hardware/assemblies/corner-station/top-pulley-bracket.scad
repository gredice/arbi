// top-pulley-bracket — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog 150 × 40 × 150 mm, 5 mm solid angle; starting drill pattern simplified.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "angle";
dimensions = [150, 40, 150, 5];
arbi_catalog_visualization(shape, dimensions);
