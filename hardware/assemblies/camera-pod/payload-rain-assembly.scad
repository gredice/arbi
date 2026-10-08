// ARBI payload-rain-assembly r0.2.4 — concept-unvalidated reference. Do not print.
include <../../lib/payload-enclosure.scad>
include <../../lib/payload-integrated-gimbal.scad>
use <../../lib/payload-integrated-deck.scad>
use <../../lib/payload-integrated-head.scad>
use <camera-pod-spider.scad>
pan = 0;
tilt = 0;
show_hood = true;
module payload_rain_assembly(pan=0,tilt=0,show_hood=true) {
    assert(pan >= -95 && pan <= 95,"Outside nominal mechanical pan limits");
    assert(tilt >= -5 && tilt <= 75,"Outside nominal mechanical tilt limits");
    color(ARBI_CORE) {
        camera_pod_spider(230,22,7,54,18,6,22,4.5,96);
        payload_integrated_deck();
        for(x=[-pm_mount_xy,pm_mount_xy],y=[-pm_mount_xy,pm_mount_xy])
            translate([x,y,3.5])payload_spider_spacer();
        payload_pan_servo_mount();
        payload_enclosure_base();
    }
    if(show_hood)color(ARBI_SHELL)payload_rain_hood();
    rotate([0,0,pan]) {
        color(ARBI_CORE) {
            payload_integrated_gimbal_head();
            payload_integrated_gimbal_carrier();
            payload_integrated_tilt_pivot_support();
            translate([0,0,-27.2])payload_horn_retainer();
        }
        translate([0,pg_tilt_y,pg_tilt_z])rotate([tilt,0,0])translate([0,-pg_tilt_y,-pg_tilt_z]) {
            color(ARBI_CORE) {
                payload_integrated_camera_cradle();
                translate([-21.8+pg_drive_shift,pg_tilt_y,pg_tilt_z])rotate([0,-90,0])payload_horn_retainer();
            }
            color(ARBI_SHELL)translate([0,pg_tilt_y-5,pg_tilt_z-17.52])payload_integrated_camera_hood();
        }
    }
}
payload_rain_assembly(pan,tilt,show_hood);
