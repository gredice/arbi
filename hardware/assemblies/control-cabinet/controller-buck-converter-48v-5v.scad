// controller-buck-converter-48v-5v — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Assumed 45 × 25 × 15 mm occupied envelope; no converter package drawing is recorded.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

module cabinet_controller_converter() {
    arbi_catalog_visualization("board", [45, 25, 15]);
}
cabinet_controller_converter();
