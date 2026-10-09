// pulley-bracket-backing-plate — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog 100 × 200 × 2 mm stock plate; shows one plate, with assumed perforations; two are stacked per post.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "plate";
dimensions = [100, 200, 2];
arbi_catalog_visualization(shape, dimensions);
