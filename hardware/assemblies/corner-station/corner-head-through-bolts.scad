// corner-head-through-bolts — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Catalog M12 with one representative 180 mm shank and assumed 19 mm hex head; the 160/180/200 mm pair variants, threads and received stack remain undefined.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "bolt";
dimensions = [12, 180, 19, 8];
arbi_catalog_visualization(shape, dimensions);
