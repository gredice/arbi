// underground-cable-sleeve — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Assumed 25 mm OD, 20 mm ID conduit sample; selected diameter, corrugations and routing unknown.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "tube";
dimensions = [25, 20, 100];
arbi_catalog_visualization(shape, dimensions);
