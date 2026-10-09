// pulley-bracket-locknut-m12 — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog M12 locking nut with assumed 19 mm across flats and 12 mm height; thread and nylon insert simplified.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "nut";
dimensions = [12, 19, 12];
arbi_catalog_visualization(shape, dimensions);
