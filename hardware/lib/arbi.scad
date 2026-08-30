// Shared ARBI OpenSCAD helpers.
// Units: millimetres. License: AGPL-3.0-only.

ARBI_EPSILON = 0.02;
ARBI_DEFAULT_FACETS = 96;

module arbi_tube(
    outer_diameter,
    inner_diameter,
    height,
    center = false,
    facets = ARBI_DEFAULT_FACETS
) {
    assert(outer_diameter > inner_diameter, "Tube outer diameter must exceed inner diameter.");
    assert(inner_diameter >= 0, "Tube inner diameter cannot be negative.");
    assert(height > 0, "Tube height must be positive.");

    difference() {
        cylinder(d = outer_diameter, h = height, center = center, $fn = facets);
        translate([0, 0, center ? 0 : -ARBI_EPSILON])
            cylinder(
                d = inner_diameter,
                h = height + 2 * ARBI_EPSILON,
                center = center,
                $fn = facets
            );
    }
}

module arbi_rounded_box(
    size,
    radius,
    center = false,
    facets = ARBI_DEFAULT_FACETS
) {
    assert(len(size) == 3, "Rounded-box size must have three dimensions.");
    assert(min(size) > 0, "Rounded-box dimensions must be positive.");
    assert(radius > 0, "Rounded-box radius must be positive.");
    assert(2 * radius <= min(size[0], size[1]), "Rounded-box radius is too large.");

    offset = center ? [0, 0, 0] : [size[0] / 2, size[1] / 2, size[2] / 2];

    translate(offset)
        hull()
            for (x = [-size[0] / 2 + radius, size[0] / 2 - radius])
                for (y = [-size[1] / 2 + radius, size[1] / 2 - radius])
                    translate([x, y, 0])
                        cylinder(r = radius, h = size[2], center = true, $fn = facets);
}

module arbi_capsule_bar(
    length,
    width,
    height,
    center = true,
    facets = ARBI_DEFAULT_FACETS
) {
    assert(length >= width, "Capsule length must be at least its width.");
    assert(width > 0 && height > 0, "Capsule dimensions must be positive.");

    offset = center ? [0, 0, 0] : [length / 2, width / 2, height / 2];

    translate(offset)
        hull()
            for (x = [-(length - width) / 2, (length - width) / 2])
                translate([x, 0, 0])
                    cylinder(d = width, h = height, center = true, $fn = facets);
}

module arbi_bolt_circle(
    count,
    radius,
    hole_diameter,
    height,
    phase = 0,
    facets = ARBI_DEFAULT_FACETS
) {
    assert(count >= 1, "Bolt-circle count must be positive.");
    assert(radius > 0 && hole_diameter > 0 && height > 0, "Bolt-circle dimensions must be positive.");

    for (index = [0 : count - 1])
        rotate([0, 0, phase + index * 360 / count])
            translate([radius, 0, 0])
                cylinder(d = hole_diameter, h = height, center = true, $fn = facets);
}
