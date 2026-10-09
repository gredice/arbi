// flexible-jaw-coupling-8mm — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog approximate Ø20 × 25 mm body and 8 mm bores; jaws and elastomer simplified.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "coupling";
dimensions = [20, 8, 25];
arbi_catalog_visualization(shape, dimensions);
