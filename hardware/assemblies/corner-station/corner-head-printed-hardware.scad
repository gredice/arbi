// corner-head-printed-hardware — r0.1.0, concept-unvalidated.
// Approximate visualization only; not a manufacturing source. Units: mm.
// Representative catalog M12 × 190 and M8 × 100 bolts with nominal washer/nut samples; grade, threads, locking, pulley pin, straps and received stack are undefined.
// Shape is not yet fully defined. Confirm the selected item against supplier drawings or measurements, then rework this model before using it for fit, clearance or fabrication.
include <../../lib/catalog-visualizations.scad>

arbi_catalog_visualization("bolt", [12,190,19,8]);
translate([40,0,0]) arbi_catalog_visualization("bolt", [8,100,13,5.3]);
translate([0,40,0]) arbi_catalog_visualization("ring", [37,13,3]);
translate([40,40,0]) arbi_catalog_visualization("ring", [16,8.4,1.6]);
translate([0,70,0]) arbi_catalog_visualization("nut", [12,19,12]);
translate([40,70,0]) arbi_catalog_visualization("nut", [8,13,6.5]);
