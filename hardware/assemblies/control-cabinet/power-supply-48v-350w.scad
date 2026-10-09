// power-supply-48v-350w — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Assumed 215 × 115 × 50 mm PSU envelope with vent/terminal details; exact kit supply drawing unverified.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

module cabinet_power_supply() {
    arbi_catalog_visualization("psu", [215, 115, 50]);
}
cabinet_power_supply();
