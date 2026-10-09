// microsd-card-32gb — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Uses the existing booklet nominal 11 × 15 × 0.8 mm outline; notch and contact details simplified.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "microsd";
dimensions = [];
arbi_catalog_visualization(shape, dimensions);
