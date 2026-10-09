// control-panel-enclosure — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// 400 × 300 × 200 mm starting cabinet envelope from catalog; walls, door and mounting details assumed.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "enclosure";
dimensions = [400, 300, 200];
arbi_catalog_visualization(shape, dimensions);
