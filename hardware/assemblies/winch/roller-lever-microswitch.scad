// roller-lever-microswitch — r1.0.0, concept-unvalidated. Units: mm.
// Received KW11-3Z reference, not a fabrication source.
// Evidence: docs/evidence/kw11-3z-2026-10-12.md.
// Lever attachment, horizontal roller position, bends and terminal offsets
// remain approximate. Case/holes use the drawing plus owner measurements.
include <../../lib/arbi.scad>

pose = "released"; // released, clicked, fully-pressed
part = "all"; // all, case, roller, lever, terminals

case_length_mm = 20;
case_height_mm = 10.7;
case_thickness_mm = 6.7;
hole_diameter_mm = 2.5;
hole_pitch_mm = 9.5;
first_hole_x_mm = 5.5; // owner: left case edge to first hole centre
hole_height_mm = 2.8;
roller_diameter_mm = 4.8;
roller_width_mm = 4;
axle_span_mm = 7.2;
lever_width_mm = 4;
lever_thickness_mm = 0.3;
released_height_mm = 21.0; // case bottom to roller top
clicked_height_mm = 18; // approximate electrical click, on pressing
pressed_height_mm = 16; // fully pressed, NOT a rated overtravel limit

// Drawing/photo-derived reference details, not measured interface coordinates.
lever_length_mm = 17; // drawing dimension; endpoint interpretation approximate
anchor_x_mm = 3.2;
anchor_z_mm = case_height_mm + lever_thickness_mm / 2;
roller_reach_mm = 15.3; // along the illustrative straight lever
roller_lift_mm = 2.4; // illustrative bent-tab offset above the lever
axle_diameter_mm = 1.6;
terminal_width_mm = 3.1;
terminal_thickness_mm = 0.5;
terminal_depth_mm = 14 - case_height_mm;
terminal_x_mm = [1.9, 10.8, 18.1]; // centred 16.2 span; 7.3 NO-to-NC pitch
eps_mm = ARBI_EPSILON;
facets = 96;

function roller_top_mm(state) = state == "released" ? released_height_mm
    : state == "clicked" ? clicked_height_mm : pressed_height_mm;
function lever_angle_deg(state) =
    asin((roller_top_mm(state) - roller_diameter_mm / 2 - anchor_z_mm)
        / sqrt(pow(roller_reach_mm, 2) + pow(roller_lift_mm, 2)))
    - atan2(roller_lift_mm, roller_reach_mm);

assert(pose == "released" || pose == "clicked" || pose == "fully-pressed",
    "Unknown switch pose.");
assert(part == "all" || part == "case" || part == "roller"
    || part == "lever" || part == "terminals", "Unknown reference part.");
assert(min(case_length_mm, case_height_mm, case_thickness_mm, hole_diameter_mm,
    hole_pitch_mm, roller_diameter_mm, roller_width_mm, lever_width_mm,
    lever_thickness_mm, roller_reach_mm, roller_lift_mm, terminal_depth_mm) > 0);
assert(first_hole_x_mm > hole_diameter_mm / 2
    && first_hole_x_mm + hole_pitch_mm + hole_diameter_mm / 2 < case_length_mm);
assert(hole_height_mm > hole_diameter_mm / 2
    && hole_height_mm + hole_diameter_mm / 2 < case_height_mm);
assert(axle_span_mm > roller_width_mm && lever_length_mm > roller_reach_mm);
assert(released_height_mm > clicked_height_mm && clicked_height_mm > pressed_height_mm);
for(height_mm = [released_height_mm, clicked_height_mm, pressed_height_mm])
    assert(abs(height_mm - roller_diameter_mm / 2 - anchor_z_mm)
        < sqrt(pow(roller_reach_mm, 2) + pow(roller_lift_mm, 2)),
        "Roller height is unreachable with the illustrative lever.");

// Origin: left case edge, thickness midplane, case bottom. +Z is upward;
// mounting bores and roller axle run along Y. Terminals project toward -Z.
module kw11_case() {
    color(ARBI_CORE) difference() {
        translate([0, case_thickness_mm / 2, 0]) rotate([90, 0, 0])
            arbi_rounded_box([case_length_mm, case_height_mm, case_thickness_mm],
                radius = 0.5, facets = facets);
        // Simplified moulded top step seen in the supplied drawing.
        translate([9.5, -case_thickness_mm / 2 - eps_mm, case_height_mm - 0.6])
            cube([case_length_mm, case_thickness_mm + 2 * eps_mm, 1]);
        for(x_mm = [first_hole_x_mm, first_hole_x_mm + hole_pitch_mm])
            translate([x_mm, 0, hole_height_mm]) rotate([90, 0, 0])
                cylinder(d = hole_diameter_mm, h = case_thickness_mm + 2 * eps_mm,
                    center = true, $fn = facets);
    }
}

module kw11_terminals() {
    color([0.72, 0.68, 0.48]) for(x_mm = terminal_x_mm)
        difference() {
            translate([x_mm - terminal_thickness_mm / 2, -terminal_width_mm / 2,
                -terminal_depth_mm])
                cube([terminal_thickness_mm, terminal_width_mm, terminal_depth_mm + eps_mm]);
            // Illustrative solder opening; diameter/location unmeasured.
            translate([x_mm, 0, -1.2]) rotate([0, 90, 0])
                cylinder(d = 1, h = terminal_thickness_mm + 2 * eps_mm,
                    center = true, $fn = facets);
        }
}

module kw11_lever_frame() {
    translate([anchor_x_mm, 0, anchor_z_mm])
        rotate([0, -lever_angle_deg(pose), 0]) children();
}

module kw11_lever() {
    color(ARBI_METAL) {
        // Simplified embedded attachment, rather than a measured pivot assembly.
        translate([anchor_x_mm - 0.6, -lever_width_mm / 2, case_height_mm - 0.4])
            cube([1.2, lever_width_mm, 0.4 + lever_thickness_mm]);
        kw11_lever_frame() {
            translate([0, -lever_width_mm / 2, -lever_thickness_mm / 2])
                cube([lever_length_mm, lever_width_mm, lever_thickness_mm]);
            // Nominal bent ears: their bend shape is unmeasured.
            for(side = [-1, 1]) hull() {
                translate([roller_reach_mm - 1.7,
                    side * (roller_width_mm / 2 + 0.25) - lever_thickness_mm / 2,
                    -lever_thickness_mm / 2])
                    cube([3.4, lever_thickness_mm, lever_thickness_mm]);
                translate([roller_reach_mm,
                    side * (roller_width_mm / 2 + 0.25), roller_lift_mm])
                    rotate([90, 0, 0]) cylinder(d = 3.4, h = lever_thickness_mm,
                        center = true, $fn = facets);
            }
            translate([roller_reach_mm, 0, roller_lift_mm]) rotate([90, 0, 0])
                cylinder(d = axle_diameter_mm, h = axle_span_mm, center = true, $fn = facets);
        }
    }
}

module kw11_roller() {
    color([0.80, 0.16, 0.17]) kw11_lever_frame()
        translate([roller_reach_mm, 0, roller_lift_mm]) rotate([90, 0, 0])
            cylinder(d = roller_diameter_mm, h = roller_width_mm, center = true, $fn = facets);
}

if(part == "all" || part == "case") kw11_case();
if(part == "all" || part == "terminals") kw11_terminals();
if(part == "all" || part == "lever") kw11_lever();
if(part == "all" || part == "roller") kw11_roller();
