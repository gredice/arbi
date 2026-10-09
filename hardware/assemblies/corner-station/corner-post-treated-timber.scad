// corner-post-treated-timber — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog alternative of a 100 × 100 mm, 4 m square post; actual timber section and length need a survey.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "box";
dimensions = [100, 100, 4000];
arbi_catalog_visualization(shape, dimensions);
