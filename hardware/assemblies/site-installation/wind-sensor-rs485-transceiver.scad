// wind-sensor-rs485-transceiver — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Assumed 30 × 20 × 10 mm RS485 breakout; no selected module drawing exists.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "board";
dimensions = [30, 20, 10];
arbi_catalog_visualization(shape, dimensions);
