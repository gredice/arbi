// WT-806 indoor fixture r0.1.0 — concept-unvalidated, millimetres.
// Friction clamps for unloaded fit/rotation checks; no cable-load rating.
include <arbi.scad>

head_tube_diameter_mm = 26;
winch_tube_diameter_mm = 35;
tube_clearance_mm = 0.3;
split_gap_mm = 0.8;
adapter_height_mm = 50;
virtual_post_offset_mm = 30;

function csa_half_depth(d) = d/2+10;
function csa_half_width() = 51;
function csa_head_seat() = virtual_post_offset_mm+23;
function csa_base_front() = virtual_post_offset_mm+60+33;
function csa_winch_seat() = csa_base_front()-8;
function csa_clamp_bolt_length(d) = ceil((2*csa_half_depth(d)+3.2+6+3)/5)*5;

module csa_checks(d) {
    assert(d>=26 && d<=35, "Measure/select a WT-806 26, 30 or 35 mm straight tube.");
    assert(tube_clearance_mm>=0 && tube_clearance_mm<=0.5);
    assert(split_gap_mm>tube_clearance_mm && split_gap_mm<=1.2,
        "Clamp faces need closing travel beyond the bore clearance.");
    assert(adapter_height_mm==50 && virtual_post_offset_mm==30,
        "r0.1.0 uses the checked 50 mm rows and 30 mm virtual-post offset.");
    assert(csa_half_depth(d)+2<csa_head_seat()-15,
        "Keep M12 nut and wrench access clear of the tube clamp.");
    children();
}
module csa_xcylinder(d,h) {
    rotate([0,90,0]) cylinder(d=d,h=h,center=true,$fn=64);
}
module csa_xring(od,id,h) {
    difference() { csa_xcylinder(od,h); csa_xcylinder(id,h+2*ARBI_EPSILON); }
}
module csa_clamp_blank(d) {
    translate([-csa_half_depth(d),-csa_half_width(),-adapter_height_mm/2])
        arbi_rounded_box([2*csa_half_depth(d),2*csa_half_width(),adapter_height_mm],3,facets=32);
}
module csa_clamp_cuts(d) {
    translate([0,0,-adapter_height_mm/2-ARBI_EPSILON])
        cylinder(d=d+tube_clearance_mm,h=adapter_height_mm+2*ARBI_EPSILON,$fn=128);
    for(y=[-42,42]) translate([0,y,0]) csa_xcylinder(6.6,2*csa_half_depth(d)+2);
}
module csa_front_clamp(d) {
    difference() {
        intersection() {
            csa_clamp_blank(d);
            translate([split_gap_mm/2,-52,-26]) cube([40,104,52]);
        }
        csa_clamp_cuts(d);
    }
}
module corner_stand_rear_clamp(d=26) {
    csa_checks(d) difference() {
        intersection() {
            csa_clamp_blank(d);
            translate([-40,-52,-26]) cube([40-split_gap_mm/2,104,52]);
        }
        csa_clamp_cuts(d);
    }
}
module corner_stand_head_front() {
    d=head_tube_diameter_mm;
    csa_checks(d) difference() {
        union() {
            csa_front_clamp(d);
            // Convex round-120 contact patches fit the existing printed carriers.
            intersection() {
                translate([virtual_post_offset_mm,0,-25]) cylinder(d=120,h=50,$fn=96);
                translate([csa_head_seat(),-40,-25]) cube([40,80,50]);
            }
            // Two full-height webs leave the short M12 nut/washer accessible.
            for(y=[-32,20]) translate([split_gap_mm/2,y,-25])
                cube([virtual_post_offset_mm+50-split_gap_mm/2,12,50]);
        }
        translate([virtual_post_offset_mm+65,0,0]) csa_xcylinder(13,90);
    }
}
module corner_stand_winch_front() {
    d=winch_tube_diameter_mm;
    csa_checks(d) difference() {
        union() {
            csa_front_clamp(d);
            translate([csa_winch_seat()-16,-40,-25]) cube([16,80,50]);
            for(y=[-31,19]) translate([split_gap_mm/2,y,-25])
                cube([csa_winch_seat()-16-split_gap_mm/2+ARBI_EPSILON,12,50]);
        }
        for(y=[-25,25]) {
            translate([csa_winch_seat()-8,y,0]) csa_xcylinder(9.2,18);
            // Clearance for rear washer, nut, bolt tip and a nominal 24 mm socket.
            translate([(csa_half_depth(d)+2+csa_winch_seat()-16)/2,y,0])
                csa_xcylinder(26,csa_winch_seat()-16-csa_half_depth(d)-2+ARBI_EPSILON);
        }
    }
}
// Clamp split faces on the bed. X becomes printer Z; holes remain vertical.
// Support under the forward contact pad/plate is a slicer/process decision.
module csa_print_front(role="head") {
    translate([25,51,-split_gap_mm/2]) rotate([0,-90,0])
        if(role=="head") corner_stand_head_front();
        else { assert(role=="winch"); corner_stand_winch_front(); }
}
module csa_print_rear(d=26) {
    translate([25,51,-split_gap_mm/2]) rotate([0,90,0]) corner_stand_rear_clamp(d);
}
module csa_clamp_hardware(d) {
    // Bought hardware envelopes; insert M6 bolts from the rear, nuts at the front.
    length=csa_clamp_bolt_length(d);
    head=-csa_half_depth(d)-1.6;
    for(y=[-42,42]) {
        translate([head+length/2,y,0]) csa_xcylinder(6,length);
        translate([head-3,y,0]) csa_xcylinder(10,6);
        for(x=[-csa_half_depth(d)-.8,csa_half_depth(d)+.8])
            translate([x,y,0]) csa_xring(12,6.6,1.6);
        translate([csa_half_depth(d)+4.6,y,0]) difference() {
            rotate([0,90,0]) cylinder(d=10/cos(30),h=6,center=true,$fn=6);
            csa_xcylinder(6,6.04);
        }
    }
}
