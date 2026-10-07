// Round timber-pole interface 0.1.0 — concept-unvalidated, millimetres.
// Saddles are MACHINED METAL, never printed load-bearing substitutes.
include <winch-mount.scad>

pole_diameter = 120;
pole_front = -33; // Preserve the full-cover 25 mm base-to-post offset.
pole_saddle_width = 80;
pole_saddle_height = 24;
function wp_center(d) = pole_front-d/2;
function wp_back(d) = pole_front-d-8;
function wp_bolt_length(d) = ceil((d+60)/10)*10;
module wp_checks(d) {
    assert(d >= 100 && d <= 140, "Round timber diameter study is 100..140 mm.");
    assert(pole_saddle_width/2 < d/2, "Saddle must lie within the pole section.");
    children();
}
module wp_ycylinder(d,h) { rotate([90,0,0]) cylinder(d=d,h=h,center=true,$fn=128); }
module wp_timber(d=120,h=300) {
    translate([0,0,wp_center(d)]) wp_ycylinder(d,h);
}
module wp_drilled_timber(d=120,h=600) {
    difference() {
        wp_timber(d,h);
        for(x=[-25,25],y=[-60,60])
            translate([x,y,wp_back(d)-1]) cylinder(d=9,h=d+30,$fn=64);
    }
}
module wp_front_saddle(d=120) {
    wp_checks(d) difference() {
        translate([-40,-12,wp_center(d)]) cube([80,24,-8-wp_center(d)]);
        wp_timber(d,26);
        for(x=[-25,25]) translate([x,0,wp_center(d)-1]) cylinder(d=9,h=d+40,$fn=64);
    }
}
module wp_rear_saddle(d=120) {
    wp_checks(d) difference() {
        union() {
            translate([-40,-12,wp_back(d)]) cube([80,24,wp_center(d)-wp_back(d)]);
            // Rigid sliding cap rails, part of the machined metal reference.
            for(sx=[-1,1]) scale([sx,1,1])
                translate([39,-11.5,wp_back(d)-2]) cube([5,23,2.1]);
        }
        wp_timber(d,26);
        for(x=[-25,25]) translate([x,0,wp_back(d)-3]) cylinder(d=9,h=d+40,$fn=64);
    }
}
module wp_nut_cover(d=120) {
    // Slide down (-Y) over the rails. Lift +Y 40 mm to remove before inspection.
    // Gravity stop only: vibration/retention and print fit need physical tests.
    difference() {
        translate([-48,-18,wp_back(d)-34]) arbi_rounded_box([96,36,37],3,facets=32);
        translate([-40.6,-19,wp_back(d)-30]) cube([81.2,31.6,34]);
        for(sx=[-1,1]) scale([sx,1,1])
            translate([40.4,-19,wp_back(d)-2.6]) cube([4.2,31.6,3.2]);
    }
}
module wp_nut_cover_bottom(d=120) {
    // Separate snug closure blocks the otherwise open underside. Nominal
    // zero-clearance side contacts require print-fit/retention calibration.
    union() {
        translate([-44,-20,wp_back(d)-32]) cube([88,2,35]);
        translate([-40.6,-18.01,wp_back(d)-30]) cube([81.2,4.01,33]);
    }
}
module wp_print_nut_cover() {
    translate([48,18,-wp_back(pole_diameter)+34]) wp_nut_cover(pole_diameter);
}
module wp_print_nut_cover_bottom() {
    translate([44,20,-wp_back(pole_diameter)+32]) wp_nut_cover_bottom(pole_diameter);
}
module wp_cable_guide(d=120) {
    // Non-structural guide, tied to the timber independently of the winch.
    // Two 11 mm channels accept the provisional <=10 mm stationary looms.
    difference() {
        translate([-25,-8,-34]) arbi_rounded_box([50,16,19],3,facets=32);
        wp_timber(d,18);
        for(x=[-8,8]) {
            translate([x,0,-24]) wp_ycylinder(11,20);
            translate([x-3.5,-10,-24]) cube([7,20,12]);
        }
        // Paired through-slots let two circumferential soft ties wrap the
        // pole and bridge the guide face. End bridges keep this one solid.
        for(x=[-20,20]) translate([x-1.5,-4.5,-35]) cube([3,9,21]);
    }
}
module wp_print_cable_guide() {
    translate([25,8,34]) wp_cable_guide(pole_diameter);
}
module wp_guide_tie(d=120) {
    // Nominal flexible 2.5 x 1 mm soft tie; not a printable substitute.
    r=d/2+0.6; angle=asin(20/r);
    path=concat([[-20,-14.5],[20,-14.5]],
        [for(j=[0:128]) let(a=angle+j*(360-2*angle)/128)
            [r*sin(a),wp_center(d)+r*cos(a)]]);
    translate([0,1.25,0]) rotate([90,0,0]) linear_extrude(height=2.5)
        difference() {
            offset(r=0.5,$fn=24) polygon(path);
            offset(delta=-0.5) polygon(path);
        }
}
module wp_mount(powered=false,d=120,show_post=true,show_caps=true) {
    wp_checks(d) {
        if(show_post) color([0.48,0.32,0.16]) translate([wd_width(powered)/2,0,0]) wp_drilled_timber(d,600);
        for(y=[-60,60]) {
            color(ARBI_METAL) translate([wd_width(powered)/2,y,0]) wp_front_saddle(d);
            color(ARBI_METAL) translate([wd_width(powered)/2,y,0]) wp_rear_saddle(d);
            if(show_caps) color(ARBI_SHELL) translate([wd_width(powered)/2,y,0]) {
                wp_nut_cover(d);
                wp_nut_cover_bottom(d);
            }
        }
        color(ARBI_CORE) translate([wd_width(powered)/2,-230,0]) wp_cable_guide(d);
        color(ARBI_CORE) for(y=[-233,-227])
            translate([wd_width(powered)/2,y,0]) wp_guide_tie(d);
    }
}

// Simplified bought M8 hardware for assembly context, not manufacturing models.
module wp_ring(od,id,h) { difference() { cylinder(d=od,h=h,$fn=64); translate([0,0,-0.01]) cylinder(d=id,h=h+0.02,$fn=64); } }
module wp_fasteners(powered=false,d=120) {
    color(ARBI_METAL) for(x=[wd_width(powered)/2-25,wd_width(powered)/2+25],y=[-60,60]) {
        translate([x,y,1.6-wp_bolt_length(d)]) cylinder(d=8,h=wp_bolt_length(d),$fn=64);
        translate([x,y,1.6]) cylinder(d=13,h=8,$fn=64);
        translate([x,y,0]) wp_ring(24,8.4,1.6);
        translate([x,y,wp_back(d)-1.6]) wp_ring(24,8.4,1.6);
        translate([x,y,wp_back(d)-9.6]) difference() {
            cylinder(d=13/cos(30),h=8,$fn=6);
            translate([0,0,-0.01]) cylinder(d=8,h=8.02,$fn=64);
        }
    }
}
