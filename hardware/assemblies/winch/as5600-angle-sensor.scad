// as5600-angle-sensor — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Assumed 23 × 23 mm breakout with a representative magnet; no selected board outline is recorded.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "board";
dimensions = [23, 23, 5];
arbi_catalog_visualization(shape, dimensions);
