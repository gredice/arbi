// raspberry-pi-3a-plus — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Existing payload booklet nominal 65 × 56 mm PCB and 58 × 49 mm mounting pitch; connectors simplified.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "pi";
dimensions = [];
arbi_catalog_visualization(shape, dimensions);
