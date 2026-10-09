// raspberry-pi-camera-module-3 — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Existing payload booklet nominal 25 × 23.862 mm PCB and 21 × 12.5 mm hole pitch; lens/connector approximate.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "camera";
dimensions = [];
arbi_catalog_visualization(shape, dimensions);
