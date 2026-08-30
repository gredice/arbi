// ARBI dock funnel 0.1.0 — concept-unvalidated.
// Canonical source in millimetres. Docking capture and impact loads are unresolved.

include <../../lib/arbi.scad>

mouth_inner_diameter = 275;
throat_inner_diameter = 60;
wall_thickness = 6;
funnel_height = 90;
mount_lug_length = 30;
mount_lug_width = 18;
mount_lug_thickness = 6;
mount_hole_diameter = 5.5;
mount_lug_overlap = 10;
facets = 128;

module dock_funnel(
    mouth_inner_diameter,
    throat_inner_diameter,
    wall_thickness,
    funnel_height,
    mount_lug_length,
    mount_lug_width,
    mount_lug_thickness,
    mount_hole_diameter,
    mount_lug_overlap,
    facets
) {
    mouth_outer_diameter = mouth_inner_diameter + 2 * wall_thickness;
    throat_outer_diameter = throat_inner_diameter + 2 * wall_thickness;
    lug_radius = mouth_outer_diameter / 2 + mount_lug_length / 2 - mount_lug_overlap;

    assert(mouth_inner_diameter > throat_inner_diameter, "Funnel mouth must exceed its throat.");
    assert(mouth_inner_diameter >= 250 && mouth_inner_diameter <= 300, "Repository funnel baseline is 250–300 mm.");
    assert(throat_inner_diameter >= 50 && throat_inner_diameter <= 70, "Repository locating-socket baseline is 50–70 mm.");
    assert(throat_inner_diameter > 0 && wall_thickness > 0, "Funnel diameters and wall must be positive.");
    assert(funnel_height > 0, "Funnel height must be positive.");
    assert(mount_lug_overlap > 0 && mount_lug_overlap < mount_lug_length / 2, "Mount-lug overlap is invalid.");
    assert(mount_hole_diameter < mount_lug_width, "Mount hole must fit inside the lug.");

    difference() {
        union() {
            cylinder(
                h = funnel_height,
                d1 = mouth_outer_diameter,
                d2 = throat_outer_diameter,
                $fn = facets
            );

            for (angle = [0, 120, 240])
                rotate([0, 0, angle])
                    translate([lug_radius, 0, mount_lug_thickness / 2])
                        arbi_capsule_bar(
                            mount_lug_length,
                            mount_lug_width,
                            mount_lug_thickness,
                            true,
                            facets
                        );
        }

        translate([0, 0, -ARBI_EPSILON])
            cylinder(
                h = funnel_height + 2 * ARBI_EPSILON,
                d1 = mouth_inner_diameter,
                d2 = throat_inner_diameter,
                $fn = facets
            );

        for (angle = [0, 120, 240])
            rotate([0, 0, angle])
                translate([lug_radius, 0, mount_lug_thickness / 2])
                    cylinder(
                        d = mount_hole_diameter,
                        h = mount_lug_thickness + 2 * ARBI_EPSILON,
                        center = true,
                        $fn = facets
                    );
    }
}

dock_funnel(
    mouth_inner_diameter,
    throat_inner_diameter,
    wall_thickness,
    funnel_height,
    mount_lug_length,
    mount_lug_width,
    mount_lug_thickness,
    mount_hole_diameter,
    mount_lug_overlap,
    facets
);
