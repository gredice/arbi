// Printed corner head r1.1.0 — concept-unvalidated, millimetres.
// Primary printed parts require process, load, creep and installed qualification.
include <corner-head.scad>

function pch_radius() = post_size_mm/2;
function pch_front() = pch_radius()+32;
function pch_rear() = -pch_radius()-16;
// Equal tensions with a horizontal span and vertical winch leg pitch the
// freely pinned measured block 45 degrees; its pin is behind the sheave.
function pch_block_drop() = barton_pin_spacing();
function pch_sheave_x() = pch_radius()+(line_diameter_mm<=1.5 ? 177.55 : 176.65);
function pch_pin_x() = pch_sheave_x()-pch_block_drop()/sqrt(2);
function pch_sheave_z() = 165-pch_block_drop()/sqrt(2);
function pch_bolt_length() = ceil((post_size_mm+70)/10)*10;
function pch_bolt_tip() = pch_front()+3-pch_bolt_length();
function pch_rows() = [45,155];
function pch_cover_rows() = [20,170];
module pch_checks() {
    assert(post_shape=="round" || post_shape=="square");
    assert(post_size_mm>=100 && post_size_mm<=140);
    assert(line_diameter_mm==1.5 || line_diameter_mm==4.5);
    assert(pch_bolt_length()-(post_size_mm+66)>=3.5);
    children();
}
module pch_post(height=300) {
    difference() {
        translate([0,0,-50])
            if(post_shape=="round") cylinder(d=post_size_mm,h=height,$fn=facets);
            else translate([-pch_radius(),-pch_radius(),0]) cube([post_size_mm,post_size_mm,height]);
        for(z=pch_rows()) translate([0,0,z]) ch_xcyl(13,post_size_mm+100);
    }
}
module pch_post_void(height=210,z=-1) {
    translate([0,0,z])
        if(post_shape=="round") cylinder(d=post_size_mm+0.5,h=height,$fn=facets);
        else translate([-pch_radius()-.25,-pch_radius()-.25,0]) cube([post_size_mm+.5,post_size_mm+.5,height]);
}
module pch_web() {
    // XZ load plane; side-flat printing keeps the principal ribs in printer XY.
    rotate([90,0,0]) linear_extrude(height=16)
        difference() {
            offset(r=3,$fn=32) offset(delta=-3)
                polygon([[pch_front()-2,0],[pch_pin_x()+16,185],[pch_pin_x()+16,205],[pch_front()-2,205]]);
            polygon([[pch_front()+22,62],[pch_pin_x()-40,178],[pch_front()+22,178]]);
        }
}
module pch_cover_nut_slot(y) {
    // Plain M3 nut, AF5.5 x 2.4 nominal. AF5.7 x 2.8 top-loading pocket;
    // flats face X so a nut can enter vertically with the cover removed.
    translate([0,y,0]) {
        rotate([90,0,0]) rotate([0,0,30])
            cylinder(d=5.7/cos(30),h=2.8,center=true,$fn=6);
        translate([-2.85,-1.4,0]) cube([5.7,2.8,9]);
    }
}
module pch_front_cover_tabs() {
    for(z=pch_cover_rows()) for(side=[-1,1])
        translate([pch_front()+10,0,z]) difference() {
            translate([-12,side>0 ? 34 : -60.5,-8]) cube([24,26.5,16]);
            translate([0,side*48,0]) ch_ycyl(3.4,29);
            pch_cover_nut_slot(side*56);
        }
}
module pch_carrier_body() {
    difference() {
        union() {
            // Curved front seat is integrated into the two carrier halves.
            translate([0,-40,0]) cube([pch_front(),80,205]);
            translate([0,40,0]) pch_web();
            translate([0,-24,0]) pch_web();
            // Full-width upper chord and central direct double-tang lug.
            translate([pch_front()-2,-40,185]) cube([pch_pin_x()+18-pch_front(),80,20]);
            translate([pch_pin_x(),0,165]) barton_mount_lug(fn=facets);
            // Solid cross-bolt bosses avoid squeezing two unsupported ribs.
            for(z=[100,190]) translate([pch_radius()+50,0,z]) ch_ycyl(26,80);
            pch_front_cover_tabs();
        }
        pch_post_void();
        // Through-row cutters end at the root face, before the terminal lug.
        for(z=pch_rows()) translate([pch_front()/2,0,z]) ch_xcyl(13,pch_front()+2);
        for(z=[100,190]) translate([pch_radius()+50,0,z]) ch_ycyl(8.6,100);
        // The bought pin passes only through the central lug, not side webs.
        translate([pch_pin_x(),0,165]) ch_ycyl(barton_lug_bore(),barton_tang_gap());
    }
}
module corner_head_printed_left() {
    pch_checks() intersection() {
        pch_carrier_body();
        translate([-1,-61,-1]) cube([pch_pin_x()+30,61,210]);
    }
}
module corner_head_printed_right() {
    pch_checks() intersection() {
        pch_carrier_body();
        translate([-1,0,-1]) cube([pch_pin_x()+30,61,210]);
    }
}
module corner_head_printed_rear_pad() {
    // Export centered at Z=0; install two copies at the bolt row heights.
    pch_checks() difference() {
        union() {
            translate([pch_rear(),-40,-25]) cube([-pch_rear(),80,50]);
            for(side=[-1,1]) translate([pch_rear()-14,side>0 ? 34 : -44.5,-8])
                cube([18,10.5,16]);
        }
        pch_post_void(52,-26);
        translate([0,0,0]) ch_xcyl(13,post_size_mm+100);
        for(side=[-1,1]) translate([pch_rear()-8,0,0]) {
            translate([0,side*40,0]) ch_ycyl(3.4,16);
            pch_cover_nut_slot(side*40);
        }
    }
}
module pch_rear_pads() {
    for(z=pch_rows()) translate([0,0,z]) corner_head_printed_rear_pad();
}
module pch_hardware() {
    for(z=pch_rows()) {
        translate([pch_front()+3-pch_bolt_length()/2,0,z]) ch_xcyl(12,pch_bolt_length());
        translate([pch_front()+7,0,z]) rotate([0,90,0]) cylinder(d=18/cos(30),h=8,center=true,$fn=6);
        translate([pch_front()+1.5,0,z]) ch_ring_x(37,13,3);
        translate([pch_rear()-1.5,0,z]) ch_ring_x(37,13,3);
        translate([pch_rear()-9,0,z]) difference() {
            rotate([0,90,0]) cylinder(d=19/cos(30),h=12,center=true,$fn=6);
            ch_xcyl(12,12.02);
        }
    }
}
module pch_ring_y(od,id,h) {
    difference() { ch_ycyl(od,h); ch_ycyl(id,h+.02); }
}
module pch_cross_hardware() {
    for(z=[100,190]) translate([pch_radius()+50,0,z]) {
        translate([0,-8.4,0]) ch_ycyl(8,100);
        translate([0,44.25,0]) rotate([90,0,0]) cylinder(d=13/cos(30),h=5.3,center=true,$fn=6);
        for(y=[-40.8,40.8]) translate([0,y,0]) pch_ring_y(16,8.4,1.6);
        translate([0,-44.85,0]) difference() {
            rotate([90,0,0]) cylinder(d=13/cos(30),h=6.5,center=true,$fn=6);
            ch_ycyl(8,6.52);
        }
    }
}
module pch_block() {
    translate([pch_pin_x(),0,165]) rotate([0,-45,0])
        translate([0,0,-barton_pin_spacing()]) barton_size_1_block(fn=facets);
}
module pch_line() { translate([0,0,pch_sheave_z()-ch_sheave_z()]) ch_line(); }
module corner_head_printed_front_cover() {
    pch_checks() difference() {
        translate([pch_front()-3,-65,0]) arbi_rounded_box([39,130,180],3,facets=32);
        translate([pch_front()-5,-61,-1]) cube([38,122,182]);
        // Open-top rib channels keep the fascia clear of both structural webs;
        // the lower bridge and outer sidewalls retain one connected cover.
        for(y=[-41,23]) translate([pch_front()-5,y,30]) cube([43,18,151]);
        for(z=pch_cover_rows()) translate([pch_front()+10,0,z]) ch_ycyl(3.4,134);
    }
}
module corner_head_printed_rear_cover() {
    pch_checks() difference() {
        translate([pch_bolt_tip()-7,-49,10]) arbi_rounded_box([pch_rear()-.75-pch_bolt_tip()+7,98,180],3,facets=32);
        translate([pch_bolt_tip()-3,-45,14]) cube([pch_rear()-pch_bolt_tip()+8,90,172]);
        for(z=pch_rows()) translate([pch_rear()-8,0,z]) ch_ycyl(3.4,102);
        for(y=[-30,30]) translate([pch_rear()-8,y,9]) cylinder(d=4,h=10,$fn=32);
    }
}
module pch_cover_screw(side=1,outer=65) {
    // M3 x 12 socket screw and OD7 x 0.5 washer; threads/socket simplified.
    translate([0,side*(outer+.5-6),0]) ch_ycyl(3,12);
    translate([0,side*(outer+2),0]) ch_ycyl(5.5,3);
    translate([0,side*(outer+.25),0]) pch_ring_y(7,3.2,.5);
}
module pch_cover_hardware(which="front") {
    front = which=="front";
    for(z=front ? pch_cover_rows() : pch_rows()) for(side=[-1,1])
        translate([front ? pch_front()+10 : pch_rear()-8,0,z]) {
            pch_cover_screw(side,front ? 65 : 49);
            translate([0,side*(front ? 56 : 40),0]) difference() {
                rotate([90,0,0]) rotate([0,0,30])
                    cylinder(d=5.5/cos(30),h=2.4,center=true,$fn=6);
                ch_ycyl(3,2.42);
            }
        }
}
module corner_head_printed_template() {
    difference() {
        arbi_rounded_box([205,50,4],2,facets=32);
        for(x=pch_rows()) translate([x,25,-1]) cylinder(d=3,h=6,$fn=32);
        for(x=[-1,201]) translate([x,24,-1]) cube([5,2,6]);
    }
}
// Print poses map installed XZ to printer XY. Local supports may be needed at
// the central lug/boss transitions; exports are not slicer/process approval.
module pch_print_left() { translate([0,205,60.5]) rotate([90,0,0]) corner_head_printed_left(); }
module pch_print_right() { translate([0,0,60.5]) rotate([-90,0,0]) corner_head_printed_right(); }
module pch_print_rear_pad() { translate([25,44.5,14-pch_rear()]) rotate([0,-90,0]) corner_head_printed_rear_pad(); }
module pch_print_front_cover() { translate([0,65,pch_front()+36]) rotate([0,90,0]) corner_head_printed_front_cover(); }
module pch_print_rear_cover() { translate([190,49,-pch_bolt_tip()+7]) rotate([0,-90,0]) corner_head_printed_rear_cover(); }
module pch_print_template() { corner_head_printed_template(); }
module corner_head_printed_assembly(show_covers=true,explode_mm=0) {
    pch_checks() {
        color([.63,.53,.39]) pch_post();
        color(ARBI_CORE) { corner_head_printed_left(); corner_head_printed_right(); pch_rear_pads(); }
        color(ARBI_METAL) { pch_hardware(); pch_cross_hardware(); }
        color(ARBI_CORE) { pch_block(); pch_line(); }
        if(show_covers) color(ARBI_SHELL) {
            translate([0,explode_mm,explode_mm>0 ? -190 : 0]) corner_head_printed_front_cover();
            translate([-explode_mm,0,0]) corner_head_printed_rear_cover();
        }
        if(show_covers && explode_mm==0) color(ARBI_METAL) {
            pch_cover_hardware("front"); pch_cover_hardware("rear");
        }
    }
}
