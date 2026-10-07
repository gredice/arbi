// ARBI payload-assembly 0.2.0 — preferred integrated enclosure; concept-unvalidated reference, not a print job.
// Printed parts in their actual assembled frames. Hardware/fastener view is in the STL booklet.
include <../../lib/payload-mounts.scad>
use <camera-pod-spider.scad>
pan = 0;
tilt = 0;
show_cover = true;
show_enclosure = true;
show_hood = true;
use <payload-rain-assembly.scad>
module payload_bench_assembly(pan=0,tilt=0,show_cover=true) {
    assert(pan >= -95 && pan <= 95, "Outside nominal mechanical pan limits");
    assert(tilt >= -5 && tilt <= 75, "Outside nominal mechanical tilt limits");
    color(ARBI_CORE) camera_pod_spider(230,22,7,54,18,6,22,4.5,96);
    color(ARBI_CORE) payload_electronics_deck();
    for(x=[-pm_mount_xy,pm_mount_xy],y=[-pm_mount_xy,pm_mount_xy])color(ARBI_CORE)translate([x,y,3.5])payload_spider_spacer();
    color(ARBI_CORE)payload_pan_servo_mount();
    if(show_cover)color(ARBI_SHELL)translate([0,0,46])rotate([180,0,0])payload_electronics_cover();
    rotate([0,0,pan]) {
        color(ARBI_CORE)payload_pan_yoke();
        color(ARBI_CORE)payload_tilt_pivot_support();
        translate([0,0,-27.2])color(ARBI_CORE)payload_horn_retainer();
        translate([0,0,-59])rotate([tilt,0,0])translate([0,0,59]) {
            color(ARBI_CORE)payload_camera_cradle();
            translate([-21.8,0,-59])rotate([0,-90,0])color(ARBI_CORE)payload_horn_retainer();
            translate([0,-5,-76.52])color(ARBI_CORE)payload_camera_hood();
        }
    }
}
if(show_enclosure)payload_rain_assembly(pan,tilt,show_hood);
else payload_bench_assembly(pan,tilt,show_cover);
