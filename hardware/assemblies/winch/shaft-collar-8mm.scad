// shaft-collar-8mm — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Existing winch booklet nominal Ø20 × 10 mm body, 8 mm bore; clamp slot and screw simplified.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "collar";
dimensions = [20, 8, 10];
arbi_catalog_visualization(shape, dimensions);
