// ARBI passive winch desk feet 0.1.0 - concept-unvalidated.
// Millimetres. Licence: AGPL-3.0-only.
// Print two "short" and two "long". Flat soles at Z=0.
// Geometry reference: gredice/arbi d8235b0e2f42ad4c10463550c660321c79408fa9
// hardware/lib/winch-mount.scad: passive 550 x 180 x 8 base,
// post hole pattern 50 x 120, centres (148.45/198.45, 30/150) from edges.
// Bench prototype for unloaded desk checks; not a cable-load fixture.

wdf_height = 35;
wdf_base_thickness = 5;
wdf_short_length = 160;
wdf_long_length = 244;
wdf_boss_d = 40;
wdf_bolt_d = 9.2;
wdf_bolt_from_end = 22;
wdf_nut_access_d = 26;
wdf_roof_thickness = 8;
wdf_rib_width = 8;

wdf_eps = 0.05;

assert(wdf_height >= 30);
assert(wdf_roof_thickness >= 8);
assert(wdf_boss_d >= wdf_nut_access_d + 12);

module wdf_sole_2d(length) {
    // Broad end pads and a narrower connecting strip.
    hull() {
        translate([0,0]) circle(d=44,$fn=96);
        for (y=[-22,22]) translate([length-wdf_bolt_from_end-8,y]) circle(r=8,$fn=96);
    }
}

module wdf_foot(length) {
    difference() {
        union() {
            linear_extrude(wdf_base_thickness) wdf_sole_2d(length);
            cylinder(d=wdf_boss_d,h=wdf_height,$fn=96);
            // Two-sided central buttress; printed vertically above the sole.
            translate([0,wdf_rib_width/2,0]) rotate([90,0,0])
                linear_extrude(wdf_rib_width)
                    polygon([[10,wdf_base_thickness-wdf_eps],
                             [10,wdf_height-2],
                             [length-wdf_bolt_from_end-10,wdf_base_thickness+1],
                             [length-wdf_bolt_from_end-10,wdf_base_thickness-wdf_eps]]);
        }
        translate([0,0,-wdf_eps]) cylinder(d=wdf_bolt_d,h=wdf_height+2*wdf_eps,$fn=96);
        // Recess holds a standard M8 washer/nut entirely above the desk.
        // Generate build-plate-only support in this pocket if bridging is poor.
        translate([0,0,-wdf_eps]) cylinder(d=wdf_nut_access_d,h=wdf_height-wdf_roof_thickness+wdf_eps,$fn=96);
    }
}

module wdf_print_foot(length) {
    translate([wdf_bolt_from_end,30,0]) wdf_foot(length);
}

module wdf_installed_feet() {
    for(y=[30,150]) {
        translate([148.45,y,0]) rotate([0,0,180]) wdf_foot(wdf_short_length);
        translate([198.45,y,0]) wdf_foot(wdf_long_length);
    }
}
