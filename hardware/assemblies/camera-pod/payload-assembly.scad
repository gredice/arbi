// ARBI payload-assembly 0.1.0 — concept-unvalidated reference, not a print job.
// Printed parts in their actual assembled frames. Hardware/fastener view is in the STL booklet.
include <../../lib/payload-mounts.scad>
use <camera-pod-spider.scad>
pan = 0;
tilt = 0;
show_cover = false;
assert(pan >= -95 && pan <= 95, "Outside nominal mechanical pan limits");
assert(tilt >= -5 && tilt <= 75, "Outside nominal mechanical tilt limits");
color("skyblue") camera_pod_spider(230,22,7,54,18,6,22,4.5,96);
color("lightblue") payload_electronics_deck();
for(x=[-pm_mount_xy,pm_mount_xy],y=[-pm_mount_xy,pm_mount_xy])translate([x,y,3.5])payload_spider_spacer();
payload_pan_servo_mount();
if(show_cover)translate([0,0,46])rotate([180,0,0])payload_electronics_cover();
rotate([0,0,pan]) {
    color("orange")payload_pan_yoke();
    payload_tilt_pivot_support();
    translate([0,0,-27.2])payload_horn_retainer();
    translate([0,0,-59])rotate([tilt,0,0])translate([0,0,59]) {
        color("cyan")payload_camera_cradle();
        translate([-21.8,0,-59])rotate([0,-90,0])payload_horn_retainer();
        translate([0,-5,-76.52])payload_camera_hood();
    }
}
