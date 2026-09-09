// ARBI winch-mount family 0.1.0 — concept-unvalidated.
// X = shaft axis; Y = transverse; Z = outward from mounting plane.
include <winch-drum.scad>

mount_axis_height = 80;
bearing_outer_diameter = 22;
bearing_seat_clearance = 0.2;
bearing_width = 7;
bearing_axial_clearance = 0.2;
bearing_lip = 1.5;
bearing_split_gap = 0.4;
motor_hole_pitch = 47.14; // NEMA23 starting interface; inspect received motor.
motor_pilot_clearance = 38.6;
motor_shaft_length = 22; // Current kit specification.
motor_body_length = 122;
motor_adjustment = 2;
mount_m4_hole = 4.5;
mount_m5_hole = 5.5;
mount_m6_hole = 6.6;
base_thickness = 8;
function wm_bearing_thickness() = bearing_width + bearing_axial_clearance + 2*bearing_lip;
function wm_motor_face(powered) = wd_width(powered)+81+motor_shaft_length-10;
function wm_base_length(powered) = ceil((wd_width(powered)+300)/10)*10;

module wm_checks() {
    assert(mount_axis_height - flange_diameter/2 >= 12, "Insufficient flange/base clearance.");
    assert(bearing_outer_diameter == 22 && bearing_width == 7, "608 interface expected.");
    assert(bearing_seat_clearance >= 0 && bearing_seat_clearance <= 0.4);
    assert(bearing_split_gap > bearing_seat_clearance && bearing_split_gap <= 0.8);
    assert(wm_bearing_thickness() <= 10.4, "Bearing housing collides with drum clamp/flange.");
    assert(motor_hole_pitch > 45 && motor_hole_pitch < 49);
    assert(motor_pilot_clearance >= 38.1 && motor_pilot_clearance < 40);
    assert(motor_adjustment >= 0 && motor_adjustment <= 2);
    assert(motor_body_length <= 130 && motor_shaft_length >= 20 && motor_shaft_length <= 24);
    assert(base_thickness >= 8);
    assert(mount_axis_height <= 150, "Mount exceeds intended print envelope.");
    children();
}
module wm_xhole(d, length) { rotate([0,90,0]) cylinder(d=d,h=length,center=true,$fn=64); }
module wm_zslot(length,d,h) {
    hull() for(x=[-length/2,length/2]) translate([x,0,-ARBI_EPSILON]) cylinder(d=d,h=h+2*ARBI_EPSILON,$fn=32);
}
module wm_seat() {
    translate([0,0,mount_axis_height]) {
        wm_xhole(18.4,wm_bearing_thickness()+1);
        wm_xhole(bearing_outer_diameter+bearing_seat_clearance,bearing_width+bearing_axial_clearance);
    }
}
module wm_cap_holes() {
    for(y=[-18,18]) translate([0,y,mount_axis_height-22]) cylinder(d=mount_m5_hole,h=44,$fn=32);
}
module wm_bearing_lower() {
    wm_checks() difference() {
        union() {
            translate([-28,-50,0]) cube([28+wm_bearing_thickness()/2,100,8]);
            // Stem is behind the projecting tie rods; compact hood stays inside their swept radius.
            translate([-20,-24,8]) cube([10,48,mount_axis_height-28]);
            hull() {
                translate([-20,-24,mount_axis_height-20]) cube([10,48,4]);
                translate([-wm_bearing_thickness()/2,-24,mount_axis_height-16]) cube([wm_bearing_thickness(),48,4]);
            }
            translate([-wm_bearing_thickness()/2,-24,mount_axis_height-16])
                cube([wm_bearing_thickness(),48,16-bearing_split_gap/2]);
            // Gussets project away from the rotating drum, not underneath its flange.
            for(y=[-18,18]) hull() {
                translate([-26,y-3,8]) cube([6,6,1]);
                translate([-20,y-3,mount_axis_height-30]) cube([2,6,1]);
            }
        }
        wm_seat(); wm_cap_holes();
        for(y=[-40,40]) translate([-16,y,0]) wm_zslot(10,mount_m6_hole,8);
        // Side-access M5 nut windows; slide nuts in along X before fitting cap.
        for(y=[-18,18]) translate([-6,y-4.3,mount_axis_height-13]) cube([12,8.6,4.5]);
    }
}
module wm_bearing_cap() {
    // Flat mating face on print bed. Lift to axis+gap/2 during assembly.
    wm_checks() translate([0,0,-mount_axis_height-bearing_split_gap/2]) difference() {
        translate([-wm_bearing_thickness()/2,-24,mount_axis_height+bearing_split_gap/2])
            cube([wm_bearing_thickness(),48,16-bearing_split_gap/2]);
        wm_seat(); wm_cap_holes();
    }
}
module wm_motor_stand() {
    wm_checks() difference() {
        union() {
            translate([-8,-50,0]) cube([83,100,8]);
            translate([-8,-43,0]) cube([8,86,mount_axis_height+43]);
            for(y=[-33,29]) hull() {
                translate([0,y,8]) cube([65,4,1]);
                translate([0,y,mount_axis_height+30]) cube([1,4,1]);
            }
        }
        // Pilot clearance and bolt slots allow +/-2 mm initial vertical alignment.
        hull() for(z=[-motor_adjustment,motor_adjustment])
            translate([-4,0,mount_axis_height+z]) wm_xhole(motor_pilot_clearance,10);
        for(y=[-motor_hole_pitch/2,motor_hole_pitch/2],z=[-motor_hole_pitch/2,motor_hole_pitch/2])
            hull() for(dz=[-motor_adjustment,motor_adjustment])
                translate([-4,y,mount_axis_height+z+dz]) wm_xhole(mount_m5_hole,10);
        for(x=[20,62],y=[-44,44]) translate([x,y,0]) wm_zslot(12,mount_m6_hole,8);
        // Coupling cover attachment, outside motor body and clear of side ribs.
        for(y=[-38.5,38.5],z=[-20,20]) translate([-4,y,mount_axis_height+z]) wm_xhole(mount_m4_hole,10);
    }
}
module wm_guard_installed() {
    difference() {
        union() {
            // Open underside, removable from the coupling without moving shafts.
            translate([-47,-28,mount_axis_height-25]) cube([39,56,53]);
            translate([-12,-43,mount_axis_height-30]) cube([4,86,62]);
        }
        translate([-48,-24,mount_axis_height-31]) cube([42,48,55]);
        for(y=[-38.5,38.5],z=[-20,20]) translate([-10,y,mount_axis_height+z]) wm_xhole(mount_m4_hole,8);
    }
}
module wm_coupling_guard() {
    // Motor-facing surface lies on bed; shell grows upward without a roof bridge.
    wm_checks() rotate([0,90,0]) translate([8,0,-mount_axis_height]) wm_guard_installed();
}
module wm_bearing_assembly(right=false) {
    if(right) mirror([1,0,0]) wm_bearing_lower(); else wm_bearing_lower();
    translate([0,0,mount_axis_height+bearing_split_gap/2]) wm_bearing_cap();
}
module wm_base(powered=false) {
    w=wd_width(powered); m=wm_motor_face(powered);
    difference() {
        translate([-50,-90,-base_thickness]) cube([wm_base_length(powered),180,base_thickness]);
        // Nominal drill centers: printed slots provide axial setup adjustment.
        for(x=[-21.5,w+53.5],y=[-40,40]) translate([x,y,-base_thickness-1]) cylinder(d=7,h=base_thickness+2,$fn=32);
        for(x=[m+20,m+62],y=[-44,44]) translate([x,y,-base_thickness-1]) cylinder(d=7,h=base_thickness+2,$fn=32);
        // Four M8 post through-bolts, 50 x 120 pattern centered on winding body.
        for(x=[w/2-25,w/2+25],y=[-60,60]) translate([x,y,-base_thickness-1]) cylinder(d=9,h=base_thickness+2,$fn=32);
    }
}
module wm_assembly(powered=false,show_drum=true,show_guard=true) {
    wm_checks() {
        w=wd_width(powered); m=wm_motor_face(powered);
        color("lightgray") wm_base(powered);
        color("steelblue") {
            translate([-5.5,0,0]) wm_bearing_assembly(false);
            translate([w+37.5,0,0]) wm_bearing_assembly(true);
            translate([m,0,0]) wm_motor_stand();
        }
        if(show_drum) translate([0,0,mount_axis_height]) rotate([0,90,0]) rotate([0,0,180]) wd_assembly(powered);
        if(show_guard) color("teal",0.7) translate([m,0,0]) wm_guard_installed();
        color("dimgray") translate([m,-28.5,mount_axis_height-28.5]) cube([motor_body_length,57,57]);
        color("silver") translate([m-motor_shaft_length/2,0,mount_axis_height]) wm_xhole(8,motor_shaft_length);
        echo(bearing_centers=[-5.5,w+37.5],motor_face=m,base_length=wm_base_length(powered),shaft_axis_height=mount_axis_height);
    }
}
