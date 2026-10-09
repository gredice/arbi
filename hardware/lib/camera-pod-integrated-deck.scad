// ARBI compact integrated camera pod deck r0.1.0, millimetres.
// Appearance-led rearrangement; concept-unvalidated. The dry bench deck is separate.
// Assembly frame: spider mid-plane Z=0, fixed electronics above the spider.
include <camera-pod-mounts.scad>

pi_deck_z = 17.5;
pi_deck_thickness = 3;
pi_deck_top = pi_deck_z + pi_deck_thickness;
pi_board_center = [-22,0];
pi_board_mount_x = [pi_board_center[0]-29,pi_board_center[0]+29];
pi_board_mount_y = [-24.5,24.5];
pi_converter_center = [32,0];
pi_converter_rotation = 90;
pi_capacitor_center = [32,-34];
pi_cover_x = [-22,22];
pi_cover_y = [-46,46];
pi_power_port = [10,40];
pi_ribbon_port = [0,-48];
pi_servo_port = [-40,-15];

// Keep the electronics at their existing assembly heights. The four M4 frame
// axes stay at +/-22/sqrt(2); the board's nominal SD socket underside is Z=29.4.
// Converter ties use the old reference rotated 90 degrees about [32,0], placing
// their centre lines at Y=8 and +22, with side slots at X=16 and 48.
module camera_pod_integrated_deck() {
    difference() {
        union() {
            // Open Pi perimeter and four 10 mm board standoffs.
            for(x=pi_board_mount_x)
                pm_link([x,-24.5],[x,24.5],7,pi_deck_thickness,pi_deck_z);
            for(y=pi_board_mount_y)
                pm_link([-51,y],[7,y],7,pi_deck_thickness,pi_deck_z);
            for(x=pi_board_mount_x,y=pi_board_mount_y)
                pm_cyl(6,10,[x,y,pi_deck_top]);

            // Rotated 45 x 25 mm provisional converter envelope. Four pads lift
            // its underside to Z=22.5; there are no assumed converter PCB holes.
            for(x=[16,48])
                pm_link([x,-24.5],[x,25],6,pi_deck_thickness,pi_deck_z);
            for(y=[-24.5,25])
                pm_link([16,y],[48,y],6,pi_deck_thickness,pi_deck_z);
            for(x=[22,42],y=[-20,20]) {
                pm_link([x,y],[x,y<0?-24.5:25],5,pi_deck_thickness,pi_deck_z);
                pm_cyl(5,2,[x,y,pi_deck_top]);
            }

            // Retain the original spider/spacer clamp axes and join both open
            // frames. Avoid a central spine over the fairing tower/nut at X=-40
            // or +40. The rear ribbon pad clears the [0,-36] screw tip by 0.3 mm.
            for(x=[-pm_mount_xy,pm_mount_xy],y=[-pm_mount_xy,pm_mount_xy]) {
                pm_cyl(10,pi_deck_thickness,[x,y,pi_deck_z]);
                if(x<0)
                    pm_link([x,y],[x,y<0?-24.5:24.5],6,pi_deck_thickness,pi_deck_z);
                else
                    pm_link([7,y],[16,y],6,pi_deck_thickness,pi_deck_z);
            }

            // Capacitor rests at Z=23.5 inside a loose 10.6 mm cup. Two separate
            // slots carry the nominal strap; leads pass through the central bore.
            pm_link([32,-24.5],pi_capacitor_center,14,pi_deck_thickness,pi_deck_z);
            pm_cyl(13.4,9,[pi_capacitor_center[0],pi_capacitor_center[1],pi_deck_top]);
            pm_link([23,-34],[41,-34],6,pi_deck_thickness,pi_deck_z);

            // Hood + deck + tray share four bottom-up M3 clamp stacks.
            for(x=pi_cover_x,y=pi_cover_y) {
                pm_cyl(8,pi_deck_thickness,[x,y,pi_deck_z]);
                pm_link([x,y],[x,y<0?-24.5:25],5,pi_deck_thickness,pi_deck_z);
            }

            // Rear CSI passage lies between the hood columns and clear of the
            // spider. Two bridges join its pad to the Pi frame without crossing
            // the passage. Soft wraps stay on the Pi side of the opening, with
            // 3.1 mm outer webs. The servo outlet at [-40,-15] is in an open bay.
            pm_box([26,20,pi_deck_thickness],[0,-44],pi_deck_z);
            for(x=[-9,7])
                pm_link([x,-34],[x,-24.5],6,pi_deck_thickness,pi_deck_z);
            // Sleeved incoming wire restraint, never a positioning-line anchor.
            pm_link([29,25],[29,42],9,pi_deck_thickness,pi_deck_z);
        }

        for(x=[-pm_mount_xy,pm_mount_xy],y=[-pm_mount_xy,pm_mount_xy])
            pm_hole(4.5,pi_deck_thickness+2*PM_EPS,[x,y,pi_deck_z-PM_EPS]);
        for(x=pi_board_mount_x,y=pi_board_mount_y)
            pm_hole(2.9,14,[x,y,pi_deck_z-PM_EPS]);
        for(x=pi_cover_x,y=pi_cover_y)
            pm_hole(3.3,pi_deck_thickness+2*PM_EPS,[x,y,pi_deck_z-PM_EPS]);

        for(x=[16,48],y=[8,22])
            pm_box([2,3.2,pi_deck_thickness+2*PM_EPS],[x,y],pi_deck_z-PM_EPS);
        pm_cyl(10.6,6+PM_EPS,[pi_capacitor_center[0],pi_capacitor_center[1],23.5]);
        pm_cyl(6.2,6+2*PM_EPS,[pi_capacitor_center[0],pi_capacitor_center[1],pi_deck_z-PM_EPS]);
        for(x=[23,41])
            pm_box([1.8,3.2,pi_deck_thickness+2*PM_EPS],[x,-34],pi_deck_z-PM_EPS);

        pm_box([18.8,4.8,pi_deck_thickness+2*PM_EPS],pi_ribbon_port,pi_deck_z-PM_EPS);
        for(x=[-9,9])
            pm_box([1.8,3.2,pi_deck_thickness+2*PM_EPS],[x,-39],pi_deck_z-PM_EPS);
        for(y=[34,40])
            pm_box([3.2,1.8,pi_deck_thickness+2*PM_EPS],[29,y],pi_deck_z-PM_EPS);
    }
}
