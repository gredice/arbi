// cabinet-installation-kit r0.1.0 — concept-unvalidated. Approximate set illustration only.
include <../../lib/catalog-visualizations.scad>
cv_box([160,35,2]);
translate([0,60,0]) cv_box([160,28,35]);
translate([0,-60,0]) cv_terminal([100,35,25]);
