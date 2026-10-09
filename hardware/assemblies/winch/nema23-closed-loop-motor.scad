// nema23-closed-loop-motor — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Existing winch booklet nominal 57 mm face, 122 mm body and 8 mm shaft; confirm supplied kit motor.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "motor";
dimensions = [57, 57, 122];
arbi_catalog_visualization(shape, dimensions);
