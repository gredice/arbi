// emergency-stop-switch — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog 22 mm panel stem with an assumed Ø40 mm mushroom; contacts and panel fit unspecified.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "switch";
dimensions = [22, 40];
arbi_catalog_visualization(shape, dimensions);
