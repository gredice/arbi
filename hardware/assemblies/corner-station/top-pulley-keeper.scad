// ARBI top pulley keeper 1.0.0 — concept-unvalidated.
// Canonical source in millimetres. Line retention and loads are unresolved.

include <../../lib/barton-size-1-block.scad>

pulley_diameter = barton_body_width(); // Guard the cheeks, not only the sheave.
pulley_width = barton_thickness();
radial_clearance = 1;
side_clearance = 1;
keeper_wall = 10;
cheek_thickness = 4;
mount_leg_drop = 24;
mount_hole_diameter = 5.5;
bridge_width = 10;
facets = 128;

module keeper_cheek(
    y_position,
    inner_diameter,
    outer_diameter,
    cheek_thickness,
    keeper_wall,
    mount_leg_drop,
    facets
) {
    translate([0, y_position, 0]) {
        intersection() {
            rotate([90, 0, 0])
                difference() {
                    cylinder(d = outer_diameter, h = cheek_thickness, center = true, $fn = facets);
                    cylinder(
                        d = inner_diameter,
                        h = cheek_thickness + 2 * ARBI_EPSILON,
                        center = true,
                        $fn = facets
                    );
                }

            translate([0, 0, outer_diameter / 4])
                cube(
                    [outer_diameter + 2 * ARBI_EPSILON, cheek_thickness + 2 * ARBI_EPSILON, outer_diameter / 2],
                    center = true
                );
        }

        for (x = [-outer_diameter / 2 + keeper_wall / 2, outer_diameter / 2 - keeper_wall / 2])
            translate([x, 0, -mount_leg_drop / 2])
                cube([keeper_wall, cheek_thickness, mount_leg_drop], center = true);
    }
}

module top_pulley_keeper(
    pulley_diameter,
    pulley_width,
    radial_clearance,
    side_clearance,
    keeper_wall,
    cheek_thickness,
    mount_leg_drop,
    mount_hole_diameter,
    bridge_width,
    facets
) {
    inner_diameter = pulley_diameter + 2 * radial_clearance;
    outer_diameter = inner_diameter + 2 * keeper_wall;
    cheek_y = pulley_width / 2 + side_clearance + cheek_thickness / 2;
    total_width = 2 * cheek_y + cheek_thickness;
    leg_x = outer_diameter / 2 - keeper_wall / 2;
    // Side bridges leave the clevis neck and upper pin accessible.
    bridge_z = 0;

    assert(pulley_diameter > 0 && pulley_width > 0, "Pulley dimensions must be positive.");
    assert(radial_clearance > 0 && side_clearance > 0, "Keeper clearances must be positive.");
    assert(keeper_wall >= mount_hole_diameter + 4, "Keeper wall needs at least 2 mm around mount holes.");
    assert(cheek_thickness > 0 && mount_leg_drop > mount_hole_diameter, "Keeper plate dimensions are invalid.");
    assert(bridge_width > 0 && bridge_width < inner_diameter / 2, "Bridge width is invalid.");

    difference() {
        union() {
            for (y = [-cheek_y, cheek_y])
                keeper_cheek(
                    y,
                    inner_diameter,
                    outer_diameter,
                    cheek_thickness,
                    keeper_wall,
                    mount_leg_drop,
                    facets
                );

            for (x = [-leg_x, leg_x])
                translate([x, 0, bridge_z])
                    cube([bridge_width, total_width, keeper_wall], center = true);
        }

        for (x = [-leg_x, leg_x])
            translate([x, 0, -mount_leg_drop / 2])
                rotate([90, 0, 0])
                    cylinder(
                        d = mount_hole_diameter,
                        h = total_width + 2 * ARBI_EPSILON,
                        center = true,
                        $fn = facets
                    );
    }
}

color(ARBI_CORE)top_pulley_keeper(
    pulley_diameter,
    pulley_width,
    radial_clearance,
    side_clearance,
    keeper_wall,
    cheek_thickness,
    mount_leg_drop,
    mount_hole_diameter,
    bridge_width,
    facets
);
