// StepperOnline 23HS40-5004D-E1000 supplier-drawing reference, r1.0.0.
// Drawing inspected 2026-10-12; see assemblies/winch/motor-drawing-check.md.
// https://www.omc-stepperonline.com/image/catalog/dimensions/23HS40-5004D-E1000_Dimension-1.svg
// Units: mm. Mounting face Z=0, shaft -Z, rear cable outlet -Y.
// Undimensioned cap thicknesses, corner contours and outlet width are illustrative.
// Flexible 300 mm leads/connectors are omitted; this is NOT fabrication geometry.

nema23_frame_max_mm = 57.3;
nema23_body_length_mm = 122;
nema23_encoder_length_mm = 22;
nema23_mount_pitch_mm = 47.14;
nema23_mount_hole_mm = 5.1;
nema23_pilot_diameter_mm = 38.1;
nema23_pilot_length_mm = 1.6;
nema23_shaft_diameter_mm = 8;
nema23_shaft_length_mm = 22;
nema23_flat_length_mm = 15;
nema23_flat_section_mm = 7.5;
nema23_outlet_length_mm = 32;
nema23_outlet_drop_mm = 13;

module arbi_nema23_motor(frame_mm=nema23_frame_max_mm,
    body_length_mm=nema23_body_length_mm,
    shaft_length_mm=nema23_shaft_length_mm) {
    epsilon_mm = 0.02;
    front_cap_mm = 8; // Undimensioned; inspect actual flange before choosing bolts.
    rear_cap_mm = 8;
    corner_radius_mm = 1.5;
    stator_chamfer_mm = 14; // Simplified corner relief behind through-hole flange.
    outlet_width_mm = 30; // Undimensioned front-view silhouette.
    encoder_start_mm = body_length_mm-nema23_encoder_length_mm;
    half_mm = frame_mm/2;
    assert(frame_mm >= nema23_mount_pitch_mm+nema23_mount_hole_mm);
    assert(body_length_mm > front_cap_mm+rear_cap_mm+nema23_encoder_length_mm);
    assert(shaft_length_mm >= nema23_flat_length_mm && nema23_flat_section_mm < nema23_shaft_diameter_mm);

    module cap(height_mm) {
        linear_extrude(height_mm)
            offset(r=corner_radius_mm, $fn=32)
                square([frame_mm-2*corner_radius_mm,frame_mm-2*corner_radius_mm],center=true);
    }
    module stator(height_mm) {
        linear_extrude(height_mm) polygon([
            [-half_mm+stator_chamfer_mm,-half_mm],[half_mm-stator_chamfer_mm,-half_mm],
            [half_mm,-half_mm+stator_chamfer_mm],[half_mm,half_mm-stator_chamfer_mm],
            [half_mm-stator_chamfer_mm,half_mm],[-half_mm+stator_chamfer_mm,half_mm],
            [-half_mm,half_mm-stator_chamfer_mm],[-half_mm,-half_mm+stator_chamfer_mm]]);
    }

    union() {
        // Four supplier Ø5.1 THROUGH holes belong to the front mounting flange.
        difference() {
            cap(front_cap_mm);
            for(x=[-nema23_mount_pitch_mm/2,nema23_mount_pitch_mm/2],
                y=[-nema23_mount_pitch_mm/2,nema23_mount_pitch_mm/2])
                translate([x,y,-epsilon_mm]) cylinder(d=nema23_mount_hole_mm,
                    h=front_cap_mm+2*epsilon_mm,$fn=96);
        }
        translate([0,0,front_cap_mm-epsilon_mm])
            stator(encoder_start_mm-rear_cap_mm-front_cap_mm+2*epsilon_mm);
        translate([0,0,encoder_start_mm-rear_cap_mm]) cap(rear_cap_mm+epsilon_mm);
        translate([0,0,encoder_start_mm]) cap(nema23_encoder_length_mm);
        translate([-outlet_width_mm/2,-half_mm-nema23_outlet_drop_mm,
            body_length_mm-nema23_outlet_length_mm])
            cube([outlet_width_mm,nema23_outlet_drop_mm+epsilon_mm,nema23_outlet_length_mm]);
        translate([0,0,-nema23_pilot_length_mm])
            cylinder(d=nema23_pilot_diameter_mm,h=nema23_pilot_length_mm+epsilon_mm,$fn=128);
        difference() {
            translate([0,0,-shaft_length_mm])
                cylinder(d=nema23_shaft_diameter_mm,h=shaft_length_mm+epsilon_mm,$fn=128);
            // P-P 7.5 mm is the remaining section: flat plane Y=7.5-8/2=3.5.
            translate([-nema23_shaft_diameter_mm,
                nema23_flat_section_mm-nema23_shaft_diameter_mm/2,-shaft_length_mm-epsilon_mm])
                cube([2*nema23_shaft_diameter_mm,nema23_shaft_diameter_mm,
                    nema23_flat_length_mm+epsilon_mm]);
        }
    }
}
