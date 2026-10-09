// guy-turnbuckle-m12 — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog M12 rod size with assumed 180 mm body; eye, travel and thread details unspecified.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "turnbuckle";
dimensions = [180, 12];
arbi_catalog_visualization(shape, dimensions);
