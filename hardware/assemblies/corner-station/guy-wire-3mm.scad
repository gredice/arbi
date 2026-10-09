// guy-wire-3mm — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog 3 mm wire represented by a short loop; actual cut length and lay are not modeled.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "coil";
dimensions = [3, 80];
arbi_catalog_visualization(shape, dimensions);
