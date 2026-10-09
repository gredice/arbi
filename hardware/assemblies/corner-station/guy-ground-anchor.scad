// guy-ground-anchor — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog 800 mm starting anchor length with assumed Ø12 mm shaft, eye and helical plate.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "anchor";
dimensions = [800, 12];
arbi_catalog_visualization(shape, dimensions);
