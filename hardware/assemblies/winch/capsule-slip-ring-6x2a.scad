// capsule-slip-ring-6x2a — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Assumed Ø22 × 28 mm capsule with illustrative leads; exact SKU and flange geometry are unknown.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "slip_ring";
dimensions = [22, 28];
arbi_catalog_visualization(shape, dimensions);
