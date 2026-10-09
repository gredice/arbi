// zinc-spray — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog 400 ml can represented by an assumed Ø65 × 200 mm package; can/nozzle dimensions unknown.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "can";
dimensions = [65, 200];
arbi_catalog_visualization(shape, dimensions);
