// wind-speed-sensor — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Representative three-cup sensor with assumed 150 mm sweep and 120 mm stem; mounting and SKU unknown.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "anemometer";
dimensions = [];
arbi_catalog_visualization(shape, dimensions);
