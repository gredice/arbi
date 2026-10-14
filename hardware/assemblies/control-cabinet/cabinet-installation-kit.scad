// cabinet-installation-kit r0.1.0 — concept-unvalidated. Approximate set illustration only.
include <../../lib/catalog-visualizations.scad>
color(ARBI_METAL) cv_box([160,35,2]);
color(ARBI_CORE) translate([0,60,0]) cv_box([160,28,35]);
translate([0,-60,0]) cv_terminal([100,35,25]);
