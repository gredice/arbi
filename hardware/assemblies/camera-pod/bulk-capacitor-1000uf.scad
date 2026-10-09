// bulk-capacitor-1000uf — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Assumed Ø10 × 16 mm can and representative leads; rating and selected package remain open.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "capacitor";
dimensions = [10, 16];
arbi_catalog_visualization(shape, dimensions);
