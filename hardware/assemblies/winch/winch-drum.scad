// ARBI winch-drum 1.0.0 — concept-unvalidated reference geometry.
// NON-MANUFACTURING STUDY: line termination and shaft torque transfer are unresolved.

include <../../lib/arbi.scad>

core_diameter = 100;
required_line_length = 32000; // Deployable capacity; excludes retained reserve wraps.
line_diameter = 1.5;         // Passive line only; not the powered hybrid diameter.
groove_pitch = 2.2;
groove_clearance = 0.2;      // Radial clearance around the nominal circular line.
groove_depth = 0.45;
reserve_turns = 3;          // Sizing experiment, NOT validated termination retention.
edge_margin = 7;
flange_overhang = 14;
flange_thickness = 5;
hub_diameter = 30;
hub_extension = 7;
shaft_bore_diameter = 8.2; // Illustrative clearance only; no torque-transfer interface.
facets = 96;
groove_profile_facets = 12;
helix_segments_per_turn = 96;

// Assume the nominal line seats at the groove bottom. Real loaded radius needs calibration.
groove_radius = line_diameter / 2 + groove_clearance;
effective_line_diameter = core_diameter - 2 * groove_depth + line_diameter;
length_per_turn = sqrt(pow(PI * effective_line_diameter, 2) + pow(groove_pitch, 2));
working_turns = ceil(required_line_length / length_per_turn);
total_turns = working_turns + reserve_turns;
helix_height = total_turns * groove_pitch;
line_width = helix_height + 2 * groove_radius + 2 * edge_margin;
flange_diameter = core_diameter + 2 * flange_overhang;
overall_width = line_width + 2 * flange_thickness + 2 * hub_extension;

// Closed tube swept along a right-handed helix, axis +Z. Cross-sections lie in
// radial/Z planes. Faces use OpenSCAD's clockwise-from-outside convention.
// A single cutter gives a connected groove instead of separate annular channels.
module helical_groove_cut(radius, profile_radius, pitch, turns, segments_per_turn, profile_facets) {
    segments = ceil(turns * segments_per_turn);
    points = [
        for (i = [0 : segments], j = [0 : profile_facets - 1])
            let(
                angle = 360 * turns * i / segments,
                profile_angle = 360 * j / profile_facets,
                radial = radius + profile_radius * cos(profile_angle)
            ) [
                radial * cos(angle),
                radial * sin(angle),
                pitch * turns * i / segments + profile_radius * sin(profile_angle)
            ]
    ];
    faces = concat(
        [for (i = [0 : segments - 1], j = [0 : profile_facets - 1])
            let(a = i * profile_facets + j,
                b = i * profile_facets + (j + 1) % profile_facets,
                c = (i + 1) * profile_facets + (j + 1) % profile_facets,
                d = (i + 1) * profile_facets + j)
            each [[a, b, c], [a, c, d]]],
        [[for (j = [profile_facets - 1 : -1 : 0]) j]],
        [[for (j = [0 : profile_facets - 1]) segments * profile_facets + j]]
    );
    polyhedron(points = points, faces = faces, convexity = 10);
}

module winch_drum() {
    assert(core_diameter >= 90 && core_diameter <= 110, "Study expects a nominal 100 mm core.");
    assert(required_line_length > 0 && line_diameter > 0, "Line dimensions must be positive.");
    assert(groove_clearance >= 0, "Groove clearance cannot be negative.");
    assert(groove_depth > 0 && groove_depth < groove_radius, "Use a shallow open groove.");
    assert(groove_pitch > 2 * groove_radius, "Adjacent groove sweeps must remain separate.");
    assert(reserve_turns >= 1 && reserve_turns == floor(reserve_turns), "Reserve turns must be a positive integer.");
    assert(working_turns * length_per_turn >= required_line_length, "Insufficient deployable capacity.");
    assert(flange_overhang > line_diameter && flange_thickness > 0, "Flanges must extend above the seated line.");
    assert(edge_margin > 0 && hub_extension >= 0, "Invalid axial margins.");
    assert(shaft_bore_diameter > 0 && hub_diameter > shaft_bore_diameter, "Hub must surround the bore.");
    assert(hub_diameter < core_diameter - 2 * groove_depth, "Hub must remain inside the core.");
    assert(facets >= 24 && facets == floor(facets), "Use at least 24 integer body facets.");
    assert(groove_profile_facets >= 8 && groove_profile_facets % 4 == 0, "Profile facets must be a multiple of four, at least eight.");
    assert(helix_segments_per_turn >= 48 && helix_segments_per_turn == floor(helix_segments_per_turn), "Use at least 48 integer segments per turn.");

    echo(
        model = "winch-drum", revision = "1.0.0", role = "reference",
        effective_line_diameter_mm = effective_line_diameter,
        length_per_turn_mm = length_per_turn,
        working_turns = working_turns, reserve_turns = reserve_turns,
        deployable_capacity_mm = working_turns * length_per_turn,
        reserved_line_mm = reserve_turns * length_per_turn,
        line_width_mm = line_width,
        flange_diameter_mm = flange_diameter,
        overall_width_mm = overall_width
    );

    difference() {
        union() {
            cylinder(d = core_diameter, h = line_width, center = true, $fn = facets);
            for (z = [-(line_width + flange_thickness) / 2, (line_width + flange_thickness) / 2])
                translate([0, 0, z])
                    cylinder(d = flange_diameter, h = flange_thickness, center = true, $fn = facets);
            cylinder(d = hub_diameter, h = overall_width, center = true, $fn = facets);
        }
        cylinder(d = shaft_bore_diameter, h = overall_width + 2 * ARBI_EPSILON, center = true, $fn = facets);
        translate([0, 0, -helix_height / 2])
            helical_groove_cut(
                core_diameter / 2 + groove_radius - groove_depth,
                groove_radius, groove_pitch, total_turns,
                helix_segments_per_turn, groove_profile_facets
            );
    }
}

winch_drum();
