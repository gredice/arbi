// corner-head-printed-hardware — r0.2.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Representative M12 × 190, M8 × 100 and M3 × 12 socket-head bolts, washers and plain M3 hex nuts; grade, threads, locking, pulley pin and received stack remain undefined. No ties.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

arbi_catalog_visualization("bolt", [12,190,19,8]);
translate([40,0,0]) arbi_catalog_visualization("bolt", [8,100,13,5.3]);
translate([0,40,0]) arbi_catalog_visualization("ring", [37,13,3]);
translate([40,40,0]) arbi_catalog_visualization("ring", [16,8.4,1.6]);
translate([0,70,0]) arbi_catalog_visualization("nut", [12,19,12]);
translate([40,70,0]) arbi_catalog_visualization("nut", [8,13,6.5]);

// M3 cover retention samples: socket head, OD7 washer and AF5.5 plain hex nut.
translate([80,0,0]) arbi_catalog_visualization("bolt", [3,12,5.5,3]);
translate([80,40,0]) arbi_catalog_visualization("ring", [7,3.2,0.5]);
translate([80,70,0]) arbi_catalog_visualization("nut", [3,5.5,2.4]);
