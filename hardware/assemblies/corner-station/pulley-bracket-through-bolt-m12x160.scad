// pulley-bracket-through-bolt-m12x160 — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog M12 × 160 shank; assumed 19 mm hex head and 8 mm head height; threads omitted.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "bolt";
dimensions = [12, 160, 19, 8];
arbi_catalog_visualization(shape, dimensions);
