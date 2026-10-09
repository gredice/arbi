// corner-guy-post-connection — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Assumed M8 shackle silhouette representing an unselected bought attachment set; post mounting, height, load path and capacity are undefined.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "shackle";
dimensions = [8, 32, 48];
arbi_catalog_visualization(shape, dimensions);
