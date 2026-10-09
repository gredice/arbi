// corner-head-retention-straps — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog <=2.5 mm strap width and <=1 mm thickness, shown as one assumed circular loop; actual length, latch and installed routing undefined.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "ring";
dimensions = [256, 254, 2.5];
arbi_catalog_visualization(shape, dimensions);
