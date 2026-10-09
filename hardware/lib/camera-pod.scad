// ARBI camera-pod family 0.1.0 — concept-unvalidated.
// Canonical units are millimetres. Shared by camera pod fabrication and assembly entrypoints.
// COTS envelopes are starting published dimensions, not measured parts.

include <arbi.scad>

// Spider 0.1.0 interface. Changing these is a physical compatibility break.
cp_arm_span = 230;
cp_arm_width = 22;
cp_plate_thickness = 7;
cp_hub_diameter = 54;
cp_service_hole_diameter = 18;
cp_line_hole_diameter = 6;
cp_pod_mount_radius = 22;
cp_pod_mount_hole_diameter = 4.5;
cp_pod_mount_phase = 45;
cp_facets = 96;

// Raspberry Pi 3A+ mechanical drawing RPI-3A+_V1-0: 65 x 56 mm board, 58 x 49 mm hole centres.
cp_pi_board = [65, 56];
cp_pi_hole_spacing = [58, 49];
cp_pi_hole_clearance = 3.2;
cp_pi_standoff_height = 6;
cp_pi_standoff_od = 6.5;
cp_pi_offset = [42, 0];

// Camera Module 3 Standard product brief: 25 x 24 x 11.5 mm. Hole positions match Camera Module 2.
cp_camera_board = [25, 24];
cp_camera_hole_spacing = [21, 12.5];
cp_camera_hole_clearance = 2.3;
cp_camera_stack_height = 11.5;

// 3.7 g class starting envelope from GH-S37D-style 20 x 8.75 x 22 mm listings.
// 23.5 mm tab-hole span is a similar-class starting value, not the purchased-unit drawing.
cp_servo_body = [20, 8.75, 16];
cp_servo_hole_spacing = 23.5;
cp_servo_hole_clearance = 2.0;
cp_servo_clearance = 0.45;

cp_electronics_size = [152, 92, 3];
cp_electronics_radius = 10;
cp_converter_offset = [-42, 20];
cp_converter_pocket = [52, 28];
cp_capacitor_offset = [-42, -22];
cp_capacitor_diameter = 12.5;
cp_capacitor_spacing = 16;

cp_stud_flange_diameter = 54;
cp_stud_flange_thickness = 4;
cp_stud_stem_diameter = 14;
cp_stud_stem_height = 28;
cp_stud_head_diameter = 24;
cp_stud_head_height = 6;
cp_stud_flare_height = 5;

cp_relief_length = 28;
cp_relief_outer_width = 27;
cp_relief_outer_height = 13;
cp_relief_inner_width = 22.6;
cp_relief_inner_height = 7.6;

cp_gimbal_flange_diameter = 54;
cp_gimbal_flange_thickness = 3;
cp_horn_centre_clearance = 4.4;
cp_horn_screw_clearance = 1.6;
cp_horn_screw_span = 8;
cp_yoke_inner = 34;
cp_yoke_wall = 4;
cp_yoke_leg_height = 28;
cp_yoke_top_thickness = 3;
cp_yoke_width = 18;
cp_rain_cap_od = 58;
cp_rain_cap_height = 18;
cp_rain_cap_wall = 2.4;
cp_rain_cap_lug_span = 36;
cp_hood_height = 10;
cp_hood_wall = 1.6;

function cp_line_hole_radius() = cp_arm_span / 2 - cp_arm_width / 2;

module cp_checks() {
    assert(cp_arm_span > 2 * cp_arm_width, "Spider arms need useful span beyond the hub.");
    assert(cp_plate_thickness > 0, "Spider thickness must be positive.");
    assert(cp_hub_diameter >= 2 * cp_arm_width, "Hub must overlap both crossing arms.");
    assert(cp_service_hole_diameter < cp_hub_diameter, "Service hole must remain within the hub.");
    assert(
        cp_pod_mount_radius + cp_pod_mount_hole_diameter / 2 < cp_hub_diameter / 2,
        "Pod mount holes must remain within the hub."
    );
    assert(
        cp_electronics_size[0] <= 170 && cp_electronics_size[1] <= 125,
        "Electronics mount must remain inside the committed 170 x 125 mm body envelope."
    );
    assert(cp_stud_head_diameter < 28, "Stud head must pass the 28 mm nest latch opening.");
    assert(cp_stud_head_diameter > cp_stud_stem_diameter, "Mushroom head must exceed the stem.");
    assert(
        cp_pi_hole_spacing[0] < cp_pi_board[0] && cp_pi_hole_spacing[1] < cp_pi_board[1],
        "Pi hole pattern must remain on the board."
    );
    children();
}

module cp_pod_mount_holes(height) {
    arbi_bolt_circle(
        4,
        cp_pod_mount_radius,
        cp_pod_mount_hole_diameter,
        height,
        cp_pod_mount_phase,
        cp_facets
    );
}

module cp_pi_hole_layout() {
    for (x = [-cp_pi_hole_spacing[0] / 2, cp_pi_hole_spacing[0] / 2])
        for (y = [-cp_pi_hole_spacing[1] / 2, cp_pi_hole_spacing[1] / 2])
            translate([cp_pi_offset[0] + x, cp_pi_offset[1] + y, 0])
                children();
}

module cp_camera_holes(height) {
    for (x = [-cp_camera_hole_spacing[0] / 2, cp_camera_hole_spacing[0] / 2])
        for (y = [-cp_camera_hole_spacing[1] / 2, cp_camera_hole_spacing[1] / 2])
            translate([x, y, 0])
                cylinder(d = cp_camera_hole_clearance, h = height, center = true, $fn = 24);
}

module cp_horn_holes(height) {
    cylinder(d = cp_horn_centre_clearance, h = height, center = true, $fn = 32);
    for (x = [-cp_horn_screw_span / 2, cp_horn_screw_span / 2])
        translate([x, 0, 0])
            cylinder(d = cp_horn_screw_clearance, h = height, center = true, $fn = 20);
}

module camera_pod_spider(
    arm_span = cp_arm_span,
    arm_width = cp_arm_width,
    plate_thickness = cp_plate_thickness,
    hub_diameter = cp_hub_diameter,
    service_hole_diameter = cp_service_hole_diameter,
    line_hole_diameter = cp_line_hole_diameter,
    pod_mount_radius = cp_pod_mount_radius,
    pod_mount_hole_diameter = cp_pod_mount_hole_diameter,
    facets = cp_facets
) {
    line_hole_radius = arm_span / 2 - arm_width / 2;

    assert(arm_span > 2 * arm_width, "Spider arms need useful span beyond the hub.");
    assert(plate_thickness > 0, "Spider thickness must be positive.");
    assert(hub_diameter >= 2 * arm_width, "Hub must overlap both crossing arms.");
    assert(service_hole_diameter < hub_diameter, "Service hole must remain within the hub.");
    assert(
        pod_mount_radius + pod_mount_hole_diameter / 2 < hub_diameter / 2,
        "Pod mount holes must remain within the hub."
    );

    difference() {
        union() {
            for (angle = [45, -45])
                rotate([0, 0, angle])
                    arbi_capsule_bar(arm_span, arm_width, plate_thickness, true, facets);

            cylinder(d = hub_diameter, h = plate_thickness, center = true, $fn = facets);
        }

        cylinder(
            d = service_hole_diameter,
            h = plate_thickness + 2 * ARBI_EPSILON,
            center = true,
            $fn = facets
        );

        arbi_bolt_circle(
            4,
            pod_mount_radius,
            pod_mount_hole_diameter,
            plate_thickness + 2 * ARBI_EPSILON,
            45,
            facets
        );

        for (angle = [45, 135, 225, 315])
            rotate([0, 0, angle])
                translate([line_hole_radius, 0, 0])
                    cylinder(
                        d = line_hole_diameter,
                        h = plate_thickness + 2 * ARBI_EPSILON,
                        center = true,
                        $fn = facets
                    );
    }
}

module camera_pod_electronics_mount() {
    size = cp_electronics_size;
    thickness = size[2];

    cp_checks()
        difference() {
            union() {
                translate([0, 0, thickness / 2])
                    arbi_rounded_box(size, cp_electronics_radius, true, cp_facets);

                cp_pi_hole_layout()
                    cylinder(
                        d = cp_pi_standoff_od,
                        h = thickness + cp_pi_standoff_height,
                        $fn = 32
                    );

                translate([cp_converter_offset[0], cp_converter_offset[1], thickness + 1.2])
                    difference() {
                        cube(
                            [cp_converter_pocket[0] + 4, cp_converter_pocket[1] + 4, 2.4],
                            center = true
                        );
                        cube(
                            [cp_converter_pocket[0], cp_converter_pocket[1], 2.6],
                            center = true
                        );
                    }

                for (dx = [-cp_capacitor_spacing / 2, cp_capacitor_spacing / 2])
                    translate([cp_capacitor_offset[0] + dx, cp_capacitor_offset[1], thickness])
                        difference() {
                            cylinder(d = cp_capacitor_diameter + 4, h = 8, $fn = 32);
                            translate([0, 0, 2])
                                cylinder(d = cp_capacitor_diameter + 0.4, h = 8, $fn = 32);
                            translate([0, -8, 6])
                                cube([cp_capacitor_diameter + 6, 12, 12], center = true);
                        }
            }

            translate([0, 0, thickness / 2])
                cylinder(
                    d = cp_service_hole_diameter,
                    h = thickness + 2 * ARBI_EPSILON,
                    center = true,
                    $fn = cp_facets
                );

            translate([0, 0, thickness / 2])
                cp_pod_mount_holes(thickness + 2 * ARBI_EPSILON);

            cp_pi_hole_layout()
                translate([0, 0, -ARBI_EPSILON])
                    cylinder(
                        d = cp_pi_hole_clearance,
                        h = thickness + cp_pi_standoff_height + 2 * ARBI_EPSILON,
                        $fn = 24
                    );

            translate([cp_converter_offset[0], cp_converter_offset[1], thickness / 2])
                for (x = [-18, 18])
                    for (y = [-8, 8])
                        translate([x, y, 0])
                            cylinder(
                                d = 3.2,
                                h = thickness + 2 * ARBI_EPSILON,
                                center = true,
                                $fn = 20
                            );

            for (x = [-22, 22])
                translate([x, 30, thickness / 2])
                    cylinder(d = 4, h = thickness + 2 * ARBI_EPSILON, center = true, $fn = 20);

            translate([0, size[1] / 2, thickness / 2])
                cube([16, 10, thickness + 2 * ARBI_EPSILON], center = true);
        }
}

module camera_pod_docking_stud() {
    flange_z = cp_stud_flange_thickness;
    stem_top = flange_z + cp_stud_stem_height;
    flare_top = stem_top + cp_stud_flare_height;

    cp_checks()
        difference() {
            union() {
                cylinder(d = cp_stud_flange_diameter, h = flange_z, $fn = cp_facets);
                translate([0, 0, flange_z])
                    cylinder(d = cp_stud_stem_diameter, h = cp_stud_stem_height, $fn = cp_facets);
                translate([0, 0, stem_top])
                    cylinder(
                        d1 = cp_stud_stem_diameter,
                        d2 = cp_stud_head_diameter,
                        h = cp_stud_flare_height,
                        $fn = cp_facets
                    );
                translate([0, 0, flare_top])
                    cylinder(d = cp_stud_head_diameter, h = cp_stud_head_height, $fn = cp_facets);
            }

            translate([0, 0, flange_z / 2])
                cp_pod_mount_holes(flange_z + 2 * ARBI_EPSILON);
        }
}

module camera_pod_line_strain_relief() {
    height = cp_relief_outer_height;

    cp_checks()
        difference() {
            union() {
                translate([2, 0, height / 2])
                    arbi_capsule_bar(
                        cp_relief_length,
                        cp_relief_outer_width,
                        height,
                        true,
                        cp_facets
                    );

                translate([0, cp_relief_outer_width / 2 + 2, height / 2])
                    cube([10, 8, 10], center = true);
            }

            translate([6, 0, height / 2])
                arbi_capsule_bar(
                    cp_relief_length + 4,
                    cp_relief_inner_width,
                    cp_relief_inner_height,
                    true,
                    cp_facets
                );

            translate([0, 0, height / 2])
                cylinder(
                    d = cp_line_hole_diameter,
                    h = height + 2 * ARBI_EPSILON,
                    center = true,
                    $fn = cp_facets
                );

            translate([0, 0, height - 2.2])
                cylinder(
                    d1 = cp_line_hole_diameter,
                    d2 = 10,
                    h = 2.2 + ARBI_EPSILON,
                    $fn = cp_facets
                );

            translate([0, 0, -ARBI_EPSILON])
                cylinder(
                    d1 = 10,
                    d2 = cp_line_hole_diameter,
                    h = 2.2 + ARBI_EPSILON,
                    $fn = cp_facets
                );

            translate([0, cp_relief_outer_width / 2 + 2, height / 2])
                rotate([90, 0, 0])
                    cylinder(d = 4, h = 12, center = true, $fn = 32);
        }
}

module camera_gimbal_base() {
    flange = cp_gimbal_flange_thickness;
    cradle_h = cp_servo_body[2] + 6;
    cradle_size = [30, 22, cradle_h];
    cradle_x = 16;

    cp_checks()
        difference() {
            union() {
                cylinder(d = cp_gimbal_flange_diameter, h = flange, $fn = cp_facets);
                translate([cradle_x, 0, flange + cradle_h / 2])
                    cube(cradle_size, center = true);
            }

            translate([0, 0, flange / 2])
                cylinder(
                    d = cp_service_hole_diameter,
                    h = flange + 2 * ARBI_EPSILON,
                    center = true,
                    $fn = cp_facets
                );

            translate([0, 0, flange / 2])
                cp_pod_mount_holes(flange + 2 * ARBI_EPSILON);

            translate([cradle_x, 0, flange + 2 + cradle_h / 2])
                cube(
                    [
                        cp_servo_body[0] + 2 * cp_servo_clearance,
                        cp_servo_body[1] + 2 * cp_servo_clearance,
                        cradle_h
                    ],
                    center = true
                );

            for (x = [-cp_servo_hole_spacing / 2, cp_servo_hole_spacing / 2])
                translate([cradle_x + x, 0, flange + cp_servo_body[2] + 3])
                    rotate([90, 0, 0])
                        cylinder(d = cp_servo_hole_clearance, h = 26, center = true, $fn = 24);

            translate([cradle_x + 13, 0, flange + 6])
                cube([8, 4, 8], center = true);

            for (y = [-cp_rain_cap_lug_span / 2, cp_rain_cap_lug_span / 2])
                translate([0, y, flange / 2])
                    cylinder(d = 2.3, h = flange + 2 * ARBI_EPSILON, center = true, $fn = 20);
        }
}

module camera_gimbal_yoke() {
    inner = cp_yoke_inner;
    wall = cp_yoke_wall;
    top = cp_yoke_top_thickness;
    leg = cp_yoke_leg_height;
    width = cp_yoke_width;
    thick = 12;
    servo_z = top + 16;

    cp_checks()
        difference() {
            union() {
                translate([0, 0, top / 2])
                    cube([width, inner + 2 * wall, top], center = true);

                translate([0, -(inner / 2 + wall / 2), top + leg / 2])
                    cube([width, wall, leg], center = true);

                translate([0, inner / 2 + thick / 2, top + leg / 2])
                    cube([width, thick, leg], center = true);
            }

            translate([0, 0, top / 2])
                cp_horn_holes(top + 2 * ARBI_EPSILON);

            translate([0, inner / 2 + 5, servo_z])
                cube(
                    [
                        cp_servo_body[1] + 2 * cp_servo_clearance,
                        14,
                        cp_servo_body[0] + 2 * cp_servo_clearance
                    ],
                    center = true
                );

            for (zoff = [-cp_servo_hole_spacing / 2, cp_servo_hole_spacing / 2])
                translate([0, inner / 2 + 5, servo_z + zoff])
                    rotate([0, 90, 0])
                        cylinder(d = cp_servo_hole_clearance, h = 30, center = true, $fn = 24);

            translate([0, -(inner / 2 + wall / 2), servo_z])
                rotate([90, 0, 0])
                    cylinder(d = 3.2, h = wall + 2, center = true, $fn = 24);
        }
}

module camera_gimbal_camera_plate() {
    plate = [30, 28, 2.6];
    flange_h = 12;
    lug = 6;

    cp_checks()
        difference() {
            union() {
                translate([0, 0, plate[2] / 2])
                    cube(plate, center = true);

                translate([0, plate[1] / 2 - 1.3, (plate[2] + flange_h) / 2])
                    cube([plate[0], 2.6, plate[2] + flange_h], center = true);

                translate([0, -plate[1] / 2 - lug / 2 + 1, (plate[2] + 10) / 2])
                    cube([12, lug, plate[2] + 10], center = true);
            }

            translate([0, -1, plate[2] / 2])
                cp_camera_holes(plate[2] + 2 * ARBI_EPSILON);

            translate([0, -1, plate[2] - 0.35])
                cube(
                    [cp_camera_board[0] + 0.4, cp_camera_board[1] + 0.4, 0.8],
                    center = true
                );

            translate([0, plate[1] / 2 - 1.3, plate[2] + 8])
                rotate([90, 0, 0])
                    cp_horn_holes(6);

            translate([0, -plate[1] / 2 - lug / 2 + 1, plate[2] + 8])
                rotate([90, 0, 0])
                    cylinder(d = 3.2, h = lug + 2, center = true, $fn = 24);
        }
}

module camera_gimbal_rain_cap() {
    od = cp_rain_cap_od;
    height = cp_rain_cap_height;
    wall = cp_rain_cap_wall;

    cp_checks()
        difference() {
            union() {
                cylinder(d = od, h = height, $fn = cp_facets);

                for (y = [-cp_rain_cap_lug_span / 2, cp_rain_cap_lug_span / 2])
                    translate([0, y, wall / 2])
                        cube([12, 8, wall], center = true);
            }

            translate([0, 0, wall])
                cylinder(d = od - 2 * wall, h = height, $fn = cp_facets);

            for (angle = [0, 180])
                rotate([0, 0, angle])
                    translate([od / 2 - 2, 0, height - 2])
                        cube([8, 6, 6], center = true);

            for (y = [-cp_rain_cap_lug_span / 2, cp_rain_cap_lug_span / 2])
                translate([0, y, wall / 2])
                    cylinder(d = 2.3, h = wall + 2 * ARBI_EPSILON, center = true, $fn = 20);
        }
}

module camera_gimbal_optical_hood() {
    inner = [cp_camera_board[0] + 0.8, cp_camera_board[1] + 0.8];
    wall = cp_hood_wall;
    height = cp_hood_height;

    cp_checks()
        difference() {
            translate([0, 0, height / 2])
                cube([inner[0] + 2 * wall, inner[1] + 2 * wall, height], center = true);
            translate([0, 0, height / 2])
                cube([inner[0], inner[1], height + 2 * ARBI_EPSILON], center = true);
        }
}

module camera_pod_legacy_assembly(show_context = false) {
    color(ARBI_CORE)camera_pod_spider();

    translate([0, 0, cp_plate_thickness / 2])
        color(ARBI_CORE)camera_pod_electronics_mount();

    translate([0, 0, cp_plate_thickness / 2 + cp_electronics_size[2]])
        color(ARBI_CORE)camera_pod_docking_stud();

    for (angle = [45, 135, 225, 315])
        rotate([0, 0, angle])
            translate([cp_line_hole_radius(), 0, -cp_relief_outer_height / 2])
                color(ARBI_CORE)camera_pod_line_strain_relief();

    translate([0, 0, -cp_plate_thickness / 2])
        rotate([180, 0, 0]) {
            color(ARBI_CORE)camera_gimbal_base();
            translate([0, 0, cp_gimbal_flange_thickness + 1])
                color(ARBI_SHELL)camera_gimbal_rain_cap();
            translate([0, 0, cp_gimbal_flange_thickness + 22])
                color(ARBI_CORE)camera_gimbal_yoke();
            translate([0, 0, cp_gimbal_flange_thickness + 50])
                color(ARBI_CORE)camera_gimbal_camera_plate();
            translate([0, 0, cp_gimbal_flange_thickness + 53])
                color(ARBI_CORE)camera_gimbal_optical_hood();
        }

    if (show_context) {
        color([0.15, 0.55, 0.2, 0.4])
            translate([
                cp_pi_offset[0],
                cp_pi_offset[1],
                cp_plate_thickness / 2 + cp_electronics_size[2] + cp_pi_standoff_height + 1
            ])
                cube([cp_pi_board[0], cp_pi_board[1], 2], center = true);
    }
}
