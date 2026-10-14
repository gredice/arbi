// ARBI camera pod illustration references, millimetres. Not replacement hardware.
// Pi/camera board interfaces follow the cited drawings; component detail is simplified.
// Servo envelope/pitch and converter envelope/holes are measured; horn/capacitor detail remains provisional.
include <arbi-hardware/lib/buck-converter-48v-5v.scad>
include <arbi-hardware/lib/micro-pan-tilt-servo.scad>
include <arbi-hardware/lib/raspberry-pi-3a-plus.scad>
use <arbi-hardware/lib/raspberry-pi-camera-module-3.scad>
part = "raspberry-pi-3a-plus-reference";
$fn = 64;
eps = 0.02;

capacitor_diameter = 10;
capacitor_height = 16;

module rounded_plate(x,y,h,r=2) {
    hull() for(xx=[r,x-r],yy=[r,y-r])
        translate([xx,yy,0]) cylinder(r=r,h=h);
}
module ring(od,id,h) {
    difference() {
        cylinder(d=od,h=h);
        translate([0,0,-eps]) cylinder(d=id,h=h+2*eps);
    }
}
module pi_board() {
    raspberry_pi_3a_plus();
}
module camera() {
    raspberry_pi_camera_module_3(wide=true);
}
module servo() {
    // Flexible display leads are excluded from the rigid collision proxy.
    micro_pan_tilt_servo(leads=false,solid=true);
}
module horn() {
    difference() {
        union() {
            cylinder(d=8,h=2);
            hull() for(x=[0,12]) translate([x,0,0]) cylinder(d=3.4,h=1.5);
        }
        translate([0,0,-eps]) cylinder(d=1.5,h=2+2*eps);
        for(x=[6,9,12]) translate([x,0,-eps]) cylinder(d=1.2,h=2);
    }
}
module buck() {buck_converter_48v_5v();}
module capacitor() {
    union() {
        cylinder(d=capacitor_diameter,h=capacitor_height);
        for(x=[-2.5,2.5]) translate([x,0,-5]) cylinder(d=.6,h=5.1);
    }
}
module microsd() {
    linear_extrude(.8) polygon([[0,0],[11,0],[11,15],[1.5,15],[0,13],[0,8],[1,7],[0,6]]);
}
module bolt(d,length) {
    difference() {
        union(){cylinder(d=d,h=length);translate([0,0,-d])cylinder(d=1.8*d,h=d);}
        translate([0,0,-d-eps])cylinder(d=d*.95,h=d*.55,$fn=6);
    }
}
module csk_bolt(d,length) {
    head_h=d==1.6?1.1:1.2;
    difference() {
        union() {cylinder(d=d,h=length);cylinder(d1=2*d,d2=d,h=head_h);}
        translate([0,0,-eps])cylinder(d=d*.8,h=head_h*.55,$fn=6);
    }
}
module nut(d) {
    af=d==1.6?3.2:d==2?4:d==2.5?5:d==3?5.5:7;
    difference(){cylinder(d=af/cos(30),h=.8*d,$fn=6);translate([0,0,-eps])cylinder(d=d,h=d+eps);}
}
if(part=="raspberry-pi-3a-plus-reference") pi_board();
else if(part=="camera-module-3-wide-reference") camera();
else if(part=="micro-servo-3p7g-UNVERIFIED") servo();
else if(part=="servo-horn-UNVERIFIED") horn();
else if(part=="buck-converter-measured-reference") buck();
else if(part=="capacitor-1000uf-UNVERIFIED") capacitor();
else if(part=="microsd-reference") microsd();
else if(part=="csi-15pin-flat-reference") cube([16,60,.3]);
else if(part=="bolt-M2x8-reference") bolt(2,8);
else if(part=="bolt-M2p5x8-reference") bolt(2.5,8);
else if(part=="bolt-M4x16-reference") bolt(4,16);
else if(part=="nut-M2-reference") nut(2);
else if(part=="nut-M2p5-reference") nut(2.5);
else if(part=="nut-M4-reference") nut(4);
else if(part=="washer-M2-reference") ring(5,2.2,.3);
else if(part=="washer-M2p5-reference") ring(6,2.7,.5);
else if(part=="washer-M4-reference") ring(9,4.3,.8);
else if(part=="spacer-M2x3-reference") ring(4,2.2,3);
else if(part=="spacer-M2p5x6-reference") ring(5,2.7,6);
else if(part=="bolt-M4x35-reference") bolt(4,35);
else if(part=="bolt-M2p5x20-reference") bolt(2.5,20);
else if(part=="bolt-M2p5x10-reference") bolt(2.5,10);
else if(part=="bolt-M1p6x6-reference") bolt(1.6,6);
else if(part=="bolt-M2x10-reference") bolt(2,10);
else if(part=="bolt-M2x12-reference") bolt(2,12);
else if(part=="bolt-M2x18-reference") bolt(2,18);
else if(part=="bolt-M2x25-reference") bolt(2,25);
else if(part=="bolt-M3x12-reference") bolt(3,12);
else if(part=="bolt-M3x35-reference") bolt(3,35);
else if(part=="nut-M1p6-reference") nut(1.6);
else if(part=="nut-M3-reference") nut(3);
else if(part=="washer-M3-reference") ring(7,3.2,.5);
else if(part=="washer-M3x0p7-reference") ring(7,3.2,.7);
else if(part=="bolt-OEM-horn-UNVERIFIED") bolt(1.4,4);
else if(part=="capacitor-tie-reference") difference() {
    translate([-9.4,-1.25,16.7])cube([18.8,2.5,23.6]);
    translate([-8.6,-1.3,17.5])cube([17.2,2.6,22]);
}
else if(part=="csk-M1p6x6-reference")csk_bolt(1.6,6);
else if(part=="csk-M2x8-reference")csk_bolt(2,8);
else if(part=="csk-M2x10-reference")csk_bolt(2,10);
else assert(false,"Unknown camera pod reference part");
