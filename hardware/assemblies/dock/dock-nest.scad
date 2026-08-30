// ARBI dock nest 0.1.0 — concept-unvalidated.
// Canonical source in millimetres. Retention and structural interfaces are unresolved.

include <../../lib/arbi.scad>

base_size = [330, 330, 20];
base_corner_radius = 20;
pod_envelope = [170, 125];
pocket_clearance = 4;
pocket_depth = 9;
latch_opening_diameter = 28;
drain_hole_diameter = 7;
mount_inset = [22, 22];
mount_hole_diameter = 6.5;
facets = 96;

module dock_nest(
    base_size,
    base_corner_radius,
    pod_envelope,
    pocket_clearance,
    pocket_depth,
    latch_opening_diameter,
    drain_hole_diameter,
    mount_inset,
    mount_hole_diameter,
    facets
) {
    pocket_size = [
        pod_envelope[0] + 2 * pocket_clearance,
        pod_envelope[1] + 2 * pocket_clearance,
        pocket_depth + 2 * ARBI_EPSILON
    ];
    pocket_radius = max(base_corner_radius - pocket_clearance, 2);

    assert(min(base_size) > 0, "Nest base dimensions must be positive.");
    assert(pocket_clearance >= 0, "Pocket clearance cannot be negative.");
    assert(pocket_depth > 0 && pocket_depth < base_size[2], "Pocket depth must remain within the base.");
    assert(pocket_size[0] < base_size[0] && pocket_size[1] < base_size[1], "Pod pocket must remain within the base.");
    assert(2 * mount_inset[0] < base_size[0] && 2 * mount_inset[1] < base_size[1], "Mount inset is outside the base.");

    difference() {
        translate([0, 0, base_size[2] / 2])
            arbi_rounded_box(base_size, base_corner_radius, true, facets);

        translate([0, 0, base_size[2] - pocket_depth / 2 + ARBI_EPSILON])
            arbi_rounded_box(pocket_size, pocket_radius, true, facets);

        translate([0, 0, base_size[2] / 2])
            cylinder(
                d = latch_opening_diameter,
                h = base_size[2] + 2 * ARBI_EPSILON,
                center = true,
                $fn = facets
            );

        for (x = [-pod_envelope[0] / 3, pod_envelope[0] / 3])
            translate([x, 0, base_size[2] / 2])
                cylinder(
                    d = drain_hole_diameter,
                    h = base_size[2] + 2 * ARBI_EPSILON,
                    center = true,
                    $fn = facets
                );

        for (x = [-base_size[0] / 2 + mount_inset[0], base_size[0] / 2 - mount_inset[0]])
            for (y = [-base_size[1] / 2 + mount_inset[1], base_size[1] / 2 - mount_inset[1]])
                translate([x, y, base_size[2] / 2])
                    cylinder(
                        d = mount_hole_diameter,
                        h = base_size[2] + 2 * ARBI_EPSILON,
                        center = true,
                        $fn = facets
                    );
    }
}

dock_nest(
    base_size,
    base_corner_radius,
    pod_envelope,
    pocket_clearance,
    pocket_depth,
    latch_opening_diameter,
    drain_hole_diameter,
    mount_inset,
    mount_hole_diameter,
    facets
);
