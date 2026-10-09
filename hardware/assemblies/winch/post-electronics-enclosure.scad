// post-electronics-enclosure — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog approximate 150 × 100 × 70 mm box; flange, gasket and driver clearance unknown.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "enclosure";
dimensions = [150, 100, 70];
arbi_catalog_visualization(shape, dimensions);
