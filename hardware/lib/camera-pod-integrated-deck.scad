// ARBI compact integrated camera pod deck r0.2.0, millimetres.
// Appearance-led rearrangement; concept-unvalidated. The dry bench deck is separate.
// Assembly frame: spider mid-plane Z=0, fixed electronics above the spider.
include <camera-pod-mounts.scad>

pi_deck_z = 17.5;
pi_deck_thickness = 3;
pi_deck_top = pi_deck_z + pi_deck_thickness;
pi_board_center = [-22,0];
pi_board_mount_x = [pi_board_center[0]-29,pi_board_center[0]+29];
pi_board_mount_y = [-24.5,24.5];
pi_converter_center = [35,0];
pi_converter_rotation = 90;
pi_capacitor_center = [32,-34];
pi_cover_x = [-22,22];
pi_cover_y = [-46,46];
pi_power_port = [10,40];
pi_ribbon_port = [0,-48];
pi_servo_port = [-40,-15];

// 24 facets retain at least 0.27 mm diametral M3 bore clearance while
// bounding the CGAL cost of the additional captive pockets and posts.
module pd_cyl(d,h,p=[0,0,0]) {
    translate(p)cylinder(d=d,h=h,$fn=24);
}
module pd_link(a,b,w,h,z) {
    hull()for(p=[a,b])pd_cyl(w,h,[p[0],p[1],z]);
}

// Keep the electronics at their existing assembly heights. The four M3 frame
// axes stay at +/-22/sqrt(2); the board's nominal SD socket underside is Z=29.4.
// Received converter rotated 90 degrees: four screws at X=23/47, Y=+/-22.5.
module camera_pod_integrated_deck() {
    difference() {
        union() {
            // Open Pi perimeter and four 10 mm board standoffs.
            for(x=pi_board_mount_x)
                pd_link([x,-24.5],[x,24.5],7,pi_deck_thickness,pi_deck_z);
            for(y=pi_board_mount_y)
                pd_link([-51,y],[7,y],7,pi_deck_thickness,pi_deck_z);
            for(x=pi_board_mount_x,y=pi_board_mount_y)
                pd_cyl(8,10,[x,y,pi_deck_top]);

            // Rotated 50 x 30 mm received converter. Four screw pads lift its
            // underside to Z=22.5; no retention crosses populated PCB areas.
            for(x=[16,48])
                pd_link([x,-24.5],[x,25],6,pi_deck_thickness,pi_deck_z);
            for(y=[-24.5,25])
                pd_link([16,y],[48,y],6,pi_deck_thickness,pi_deck_z);
            for(p=bc_holes()) let(x=pi_converter_center[0]-p[1],y=p[0]) {
                pd_link([x,y],[x,y<0?-24.5:25],5,pi_deck_thickness,pi_deck_z);
                pd_cyl(8,pi_deck_thickness,[x,y,pi_deck_z]);
                pd_cyl(5,2,[x,y,pi_deck_top]);
            }

            // Retain the original spider/spacer clamp axes and join both open
            // frames. Avoid a central spine over the fairing tower/nut at X=-40
            // or +40. The rear ribbon pad clears the [0,-36] screw tip by 0.3 mm.
            for(x=[-pm_mount_xy,pm_mount_xy],y=[-pm_mount_xy,pm_mount_xy]) {
                pd_cyl(10,pi_deck_thickness,[x,y,pi_deck_z]);
                // Integral 14 mm posts replace four loose spacers. Captive
                // nuts below the deck make M3 x 25 fit without lowering it.
                pd_cyl(10,14,[x,y,3.5]);
                if(x<0)
                    pd_link([x,y],[x,y<0?-24.5:24.5],6,pi_deck_thickness,pi_deck_z);
                else
                    pd_link([7,y],[16,y],6,pi_deck_thickness,pi_deck_z);
            }

            // Capacitor rests at Z=23.5 inside a loose 10.6 mm cup. Two separate
            // slots carry the nominal strap; leads pass through the central bore.
            pd_link([32,-24.5],pi_capacitor_center,14,pi_deck_thickness,pi_deck_z);
            pd_cyl(13.4,9,[pi_capacitor_center[0],pi_capacitor_center[1],pi_deck_top]);
            pd_link([23,-34],[41,-34],6,pi_deck_thickness,pi_deck_z);

            // Hood + deck + tray share four bottom-up M3 clamp stacks.
            for(x=pi_cover_x,y=pi_cover_y) {
                pd_cyl(8,pi_deck_thickness,[x,y,pi_deck_z]);
                pd_link([x,y],[x,y<0?-24.5:25],5,pi_deck_thickness,pi_deck_z);
            }

            // Rear CSI passage lies between the hood columns and clear of the
            // spider. Two bridges join its pad to the Pi frame without crossing
            // the passage. Soft wraps stay on the Pi side of the opening, with
            // 3.1 mm outer webs. The servo outlet at [-40,-15] is in an open bay.
            pm_box([26,20,pi_deck_thickness],[0,-44],pi_deck_z);
            for(x=[-9,7])
                pd_link([x,-34],[x,-24.5],6,pi_deck_thickness,pi_deck_z);
            // Sleeved incoming wire restraint, never a positioning-line anchor.
            pd_link([29,25],[29,42],9,pi_deck_thickness,pi_deck_z);
        }

        for(x=[-pm_mount_xy,pm_mount_xy],y=[-pm_mount_xy,pm_mount_xy]) {
            pd_cyl(3.3,17.1,[x,y,3.49]);
            translate([x,y,13.2])cylinder(d=5.8/cos(30),h=2.7,$fn=6);
            pd_cyl(7.4,.5,[x,y,12.7]);
            // Each channel opens radially inward for nut/washer preloading.
            translate([x,y,12.7])rotate([0,0,atan2(y,x)+180])
                translate([0,-3.7,0])cube([8,7.4,3.2]);
        }
        for(x=pi_board_mount_x,y=pi_board_mount_y) {
            pd_cyl(2.3,14,[x,y,pi_deck_z-PM_EPS]);
            translate([x,y,25.3])cylinder(d=4.4/cos(30),h=2.1,$fn=6);
            pd_cyl(5.4,.3,[x,y,27.1]);
            pm_box([8,5.4,2.1],[x+(x<pi_board_center[0]?4:-4),y],25.3);
        }
        for(x=pi_cover_x,y=pi_cover_y)
            pd_cyl(3.3,pi_deck_thickness+2*PM_EPS,[x,y,pi_deck_z-PM_EPS]);

        for(p=bc_holes()) let(x=pi_converter_center[0]-p[1],y=p[0]) {
            pd_cyl(2.3,pi_deck_thickness+2+2*PM_EPS,[x,y,pi_deck_z-PM_EPS]);
            // Bottom-open pocket seats the M2 washer at Z19.1-19.4 and
            // nut at Z17.5-19.1. The unchanged PCB accepts an M2 x 8 screw.
            pd_cyl(5.4,1.9+PM_EPS,[x,y,pi_deck_z-PM_EPS]);
        }
        pd_cyl(10.6,6+PM_EPS,[pi_capacitor_center[0],pi_capacitor_center[1],23.5]);
        pd_cyl(6.2,6+2*PM_EPS,[pi_capacitor_center[0],pi_capacitor_center[1],pi_deck_z-PM_EPS]);
        for(x=[23,41])
            pm_box([1.8,3.2,pi_deck_thickness+2*PM_EPS],[x,-34],pi_deck_z-PM_EPS);

        pm_box([18.8,4.8,pi_deck_thickness+2*PM_EPS],pi_ribbon_port,pi_deck_z-PM_EPS);
        for(x=[-9,9])
            pm_box([1.8,3.2,pi_deck_thickness+2*PM_EPS],[x,-39],pi_deck_z-PM_EPS);
        for(y=[34,40])
            pm_box([3.2,1.8,pi_deck_thickness+2*PM_EPS],[29,y],pi_deck_z-PM_EPS);
    }
}
