// ARBI camera-pod-assembly r0.3.5 — concept-unvalidated reference. Do not print.
include <../../lib/camera-pod.scad>
include <../../lib/camera-pod-enclosure.scad>
include <../../lib/camera-pod-integrated-gimbal.scad>
use <../../lib/camera-pod-integrated-deck.scad>
use <../../lib/camera-pod-integrated-head.scad>
use <camera-pod-spider.scad>
show_legacy = false;
show_context = false;
pan = 0;
tilt = 0;
show_hood = true;
module camera_pod_assembly(pan=0,tilt=0,show_hood=true) {
    assert(pan >= -95 && pan <= 95,"Outside nominal mechanical pan limits");
    assert(tilt >= -5 && tilt <= 75,"Outside nominal mechanical tilt limits");
    color(ARBI_CORE) {
        camera_pod_spider(230,22,7,54,18,6,22,4.5,96);
        camera_pod_integrated_deck();
        for(x=[-pm_mount_xy,pm_mount_xy],y=[-pm_mount_xy,pm_mount_xy])
            translate([x,y,3.5])camera_pod_spider_spacer();
        camera_pod_pan_servo_mount();
        camera_pod_enclosure_base();
    }
    if(show_hood)color(ARBI_SHELL)camera_pod_rain_hood();
    rotate([0,0,pan]) {
        color(ARBI_CORE) {
            camera_pod_integrated_gimbal_head();
            camera_pod_integrated_gimbal_carrier();
            camera_pod_integrated_tilt_pivot_support();
            translate([0,0,-27.2])camera_pod_horn_retainer();
        }
        translate([0,pg_tilt_y,pg_tilt_z])rotate([tilt,0,0])translate([0,-pg_tilt_y,-pg_tilt_z]) {
            color(ARBI_CORE) {
                camera_pod_integrated_camera_cradle();
                translate([-21.8+pg_drive_shift,pg_tilt_y,pg_tilt_z])rotate([0,-90,0])camera_pod_horn_retainer();
            }
            color(ARBI_SHELL)translate([0,pg_tilt_y-5,pg_tilt_z-17.52])camera_pod_integrated_camera_hood();
        }
    }
}
if (show_legacy) camera_pod_legacy_assembly(show_context);
else camera_pod_assembly(pan,tilt,show_hood);
