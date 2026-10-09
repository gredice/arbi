// dock-weather-hood — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog 300 × 300 mm starting roof footprint with an assumed 60 mm slope and 3 mm wall.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "hood";
dimensions = [300, 300, 60];
arbi_catalog_visualization(shape, dimensions);
