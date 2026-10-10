// camera-pod-wiring-kit r0.1.0 — concept-unvalidated. Approximate set illustration only.
include <../../lib/catalog-visualizations.scad>
cv_coil([2,40]);
translate([60,0,0]) cv_box([16,65,.3]);
translate([100,0,0]) cv_cable([2,45]);
