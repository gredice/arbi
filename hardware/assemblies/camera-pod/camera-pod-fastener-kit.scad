// camera-pod-fastener-kit r0.1.0 — concept-unvalidated. Approximate set illustration only.
include <../../lib/catalog-visualizations.scad>
for(i=[0:3]) translate([i*15,0,0]) cv_bolt([2,12,3.5,1.5]);
for(i=[0:3]) translate([i*15,15,0]) cv_nut([2,4,1.6]);
for(i=[0:3]) translate([i*15,30,0]) cv_ring([5,2.2,.3]);
