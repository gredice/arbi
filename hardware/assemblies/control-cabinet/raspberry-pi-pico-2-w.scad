// raspberry-pi-pico-2-w — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Assumed nominal 51 × 21 mm PCB with illustrative headers/USB; confirm header height and component keep-outs.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

module cabinet_pico() {
    arbi_catalog_visualization("pico", []);
}
cabinet_pico();
