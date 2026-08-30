// ARBI camera pod envelope 0.1.0 — concept-unvalidated reference geometry.
// NON-MANUFACTURING KEEP-OUT MODEL. Canonical units are millimetres.

include <../../lib/arbi.scad>

fixed_component_keepout = [170, 125, 52];
fixed_component_corner_radius = 14;
gimbal_sweep_diameter = 108;
gimbal_sweep_height = 68;
docking_interface_diameter = 30;
docking_interface_height = 46;
rear_service_keepout = [70, 34, 34];
line_termination_radius = 108;
line_termination_keepout_diameter = 18;
facets = 72;

module camera_pod_envelope(
    fixed_component_keepout,
    fixed_component_corner_radius,
    gimbal_sweep_diameter,
    gimbal_sweep_height,
    docking_interface_diameter,
    docking_interface_height,
    rear_service_keepout,
    line_termination_radius,
    line_termination_keepout_diameter,
    facets
) {
    body_height = fixed_component_keepout[2];

    assert(min(fixed_component_keepout) > 0, "Fixed-component keep-out must be positive.");
    assert(gimbal_sweep_diameter > 0 && gimbal_sweep_height > 0, "Gimbal keep-out must be positive.");
    assert(docking_interface_diameter > 0 && docking_interface_height > 0, "Docking keep-out must be positive.");
    assert(line_termination_radius > fixed_component_keepout[0] / 2, "Line terminations must remain outside fixed components.");

    // The union intentionally represents reserved volume, not walls or printable structure.
    color([0.2, 0.55, 0.9, 0.35])
        union() {
            arbi_rounded_box(
                fixed_component_keepout,
                fixed_component_corner_radius,
                true,
                facets
            );

            translate([0, 0, -body_height / 2 - gimbal_sweep_height / 2])
                cylinder(
                    d = gimbal_sweep_diameter,
                    h = gimbal_sweep_height,
                    center = true,
                    $fn = facets
                );

            translate([0, 0, body_height / 2 + docking_interface_height / 2])
                cylinder(
                    d = docking_interface_diameter,
                    h = docking_interface_height,
                    center = true,
                    $fn = facets
                );

            translate([0, fixed_component_keepout[1] / 2 + rear_service_keepout[1] / 2, 0])
                cube(rear_service_keepout, center = true);

            for (angle = [45, 135, 225, 315])
                rotate([0, 0, angle])
                    translate([line_termination_radius, 0, 0])
                        cylinder(
                            d = line_termination_keepout_diameter,
                            h = body_height,
                            center = true,
                            $fn = facets
                        );
        }
}

camera_pod_envelope(
    fixed_component_keepout,
    fixed_component_corner_radius,
    gimbal_sweep_diameter,
    gimbal_sweep_height,
    docking_interface_diameter,
    docking_interface_height,
    rear_service_keepout,
    line_termination_radius,
    line_termination_keepout_diameter,
    facets
);
