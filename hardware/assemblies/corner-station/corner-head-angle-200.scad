// corner-head-angle-200 — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog historical 200 × 40 × 200 mm, 5 mm steel angle; illustrative holes and bend are simplified and do not define the proposed drilling pattern.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "angle";
dimensions = [200, 40, 200, 5];
arbi_catalog_visualization(shape, dimensions);
