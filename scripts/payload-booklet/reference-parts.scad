// ARBI payload illustration references, millimetres. Not replacement hardware.
// Pi/camera board interfaces follow the cited drawings; component detail is simplified.
// Servo, horn, buck and capacitor are explicitly UNVERIFIED placeholders.
part = "raspberry-pi-3a-plus-reference";
$fn = 64;
eps = 0.02;

servo_body = [20, 8.5, 18];
servo_lug_span = 27;
servo_hole_pitch = 24;
servo_shaft_offset = 5;
buck_board = [45, 25, 1.6];
buck_height = 15;
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
    // Local XY: 65 x 56 PCB. Four nominal 2.75 holes, 58 x 49 pitch.
    // USB/HDMI/CSI/header envelopes are illustrative, not connector-fit CAD.
    translate([-32.5,-28,0]) difference() {
        union() {
            rounded_plate(65,56,1.6,3);
            translate([50,22,1.5]) cube([17,14,7.5]); // USB overhang
            translate([24,-1.5,1.5]) cube([16,12,6.5]); // HDMI
            translate([7,-1,1.5]) cube([8,5.5,3]); // power
            translate([48,-1.5,1.5]) cube([7,12,6]); // AV jack
            translate([6.8,49.5,1.5]) cube([51,5.4,2.7]);
            for(x=[0:19],y=[0:1])
                translate([8.1+2.54*x,50.8+2.54*y,4.1]) cube([.64,.64,5.7]);
            translate([23,24,1.5]) cube([14,14,2]); // processor envelope
            translate([42,4,1.5]) cube([3,21,4]); // CSI connector
            translate([.2,20,-1.1]) cube([13.5,15,1.2]); // SD socket
        }
        for(x=[3.5,61.5],y=[3.5,52.5])
            translate([x,y,-2]) cylinder(d=2.75,h=15);
        translate([55,24,3]) cube([13,10,4.3]); // USB opening
    }
}
module camera() {
    // Simplified Standard camera: 25 x 23.862 PCB; 21 x 12.5 hole pitch.
    // Lens/connector outline is approximate; do not design a fitted hood from it.
    translate([-12.5,-11.931,0]) difference() {
        union() {
            rounded_plate(25,23.862,1.12,1);
            translate([7.1,9,1.1]) cube([10.8,10.8,4.48]);
            translate([12.5,14.4,5.55]) cylinder(d=5.75,h=3);
            translate([2.695,1,-2.75]) cube([19.61,5,2.77]);
            translate([8,8,-1]) cube([9,8,1.02]);
        }
        for(x=[2,23],y=[2,14.5]) translate([x,y,-3]) cylinder(d=2.2,h=15);
    }
}
module servo() {
    difference() {
        union() {
            translate([-servo_body[0]/2,-servo_body[1]/2,0]) cube(servo_body);
            translate([-servo_lug_span/2,-servo_body[1]/2,13.5]) cube([servo_lug_span,servo_body[1],2]);
            translate([servo_shaft_offset,0,17.9]) cylinder(d=7,h=1.8);
            translate([servo_shaft_offset,0,19.5]) cylinder(d=3.6,h=2.5);
        }
        for(x=[-servo_hole_pitch/2,servo_hole_pitch/2])
            translate([x,0,13]) cylinder(d=1.7,h=3);
    }
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
module buck() {
    // No SKU or real dimensions verified: adjustable occupied-volume reference.
    translate([-buck_board[0]/2,-buck_board[1]/2,0]) union() {
        rounded_plate(buck_board[0],buck_board[1],buck_board[2],1.5);
        translate([12,6,1.5]) cube([15,13,buck_height-1.5]);
        translate([2,4,1.5]) cube([7,17,7]);
        translate([36,4,1.5]) cube([7,17,7]);
    }
}
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
else if(part=="camera-module-3-standard-reference") camera();
else if(part=="micro-servo-3p7g-UNVERIFIED") servo();
else if(part=="servo-horn-UNVERIFIED") horn();
else if(part=="buck-converter-UNVERIFIED") buck();
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
else if(part=="bolt-M1p6x6-reference") bolt(1.6,6);
else if(part=="bolt-M2x10-reference") bolt(2,10);
else if(part=="bolt-M2x12-reference") bolt(2,12);
else if(part=="bolt-M3x12-reference") bolt(3,12);
else if(part=="bolt-M3x35-reference") bolt(3,35);
else if(part=="nut-M1p6-reference") nut(1.6);
else if(part=="nut-M3-reference") nut(3);
else if(part=="washer-M3-reference") ring(7,3.2,.5);
else if(part=="washer-M3x0p7-reference") ring(7,3.2,.7);
else if(part=="bolt-OEM-horn-UNVERIFIED") bolt(1.4,4);
else if(part=="converter-tie-reference") difference() {
    translate([-1.25,-16.4,16.7])cube([2.5,32.8,8.2]);
    translate([-1.3,-15.6,17.5])cube([2.6,31.2,6.6]);
}
else if(part=="capacitor-tie-reference") difference() {
    translate([-9.4,-1.25,16.7])cube([18.8,2.5,23.6]);
    translate([-8.6,-1.3,17.5])cube([17.2,2.6,22]);
}
else if(part=="csk-M1p6x6-reference")csk_bolt(1.6,6);
else if(part=="csk-M2x8-reference")csk_bolt(2,8);
else if(part=="csk-M2x10-reference")csk_bolt(2,10);
else assert(false,"Unknown payload reference part");
