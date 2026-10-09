// Shared approximate catalog geometry. Units: mm. License: AGPL-3.0-only.
// All dimensions are illustrative unless the entrypoint identifies a catalog basis.
// Not fabrication geometry; inspect the selected hardware before using an interface.
include <arbi.scad>
$fn = 40;

module cv_box(d) { translate([-d[0]/2,-d[1]/2,0]) cube(d); }
module cv_ring(d) { arbi_tube(d[0],d[1],d[2],facets=40); }
module cv_rod(d) { cylinder(d=d[0],h=d[1]); }
module cv_board(d) {
    cv_box([d[0],d[1],1.6]);
    translate([0,0,1.5]) cv_box([d[0]*.4,d[1]*.5,d[2]-1.5]);
    for(x=[-1,1]) translate([x*d[0]*.38,0,1.5]) cv_box([d[0]*.18,d[1]*.65,5]);
}
module cv_bolt(d) {
    cylinder(d=d[0],h=d[1]);
    translate([0,0,-d[3]+.02]) cylinder(d=d[2]/cos(30),h=d[3],$fn=6);
}
module cv_nut(d) {
    difference() {
        cylinder(d=d[1]/cos(30),h=d[2],$fn=6);
        translate([0,0,-.02]) cylinder(d=d[0],h=d[2]+.04);
    }
}
module cv_coil(d) {
    // A short sample loop, not a claim about purchased or installed cable length.
    rotate_extrude() translate([d[1]/2,0,0]) circle(d=d[0]);
}
module cv_cable(d) {
    rotate([0,90,0]) cv_rod(d);
    translate([0,0,-d[0]]) cv_box([14,d[0]*2,d[0]*2]);
    translate([d[1],0,-d[0]]) cv_box([14,d[0]*2,d[0]*2]);
}
module cv_enclosure(d) {
    difference() {
        cv_box(d);
        translate([0,0,3]) cv_box([d[0]-6,d[1]-6,d[2]]);
    }
    translate([0,0,d[2]-.02]) cv_box([d[0],d[1],3]);
}
module cv_terminal(d) {
    cv_box(d);
    for(x=[-3:3]) translate([x*d[0]/8,0,d[2]-.02]) cylinder(d=4,h=2);
    translate([0,0,-3]) cv_box([d[0]*.8,35,3.02]);
}
module cv_plate(d) {
    difference() {
        cv_box(d);
        for(x=[-d[0]/2+10:20:d[0]/2-10],y=[-d[1]/2+10:20:d[1]/2-10])
            translate([x,y,-.02]) cylinder(d=5,h=d[2]+.04);
    }
}
module cv_angle(d) {
    difference() {
        union() {
            cv_box([d[1],d[0],d[3]]);
            translate([0,-d[0]/2+d[3]/2,0]) cv_box([d[1],d[3],d[2]]);
        }
        translate([0,d[0]/2-25,-.02]) cylinder(d=9,h=d[3]+.04);
        for(z=[35,115]) translate([0,-d[0]/2-1,z]) rotate([-90,0,0]) cylinder(d=13,h=d[3]+2);
    }
}
module cv_driver(d) {
    cv_box(d);
    for(x=[-1,1]) translate([x*d[0]*.42,0,d[2]-.02]) cv_box([d[0]*.14,d[1]*.8,8]);
    for(y=[-d[1]*.3:8:d[1]*.3]) translate([0,y,d[2]-.02]) cv_box([d[0]*.55,2,3]);
}
module cv_psu(d) {
    difference() {
        cv_box(d);
        for(x=[-d[0]*.35:15:d[0]*.35],y=[-d[1]*.3:15:d[1]*.3])
            translate([x,y,d[2]-2]) cylinder(d=6,h=3);
    }
    translate([0,-d[1]/2,0]) cv_box([d[0]*.7,12,15]);
}
module cv_capacitor(d) {
    cylinder(d=d[0],h=d[1]);
    for(x=[-2.5,2.5]) translate([x,0,-5]) cylinder(d=.6,h=5.1);
}
module cv_microsd() {
    linear_extrude(.8) polygon([[0,0],[11,0],[11,15],[1.5,15],[0,13],[0,8],[1,7],[0,6]]);
    for(x=[2:1.1:9]) translate([x,9,.79]) cube([.7,4,.03]);
}
module cv_servo(d) {
    difference() {
        union() {
            cv_box(d);
            translate([0,0,d[2]*.75]) cv_box([27,d[1],2]);
            translate([5,0,d[2]-.02]) cylinder(d=7,h=2);
            translate([5,0,d[2]+1.9]) cylinder(d=3.6,h=2.5);
        }
        for(x=[-12,12]) translate([x,0,d[2]*.75-.02]) cylinder(d=1.7,h=2.1);
    }
}
module cv_pi() {
    difference() {
        union() {
            cv_box([65,56,1.6]);
            translate([26,1,1.5]) cv_box([17,14,7.5]);
            translate([0,-24,1.5]) cv_box([16,12,6.5]);
            translate([0,24,1.5]) cv_box([51,5.4,8.4]);
            translate([11,-13,1.5]) cv_box([3,21,4]);
            translate([-2,3,1.5]) cv_box([14,14,2]);
        }
        for(x=[-29,29],y=[-24.5,24.5]) translate([x,y,-.02]) cylinder(d=2.75,h=15);
    }
}
module cv_camera() {
    difference() {
        union() {
            cv_box([25,23.862,1.12]);
            translate([0,2.5,1.1]) cv_box([10.8,10.8,4.48]);
            translate([0,2.5,5.55]) cylinder(d=5.75,h=3);
            translate([0,-8.4,-2.75]) cv_box([19.61,5,2.77]);
        }
        for(x=[-10.5,10.5],y=[-9.931,2.569]) translate([x,y,-3]) cylinder(d=2.2,h=15);
    }
}
module cv_pico() {
    cv_board([51,21,4]);
    for(y=[-9,9]) translate([0,y,1.5]) cv_box([49,2.5,8]);
    translate([24,0,1.5]) cv_box([7,8,3]);
}
module cv_motor(d) {
    difference() {
        union() {
            cv_box(d);
            translate([0,0,-1.6]) cylinder(d=38.1,h=1.7);
            translate([0,0,-22]) cylinder(d=8,h=22.1);
        }
        for(x=[-23.57,23.57],y=[-23.57,23.57]) translate([x,y,-.02]) cylinder(d=4.5,h=8.2);
    }
}
module cv_collar(d) {
    difference() {
        cv_ring(d);
        translate([0,-.35,-.02]) cube([d[0],.7,d[2]+.04]);
    }
}
module cv_coupling(d) {
    cv_ring(d);
    // Segmentation cue only; jaw/tooth fit is unspecified.
    translate([0,0,d[2]*.45]) cv_ring([d[0]+.3,d[1],d[2]*.1]);
}
module cv_slip_ring(d) {
    cylinder(d=d[0],h=d[1]);
    translate([0,0,d[1]-.02]) cv_ring([d[0]*1.3,5,2]);
    for(x=[-2.5:1:2.5]) translate([x,0,-12]) cylinder(d=.6,h=12.1);
}
module cv_switch(d) {
    cylinder(d=d[0],h=25);
    translate([0,0,24.9]) cylinder(d=d[1],h=14);
    translate([0,0,-12]) cv_box([30,20,12.1]);
}
module cv_shackle(d) {
    difference() {
        union() {
            translate([0,0,d[2]/2]) rotate([90,0,0]) cv_ring([d[1],d[1]-2*d[0],d[0]]);
            for(x=[-(d[1]-d[0])/2,(d[1]-d[0])/2]) translate([x,-d[0]/2,0]) cylinder(d=d[0],h=d[2]/2);
        }
        translate([-d[1],-d[0]/2,d[0]/2]) rotate([0,90,0]) cylinder(d=d[0]*.7,h=2*d[1]);
    }
    translate([-d[1]/2,-d[0]/2,d[0]/2]) rotate([0,90,0]) cylinder(d=d[0]*.68,h=d[1]);
}
module cv_anchor(d) {
    cylinder(d=d[1],h=d[0]);
    translate([0,0,40]) cylinder(d=100,h=5);
    translate([0,0,d[0]-1]) rotate([90,0,0]) cv_ring([60,36,12]);
}
module cv_turnbuckle(d) {
    difference() {
        cv_box([30,20,d[0]]);
        translate([0,0,10]) cv_box([14,22,d[0]-20]);
    }
    for(z=[-35,d[0]-.1]) translate([0,0,z]) cylinder(d=d[1],h=35.1);
    for(z=[-45,d[0]+45]) translate([0,0,z]) rotate([90,0,0]) cv_ring([35,15,10]);
}
module cv_pulley(d) {
    cv_ring([d[0],5,d[1]]);
    for(z=[-2,d[1]-.02]) translate([0,0,z]) cv_ring([d[0]+4,5,2.02]);
    for(z=[-4,d[1]+1.9]) translate([0,0,z]) cv_box([d[0]+8,d[0]+8,2.1]);
    translate([0,0,-4]) cylinder(d=5.1,h=d[1]+8);
    translate([0,d[0]/2+3,-4]) cv_box([4,14,d[1]+8]);
    translate([0,d[0]/2+10,d[1]/2]) rotate([90,0,0]) cv_ring([14,8,4]);
}
module cv_hood(d) {
    // Simple sloping slab with two side skirts, not a finalized weather design.
    rotate([10,0,0]) cv_box([d[0],d[1],3]);
    for(x=[-d[0]/2+1.5,d[0]/2-1.5]) translate([x,0,-d[2]/2]) cv_box([3,d[1],d[2]/2+.1]);
}
module cv_latch() {
    cylinder(d=8,h=25);
    translate([0,0,24.9]) cylinder(d=18,h=4);
    translate([32,0,0]) cv_box([55,12,5]);
    translate([52,0,-3]) cylinder(d=5,h=12);
}
module cv_microswitch() {
    cv_box([20,10,6]);
    translate([7,0,5.9]) rotate([0,-15,0]) cv_box([30,3,1]);
    translate([21,0,10]) rotate([90,0,0]) cylinder(d=5,h=4,center=true);
}
module cv_springs() {
    for(x=[-20,0,20]) translate([x,0,0])
        linear_extrude(height=30,twist=2880,slices=96)
            translate([5,0]) circle(d=1,$fn=12);
}
module cv_fasteners() {
    for(i=[0:3]) translate([i*25,0,0]) {
        cv_bolt([i+3,20+5*i,5.5+1.5*i,3+i]);
        translate([0,20,0]) cv_nut([i+3,5.5+1.5*i,3+i]);
        translate([0,35,0]) cv_ring([7+2*i,3.2+i,1]);
    }
}
module cv_glands() {
    for(i=[0:2]) translate([i*32,0,0]) {
        cv_ring([12+4*i,5+2*i,24+3*i]);
        cv_nut([5+2*i,16+5*i,5]);
    }
}
module cv_inserts() {
    for(i=[0:2]) translate([i*14,0,0]) cv_ring([5+2*i,3+i,5+2*i]);
}
module cv_rope_clamp() {
    cv_box([16,10,4]);
    for(x=[-5,5]) translate([x,0,0]) cylinder(d=3,h=14);
    translate([0,0,14]) rotate([90,0,0]) cv_ring([13,7,3]);
    for(x=[-5,5]) translate([x,0,-3]) cv_nut([3,5.5,3]);
}
module cv_thimble() {
    linear_extrude(5) difference() {
        hull() { translate([0,7]) circle(d=16); translate([0,-10]) circle(d=6); }
        hull() { translate([0,7]) circle(d=10); translate([0,-8]) circle(d=2); }
    }
}
module cv_anemometer() {
    cylinder(d=24,h=120);
    translate([0,0,119.9]) cylinder(d=35,h=12);
    for(a=[0,120,240]) rotate([0,0,a]) {
        translate([0,0,126]) rotate([0,90,0]) cylinder(d=5,h=55);
        translate([55,0,126]) difference() { sphere(d=40); translate([0,0,3]) sphere(d=36); }
    }
}
module cv_can(d) {
    cylinder(d=d[0],h=d[1]);
    translate([0,0,d[1]-.02]) cylinder(d=d[0]*.65,h=10);
    translate([0,0,d[1]+9.9]) cylinder(d=8,h=8);
}
module arbi_catalog_visualization(shape,d) {
    if(shape=="box") cv_box(d);
    else if(shape=="ring" || shape=="tube") cv_ring(d);
    else if(shape=="rod") cv_rod(d);
    else if(shape=="board") cv_board(d);
    else if(shape=="bolt") cv_bolt(d);
    else if(shape=="nut") cv_nut(d);
    else if(shape=="coil") cv_coil(d);
    else if(shape=="cable") cv_cable(d);
    else if(shape=="enclosure") cv_enclosure(d);
    else if(shape=="terminal") cv_terminal(d);
    else if(shape=="terminal_board") { cv_board(d); for(y=[-d[1]*.4,d[1]*.4]) translate([0,y,1.5]) cv_terminal([d[0]*.9,8,10]); }
    else if(shape=="plate") cv_plate(d);
    else if(shape=="angle") cv_angle(d);
    else if(shape=="driver") cv_driver(d);
    else if(shape=="psu") cv_psu(d);
    else if(shape=="capacitor") cv_capacitor(d);
    else if(shape=="microsd") cv_microsd();
    else if(shape=="servo") cv_servo(d);
    else if(shape=="pi") cv_pi();
    else if(shape=="camera") cv_camera();
    else if(shape=="pico") cv_pico();
    else if(shape=="motor") cv_motor(d);
    else if(shape=="collar") cv_collar(d);
    else if(shape=="coupling") cv_coupling(d);
    else if(shape=="slip_ring") cv_slip_ring(d);
    else if(shape=="switch") cv_switch(d);
    else if(shape=="shackle") cv_shackle(d);
    else if(shape=="anchor") cv_anchor(d);
    else if(shape=="turnbuckle") cv_turnbuckle(d);
    else if(shape=="pulley") cv_pulley(d);
    else if(shape=="hood") cv_hood(d);
    else if(shape=="latch") cv_latch();
    else if(shape=="microswitch") cv_microswitch();
    else if(shape=="springs") cv_springs();
    else if(shape=="fasteners") cv_fasteners();
    else if(shape=="glands") cv_glands();
    else if(shape=="inserts") cv_inserts();
    else if(shape=="rope_clamp") cv_rope_clamp();
    else if(shape=="thimble") cv_thimble();
    else if(shape=="anemometer") cv_anemometer();
    else if(shape=="can") cv_can(d);
    else if(shape=="brake") { cv_ring(d); for(x=[-35,35]) translate([x,0,0]) cv_box([20,25,5]); }
    else if(shape=="drum_hardware") { cv_rod([5,280]); translate([30,0,0]) cv_fasteners(); }
    else if(shape=="mount_hardware") { cv_box([550,180,8]); translate([300,0,0]) cv_ring([11,8.2,2]); translate([325,0,0]) cv_fasteners(); }
    else if(shape=="pole_hardware") { cv_rod([8,180]); translate([30,0,0]) cv_nut([8,13,7]); translate([55,0,0]) cv_ring([24,8.5,2]); }
    else assert(false,str("Unknown catalog visualization shape: ",shape));
}
