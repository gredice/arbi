// bearing-608-2rs — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog nominal 22 mm OD, 8 mm bore and 7 mm width; seals and races simplified.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "ring";
dimensions = [22, 8, 7];
arbi_catalog_visualization(shape, dimensions);
