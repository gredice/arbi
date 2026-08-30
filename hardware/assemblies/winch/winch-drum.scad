// ARBI winch drum 0.1.0 — concept-unvalidated reference geometry.
// NON-MANUFACTURING STUDY: line termination and shaft torque transfer are unresolved.

include <../../lib/arbi.scad>

// Repository baseline starts around a nominal 100 mm direct-drive drum diameter.
core_diameter = 100;
required_line_length = 32000;
line_diameter = 1.5;
groove_pitch = 2.2;
edge_margin = 7;
flange_overhang = 14;
flange_thickness = 5;
hub_diameter = 30;
hub_extension = 7;
shaft_bore_diameter = 8.2;
line_anchor_diameter = 3.2;
facets = 96;

effective_line_diameter = core_diameter + line_diameter;
usable_turns = ceil(required_line_length / (PI * effective_line_diameter));
line_width = (usable_turns - 1) * groove_pitch + line_diameter + 2 * edge_margin;
flange_diameter = core_diameter + 2 * flange_overhang;
groove_width = min(line_diameter * 0.55, groove_pitch * 0.6);
groove_depth = line_diameter * 0.22;

module square_groove_cut(
    core_diameter,
    groove_depth,
    groove_width,
    facets
) {
    difference() {
        cylinder(
            d = core_diameter + 2 * ARBI_EPSILON,
            h = groove_width,
            center = true,
            $fn = facets
        );
        cylinder(
            d = core_diameter - 2 * groove_depth,
            h = groove_width + 2 * ARBI_EPSILON,
            center = true,
            $fn = facets
        );
    }
}

module winch_drum(
    core_diameter,
    required_line_length,
    line_diameter,
    groove_pitch,
    edge_margin,
    flange_diameter,
    flange_thickness,
    hub_diameter,
    hub_extension,
    shaft_bore_diameter,
    line_anchor_diameter,
    usable_turns,
    line_width,
    groove_width,
    groove_depth,
    facets
) {
    total_width = line_width + 2 * flange_thickness;
    first_groove_z = -line_width / 2 + edge_margin + line_diameter / 2;
    calculated_capacity = usable_turns * PI * (core_diameter + line_diameter);

    assert(core_diameter >= 90 && core_diameter <= 110, "Concept baseline expects a nominal 100 mm drum.");
    assert(required_line_length > 0 && line_diameter > 0, "Line dimensions must be positive.");
    assert(groove_pitch >= line_diameter, "Groove pitch must not be smaller than the line diameter.");
    assert(usable_turns >= 1 && calculated_capacity >= required_line_length, "Drum does not provide requested single-layer capacity.");
    assert(flange_diameter > core_diameter, "Flanges must retain the line above the core.");
    assert(flange_thickness > 0 && edge_margin > 0, "Flange and edge dimensions must be positive.");
    assert(hub_diameter > shaft_bore_diameter, "Hub must be larger than the shaft bore.");
    assert(hub_diameter < core_diameter - 2 * groove_depth, "Hub must remain inside the grooved core.");
    assert(line_anchor_diameter > 0 && line_anchor_diameter < edge_margin, "Line-anchor holes must fit inside the edge margin.");

    echo(
        model = "winch-drum",
        usable_turns = usable_turns,
        line_width_mm = line_width,
        calculated_single_layer_capacity_mm = calculated_capacity
    );

    difference() {
        union() {
            cylinder(d = core_diameter, h = line_width, center = true, $fn = facets);

            for (z = [-(line_width + flange_thickness) / 2, (line_width + flange_thickness) / 2])
                translate([0, 0, z])
                    cylinder(
                        d = flange_diameter,
                        h = flange_thickness,
                        center = true,
                        $fn = facets
                    );

            cylinder(
                d = hub_diameter,
                h = total_width + 2 * hub_extension,
                center = true,
                $fn = facets
            );
        }

        cylinder(
            d = shaft_bore_diameter,
            h = total_width + 2 * hub_extension + 2 * ARBI_EPSILON,
            center = true,
            $fn = facets
        );

        for (turn = [0 : usable_turns - 1])
            translate([0, 0, first_groove_z + turn * groove_pitch])
                square_groove_cut(core_diameter, groove_depth, groove_width, facets);

        // Two radial witness holes mark unresolved termination zones. They stop
        // outside the central hub/shaft and are not a released line anchor.
        for (z = [
            -line_width / 2 + edge_margin / 2,
            line_width / 2 - edge_margin / 2
        ])
            translate([core_diameter / 2 - line_anchor_diameter, 0, z])
                rotate([90, 0, 0])
                    cylinder(
                        d = line_anchor_diameter,
                        h = 2 * line_anchor_diameter,
                        center = true,
                        $fn = facets
                    );
    }
}

winch_drum(
    core_diameter,
    required_line_length,
    line_diameter,
    groove_pitch,
    edge_margin,
    flange_diameter,
    flange_thickness,
    hub_diameter,
    hub_extension,
    shaft_bore_diameter,
    line_anchor_diameter,
    usable_turns,
    line_width,
    groove_width,
    groove_depth,
    facets
);
