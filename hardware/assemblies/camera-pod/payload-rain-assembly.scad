// ARBI payload-rain-assembly r0.1.0 — concept-unvalidated reference. Do not print.
include <../../lib/payload-enclosure.scad>
use <camera-pod-spider.scad>
pan = 0;
tilt = 0;
show_hood = true;
assert(pan >= -95 && pan <= 95,"Outside nominal mechanical pan limits");
assert(tilt >= -5 && tilt <= 75,"Outside nominal mechanical tilt limits");
color([.08,.08,.09]) {
    camera_pod_spider(230,22,7,54,18,6,22,4.5,96);
    payload_electronics_deck();
    for(x=[-pm_mount_xy,pm_mount_xy],y=[-pm_mount_xy,pm_mount_xy])
        translate([x,y,3.5])payload_spider_spacer();
    payload_pan_servo_mount();
    payload_enclosure_base();
    payload_pan_fairing();
}
if(show_hood)color([.95,.95,.93])payload_rain_hood();
rotate([0,0,pan]) {
    color([.08,.08,.09]) {
        payload_pan_yoke();
        payload_tilt_pivot_support();
        payload_tilt_servo_boot();
        translate([0,0,-27.2])payload_horn_retainer();
    }
    translate([0,0,-59])rotate([tilt,0,0])translate([0,0,59]) {
        color([.08,.08,.09]) {
            payload_camera_cradle();
            translate([-21.8,0,-59])rotate([0,-90,0])payload_horn_retainer();
            translate([0,-5,-76.52])payload_camera_hood();
        }
        color([.95,.95,.93])payload_camera_cowl();
    }
}
