// pod-power-wire-black-awg26 — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Assumed 1.5 mm insulated OD; AWG26 denotes conductor gauge, not verified insulation or hybrid-line diameter.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "coil";
dimensions = [1.5, 60];
arbi_catalog_visualization(shape, dimensions);
