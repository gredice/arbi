// winch-drum-shaft-8mm — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog 8 mm shaft; representative 340 mm passive cut from the existing winch booklet, not all purchased stock.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "rod";
dimensions = [8, 340];
arbi_catalog_visualization(shape, dimensions);
