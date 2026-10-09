// ARBI compact integrated gimbal r0.1.0, millimetres.
// Concept-unvalidated. The dry bench mounts remain in camera-pod-mounts.scad.
include <camera-pod-mounts.scad>

pg_tilt_y = 3;
pg_tilt_z = -45;
pg_drive_shift = 2;
pg_camera_z_shift = pg_tilt_z+59;
pg_servo_y = pg_tilt_y-5;
pg_lug_inner_x = -24+pg_drive_shift;

module camera_pod_integrated_gimbal_carrier() {
    difference() {
        union() {
            // Preserve the pan horn pocket, crossbeam, support pad and stop.
            // The old vertical servo plate and boot ears are below this cut.
            intersection() {
                camera_pod_pan_yoke();
                pm_box([160,160,70],[0,0],-31.7);
            }
            // Four unchanged M2 attachment axes for the removable outer head.
            for(x=[-8,8]) {
                pm_link([x,10],[x,30.5],7,2.5,-31.7);
                pm_cyl(7,2.5,[x,-30.5,-31.7]);
            }
            // The servo is rolled 90 degrees about its X output axis: its
            // 20 mm body length and 24 mm ear-hole pitch now run along Y.
            pm_box([2.5,33,14],[pg_lug_inner_x-1.25,pg_servo_y],pg_tilt_z-7);
            for(side=[-1,1])let(y=pg_servo_y+14*side,wrap_y=pg_tilt_y+18*side) {
                pm_box([3,5,-27.2-(pg_tilt_z+5.5)],
                    [pg_lug_inner_x-1.5,y],pg_tilt_z+5.5);
                pm_link([pg_lug_inner_x-2.5,0],
                    [pg_lug_inner_x-2.5,wrap_y],5,4.5,-31.7);
                // Carry the left servo plate around the raised tilt envelope.
                pm_link([pg_lug_inner_x-2.5,wrap_y],[-8,wrap_y],5,4.5,-31.7);
            }
        }
        // The original crossbeam crosses the newly raised driven panel. The
        // two ties above reconnect the outboard rail around this swept relief.
        // Extend its inner edge 3 mm for the cradle/horn spline seating path.
        pm_box([10.2,28,12],[-18.9+pg_drive_shift,pg_tilt_y],-31.71);
        for(x=[-8,8],y=[-30.5,30.5])pm_cyl(2.3,7,[x,y,-32]);
        pm_box([4,pm_servo_body[0]+pm_servo_fit,pm_servo_body[1]+pm_servo_fit],
            [pg_lug_inner_x-1.25,pg_servo_y],pg_tilt_z-(pm_servo_body[1]+pm_servo_fit)/2);
        for(y=[pg_servo_y-pm_servo_lug_pitch/2,pg_servo_y+pm_servo_lug_pitch/2]) {
            pm_xcyl(1.9,4,[pg_lug_inner_x-3,y,pg_tilt_z]);
            translate([pg_lug_inner_x+.01,y,pg_tilt_z])rotate([0,-90,0])
                cylinder(d1=3.5,d2=1.9,h=1.11,$fn=PM_FN);
        }
    }
}

module pg_legacy_drive_panel() {
    intersection() {
        camera_pod_camera_cradle();
        pm_box([82.2,100,100],[-58.9,0],-100);
    }
}

module camera_pod_integrated_camera_cradle() {
    translate([0,pg_tilt_y,pg_camera_z_shift])difference() {
        union() {
            difference() {
                camera_pod_camera_cradle();
                pg_legacy_drive_panel();
            }
            // Move the driven panel inward without moving PCB or pivot interfaces.
            // Its lower edge retains 1.2 mm below the nominal 8.6 mm hub pocket.
            translate([pg_drive_shift,0,0])intersection() {
                pg_legacy_drive_panel();
                pm_box([120,100,100],[0,0],-64.5);
            }
        }
        // Recut the complete shifted clamp through the reused frame: unioning
        // the translated panel must not refill the horn pocket or screw tips.
        translate([-21.8+pg_drive_shift,0,-59])rotate([0,-90,0])pm_horn_pocket();
        for(y=[-10,10]) {
            pm_xcyl(2.3,8.22,[-23.01+pg_drive_shift,y,-59]);
            // The same lower washer and nut now sit 2 mm farther into the frame.
            pm_xcyl(5.4,2.4,[-18+pg_drive_shift,y,-59]);
        }
    }
}

module camera_pod_integrated_tilt_pivot_support() {
    difference() {
        union() {
            // Existing two-bolt upper pad; only the leg below it is shortened.
            pm_box([10,22,3],[23,0],-34.7);
            hull() {
                pm_box([3,8,2],[23.5,0],-36.7);
                pm_box([3,8,2],[23.5,pg_tilt_y],pg_tilt_z);
            }
            pm_xcyl(8,3,[22,pg_tilt_y,pg_tilt_z]);
            for(a=[-5-pm_tilt_stop_delta,75+pm_tilt_stop_delta]) {
                yy=pg_tilt_y+10*sin(a);
                zz=pg_tilt_z-10*cos(a);
                hull()for(p=[[pg_tilt_y,pg_tilt_z],[yy,zz]])
                    pm_xcyl(3,3,[22,p[0],p[1]]);
                pm_xcyl(3,3.6,[21.4,yy,zz]);
            }
        }
        for(y=[-7,7])pm_cyl(2.3,4,[23,y,-34.71]);
        pm_xcyl(3.3,5,[21,pg_tilt_y,pg_tilt_z]);
    }
}
