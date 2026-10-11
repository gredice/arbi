// Barton N01090 / WASI BA01090, measured reference r1.0.0, millimetres.
// Owner measurements dated 2026-10-11; catalogue sheave. Detail surfaces,
// groove, axle and retention ring are reconstructed, not manufacturing data.
include <arbi.scad>

function barton_length() = 65;
function barton_body_width() = 36;
function barton_thickness() = 24;
function barton_pin_diameter() = 4.7;
function barton_tang_gap() = 15.8;
function barton_tang_thickness() = 1.5;
function barton_pin_spacing() = 42;
function barton_sheave_diameter() = 30;
function barton_sheave_width() = 12;
// Provisional printed allowances: 0.5 mm each side, 0.5 mm diametral.
function barton_lug_thickness() = barton_tang_gap()-1;
function barton_lug_bore() = barton_pin_diameter()+0.5;

module barton_ycyl(d,h,fn=96) {
    rotate([90,0,0]) cylinder(d=d,h=h,center=true,$fn=fn);
}
module barton_cheek_profile(fn=96) {
    hull() {
        circle(d=barton_body_width(),$fn=fn);
        translate([0,25]) offset(r=2,$fn=32) square([14,0.1],center=true);
    }
}
module barton_cheeks(fn=96) {
    for(side=[-1,1]) translate([0,side*9.5,0]) rotate([90,0,0])
        linear_extrude(height=3,center=true) difference() {
            barton_cheek_profile(fn);
            for(a=[55,125,180,235,305])
                translate([13*cos(a),13*sin(a)]) circle(d=5.5,$fn=32);
        }
    translate([-8,-11,23]) cube([16,22,4]);
}
module barton_sheave(fn=96) {
    difference() {
        barton_ycyl(barton_sheave_diameter(),barton_sheave_width(),fn);
        // Illustrative broad groove. Root diameter and rope seating unmeasured.
        rotate([90,0,0]) rotate_extrude($fn=fn)
            translate([16,0]) scale([0.65,1]) circle(r=5,$fn=48);
        barton_ycyl(8,14,fn);
    }
}
module barton_tangs(fn=96) {
    for(side=[-1,1])
        translate([0,side*(barton_tang_gap()+barton_tang_thickness())/2,0]) difference() {
            hull() {
                translate([0,0,26]) barton_ycyl(14,barton_tang_thickness(),fn);
                translate([0,0,barton_pin_spacing()]) barton_ycyl(10,barton_tang_thickness(),fn);
            }
            translate([0,0,barton_pin_spacing()]) barton_ycyl(barton_pin_diameter(),3,fn);
        }
}
module barton_clevis_pin(fn=96) {
    // Usable length/head/ring are illustrative; inspect actual lock engagement.
    translate([0,0,barton_pin_spacing()]) {
        barton_ycyl(barton_pin_diameter(),22,fn);
        translate([0,11.5,0]) barton_ycyl(7,1,fn);
        translate([0,-10.5,0]) rotate([90,0,0]) difference() {
            cylinder(d=8,h=0.6,center=true,$fn=48);
            cylinder(d=4.5,h=0.8,center=true,$fn=48);
        }
    }
}
// Origin: sheave axle centre. +Z toward clevis; Y along both pins.
module barton_size_1_block(show_pin=true,fn=96) {
    assert(barton_length()==barton_pin_spacing()+5+barton_body_width()/2);
    color(ARBI_CORE) { barton_cheeks(fn); barton_sheave(fn); }
    color(ARBI_METAL) {
        barton_tangs(fn);
        barton_ycyl(8,16,fn);
        barton_ycyl(4.7,22,fn);
        for(side=[-1,1]) translate([0,side*11.5,0]) barton_ycyl(9,1,fn);
        if(show_pin) barton_clevis_pin(fn);
    }
}
// Origin: attachment pin. Rounded lower nose leaves the rotating neck clear.
module barton_mount_lug(height=25,fn=96) {
    difference() {
        hull() for(z=[0,height]) translate([0,0,z])
            barton_ycyl(16,barton_lug_thickness(),fn);
        barton_ycyl(barton_lug_bore(),barton_tang_gap(),fn);
    }
}
