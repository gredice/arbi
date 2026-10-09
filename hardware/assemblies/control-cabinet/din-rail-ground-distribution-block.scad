// din-rail-ground-distribution-block — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Assumed 80 × 35 × 45 mm block with representative terminals; terminal count and DIN clip unknown.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

module cabinet_signal_ground() {
    arbi_catalog_visualization("terminal", [80, 35, 45]);
}
cabinet_signal_ground();
