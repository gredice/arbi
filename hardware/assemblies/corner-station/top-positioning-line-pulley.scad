// top-positioning-line-pulley — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog preferred 30 mm sheave with assumed cheeks and attachment eye; supplier block envelope unknown.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "pulley";
dimensions = [30, 12];
arbi_catalog_visualization(shape, dimensions);
