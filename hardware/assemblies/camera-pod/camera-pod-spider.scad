// ARBI camera pod spider 0.1.0 — concept-unvalidated.
// Canonical source in millimetres. Line terminations and load capacity are unresolved.

include <../../lib/arbi.scad>

arm_span = 230;
arm_width = 22;
plate_thickness = 7;
hub_diameter = 54;
service_hole_diameter = 18;
line_hole_diameter = 6;
pod_mount_radius = 22;
pod_mount_hole_diameter = 4.5;
facets = 96;

module camera_pod_spider(
    arm_span,
    arm_width,
    plate_thickness,
    hub_diameter,
    service_hole_diameter,
    line_hole_diameter,
    pod_mount_radius,
    pod_mount_hole_diameter,
    facets
) {
    line_hole_radius = arm_span / 2 - arm_width / 2;

    assert(arm_span > 2 * arm_width, "Spider arms need useful span beyond the hub.");
    assert(plate_thickness > 0, "Spider thickness must be positive.");
    assert(hub_diameter >= 2 * arm_width, "Hub must overlap both crossing arms.");
    assert(service_hole_diameter < hub_diameter, "Service hole must remain within the hub.");
    assert(pod_mount_radius + pod_mount_hole_diameter / 2 < hub_diameter / 2, "Pod mount holes must remain within the hub.");

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

camera_pod_spider(
    arm_span,
    arm_width,
    plate_thickness,
    hub_diameter,
    service_hole_diameter,
    line_hole_diameter,
    pod_mount_radius,
    pod_mount_hole_diameter,
    facets
);
