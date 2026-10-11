// Round-pole pulley mount r1.0.0 — concept-unvalidated.
// Assembly frame: Z up the pole; +X toward the span; Y along the pulley pin.
include <barton-size-1-block.scad>

pole_diameter_mm = 120;
bore_radial_clearance_mm = 0.25;
collar_height_mm = 90;
collar_wall_mm = 10;
split_gap_mm = 3;
ear_thickness_mm = 18;
ear_width_mm = 32;
clamp_hole_diameter_mm = 8.6;
clamp_row_inset_mm = 22;
pulley_offset_mm = 110; // Pole surface to attachment-pin axis, not sheave tangent.
pin_height_mm = 60;
pin_hole_diameter_mm = barton_lug_bore();
pulley_diameter_mm = barton_sheave_diameter();
pulley_hang_mm = barton_pin_spacing();
facets = 128;

function ppm_bore_radius() = pole_diameter_mm / 2 + bore_radial_clearance_mm;
function ppm_outer_radius() = ppm_bore_radius() + collar_wall_mm;
function ppm_ear_y() = ppm_outer_radius() + 10;
function ppm_ear_face() = split_gap_mm / 2 + ear_thickness_mm;
function ppm_pin_x() = pole_diameter_mm / 2 + pulley_offset_mm;


module ppm_checks() {
    assert(pole_diameter_mm >= 100 && pole_diameter_mm <= 140, "Concept pole range is 100–140 mm.");
    assert(bore_radial_clearance_mm >= 0 && bore_radial_clearance_mm <= 0.5);
    assert(split_gap_mm > 2 * bore_radial_clearance_mm && split_gap_mm <= 4);
    assert(collar_height_mm >= 80 && collar_height_mm <= 120);
    assert(collar_wall_mm >= 8 && collar_wall_mm <= 16);
    assert(ear_thickness_mm >= 16 && ear_thickness_mm <= 20);
    assert(ear_width_mm >= 30 && ear_width_mm <= 36);
    assert(clamp_hole_diameter_mm >= 8.4 && clamp_hole_diameter_mm <= 9);
    assert(clamp_row_inset_mm >= 18 && 2 * clamp_row_inset_mm + 24 <= collar_height_mm);
    assert(pulley_offset_mm >= 100 && pulley_offset_mm <= 150);
    assert(pin_height_mm >= 50 && pin_height_mm <= collar_height_mm - 15);
    assert(pin_hole_diameter_mm == barton_lug_bore());
    assert(pulley_hang_mm == barton_pin_spacing());
    assert(facets >= 64 && facets == floor(facets));
    children();
}

module ppm_axis_x(d, h) {
    rotate([0, 90, 0]) cylinder(d = d, h = h, center = true, $fn = facets);
}

module ppm_axis_y(d, h) {
    rotate([90, 0, 0]) cylinder(d = d, h = h, center = true, $fn = facets);
}

module ppm_half_blank() {
    intersection() {
        cylinder(r = ppm_outer_radius(), h = collar_height_mm, $fn = facets);
        translate([split_gap_mm / 2, -ppm_outer_radius(), 0])
            cube([ppm_outer_radius(), 2 * ppm_outer_radius(), collar_height_mm]);
    }
    for (side = [-1, 1])
        translate([split_gap_mm / 2 + ear_thickness_mm / 2, side * ppm_ear_y(), collar_height_mm / 2])
            arbi_rounded_box([ear_thickness_mm, ear_width_mm, collar_height_mm], 3, true, 32);
}

module ppm_bore_and_clamp_holes() {
    translate([0, 0, -ARBI_EPSILON])
        cylinder(r = ppm_bore_radius(), h = collar_height_mm + 2 * ARBI_EPSILON, $fn = facets);
    for (y = [-ppm_ear_y(), ppm_ear_y()], z = [clamp_row_inset_mm, collar_height_mm - clamp_row_inset_mm])
        translate([0, y, z]) ppm_axis_x(clamp_hole_diameter_mm, 2 * ppm_ear_face() + 2 * ARBI_EPSILON);
}

module ppm_gusseted_lug() {
    // Central web mates inside the bought double tang. Upper chord leaves
    // the neck free at the nominal equal-tension 45-degree articulation.
    hull() {
        for(z=[12,collar_height_mm-12])
            translate([pole_diameter_mm/2,0,z]) ppm_axis_y(16,barton_lug_thickness());
        translate([ppm_pin_x(),0,pin_height_mm+24]) ppm_axis_y(16,barton_lug_thickness());
    }
    translate([ppm_pin_x(),0,pin_height_mm]) barton_mount_lug(24,facets);
}

module pole_pulley_mount_front() {
    ppm_checks() difference() {
        union() { ppm_half_blank(); ppm_gusseted_lug(); }
        ppm_bore_and_clamp_holes();
        translate([ppm_pin_x(),0,pin_height_mm])
            ppm_axis_y(pin_hole_diameter_mm,barton_tang_gap());
    }
}

module pole_pulley_mount_rear() {
    ppm_checks() rotate([0, 0, 180]) difference() {
        ppm_half_blank();
        ppm_bore_and_clamp_holes();
    }
}

module ppm_washer_x(x, y, z) {
    translate([x, y, z]) rotate([0, 90, 0]) arbi_tube(18, 8.6, 2, true, 48);
}

module ppm_clamp_hardware() {
    for (y = [-ppm_ear_y(), ppm_ear_y()], z = [clamp_row_inset_mm, collar_height_mm - clamp_row_inset_mm]) {
        translate([ppm_ear_face() + 2 - 30, y, z]) ppm_axis_x(8, 60);
        for (side = [-1, 1]) ppm_washer_x(side * (ppm_ear_face() + 1), y, z);
        translate([ppm_ear_face() + 5, y, z]) rotate([0, 90, 0]) cylinder(d = 15, h = 6, center = true, $fn = 6);
        translate([-ppm_ear_face() - 6, y, z]) rotate([0, 90, 0]) cylinder(d = 15, h = 8, center = true, $fn = 6);
    }
}

module ppm_block_pose() {
    translate([ppm_pin_x(),0,pin_height_mm]) rotate([0,-45,0])
        translate([0,0,-pulley_hang_mm]) children();
}
module ppm_pin_hardware() { ppm_block_pose() barton_clevis_pin(facets); }
module ppm_pulley_reference() { ppm_block_pose() barton_size_1_block(false,facets); }

module ppm_line_reference() {
    x = ppm_pin_x()+pulley_hang_mm/sqrt(2);
    z = pin_height_mm-pulley_hang_mm/sqrt(2);
    r = pulley_diameter_mm / 2 - 0.75;
    points = concat([[x - r, 0, -155]],
        [for (a = [180 : -5 : 90]) [x + r * cos(a), 0, z + r * sin(a)]],
        [[x + 125, 0, z + r]]);
    for (i = [0 : len(points) - 2]) hull()
        for (p = [points[i], points[i + 1]]) translate(p) sphere(d = 1.5, $fn = 12);
}

module pole_pulley_mount_assembly(explode_mm = 0, show_pole = true, show_pulley = true, show_hardware = true, show_line = true) {
    ppm_checks() {
        assert(explode_mm >= 0 && explode_mm <= 100);
        color(ARBI_CORE) {
            translate([explode_mm, 0, 0]) pole_pulley_mount_front();
            translate([-explode_mm, 0, 0]) pole_pulley_mount_rear();
        }
        if (show_pole) color([0.63, 0.53, 0.39, 0.45])
            translate([0, 0, -160]) cylinder(d = pole_diameter_mm, h = 310, $fn = facets);
        if (show_hardware) color(ARBI_METAL) {
            if (explode_mm == 0) ppm_clamp_hardware();
            translate([explode_mm, 0, 0]) ppm_pin_hardware();
        }
        if (show_pulley) translate([explode_mm, 0, 0]) ppm_pulley_reference();
        if (show_line) color(ARBI_CORE) translate([explode_mm, 0, 0]) ppm_line_reference();
    }
}
