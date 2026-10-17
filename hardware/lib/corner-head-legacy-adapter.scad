// Temporary r0.1.0 adapter for the old r0.1.0 carrier and measured Barton N01090.
// Concept-unvalidated: fit/hand-routing trials only; no load rating.
include <corner-head-legacy-interface.scad>

// Origin is the OLD M8 hole; +X points away from the post, +Z points upward.
// Lower the native pin to clear the old rectangular lug. The small X correction
// preserves the nominal 45-degree vertical winch tangent with 42 mm centres.
function lpa_drop() = 35;
function lpa_pin_dx() = -(barton_pin_spacing()-40)/sqrt(2);
function lpa_socket_gap() = 8.6;
function lpa_socket_width() = 32.6;
function lpa_half_thickness() = barton_lug_thickness()/2;

module lpa_body() {
    difference() {
        union() {
            rotate([90,0,0]) linear_extrude(height=barton_lug_thickness(),center=true)
                offset(r=2,$fn=32) offset(delta=-2)
                    translate([-20.3,-20.5]) square([40.6,34.5]);
            translate([lpa_pin_dx(),0,-lpa_drop()]) barton_mount_lug(height=16.5,fn=facets);
        }
        // Open-top rectangular pocket captures the old lug on both sides and
        // beneath its lower edge; it is an anti-rotation socket, not a free link.
        translate([-lpa_socket_width()/2,-lpa_socket_gap()/2,-15.5])
            cube([lpa_socket_width(),lpa_socket_gap(),40]);
        ch_ycyl(8.6,30);
    }
}
module corner_head_legacy_adapter_left() {
    intersection() { lpa_body(); translate([-25,-10,-45]) cube([50,10,65]); }
}
module corner_head_legacy_adapter_right() {
    intersection() { lpa_body(); translate([-25,0,-45]) cube([50,10,65]); }
}
// Outside flat face on the bed; pockets face upward and both bores are vertical.
// Each print is 40.6 x 57 x 7.4 mm. No support is needed by nominal geometry.
module lpa_print_left() {
    translate([20.3,14,lpa_half_thickness()]) rotate([90,0,0]) corner_head_legacy_adapter_left();
}
module lpa_print_right() {
    translate([20.3,43,lpa_half_thickness()]) rotate([-90,0,0]) corner_head_legacy_adapter_right();
}
module lpa_fastener() {
    // M8 x 30, two 1.6 mm washers and a 6.5 mm locknut: illustrative envelopes.
    translate([0,-6,0]) ch_ycyl(8,30);
    translate([0,11.65,0]) rotate([90,0,0]) cylinder(d=13/cos(30),h=5.3,center=true,$fn=6);
    for(y=[-8.2,8.2]) translate([0,y,0]) pch_ring_y(16,8.4,1.6);
    translate([0,-12.25,0]) difference() {
        rotate([90,0,0]) cylinder(d=13/cos(30),h=6.5,center=true,$fn=6);
        ch_ycyl(8,6.52);
    }
}
module lpa_block(angle=45) {
    translate([lpa_pin_dx(),0,-lpa_drop()]) rotate([0,-angle,0])
        translate([0,0,-barton_pin_spacing()]) barton_size_1_block(fn=facets);
}
module corner_head_legacy_adapter_assembly() {
    color([.63,.53,.39]) pch_post();
    color(ARBI_CORE) { lch_carrier(); lch_rear_pads(); }
    color(ARBI_METAL) { pch_hardware(); pch_cross_hardware(); }
    translate([lch_pin_x(),0,165]) {
        color([.8,.48,.18]) { corner_head_legacy_adapter_left(); corner_head_legacy_adapter_right(); }
        color(ARBI_METAL) lpa_fastener();
        lpa_block();
    }
    // Sheave is 35 mm lower than r1.0.0; omit covers/line for interface inspection.
}
