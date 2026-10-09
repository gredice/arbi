// pico-terminal-expansion-board — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Assumed 90 × 60 × 18 mm terminal-board envelope; EP-0145 mounting and terminal geometry unverified.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

shape = "terminal_board";
dimensions = [90, 60, 18];
arbi_catalog_visualization(shape, dimensions);
