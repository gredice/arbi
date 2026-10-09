// motor-power-branch-cable — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Assumed Ø8 mm cable sample; jacket diameter, conductor sizes and installed routing unknown.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "cable";
dimensions = [8, 100];
arbi_catalog_visualization(shape, dimensions);
