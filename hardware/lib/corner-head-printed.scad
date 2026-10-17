// Printed corner head r1.2.0 — concept-unvalidated, millimetres.
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
// Cosmetic retention is entirely printed; these followers never retain line load.
function pch_rear_back() = pch_bolt_tip()-3;
module pch_front_cover_tabs() {
    for(z=pch_cover_rows()) for(side=[-1,1]) scale([1,side,1]) {
        translate([pch_front()-8,34,z-8]) cube([24,20.1,16]);
        translate([pch_front(),54.1,z-3]) cube([8,3.9,6]);
        translate([pch_front()-3,58,z-3]) cube([14,2.2,6]);
    }
}
module pch_front_cover_catch() {
    translate([pch_front()-.1,-6,72]) cube([28.6,12,3]);
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
            pch_front_cover_catch();
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
    // Two identical pads; only the lower pad's concealed catch is engaged.
    pch_checks() difference() {
        union() {
            translate([pch_rear(),-40,-25]) cube([-pch_rear(),80,50]);
            for(side=[-1,1]) scale([1,side,1]) {
                translate([pch_rear()-14,34,-8]) cube([18,4.1,16]);
                translate([pch_rear()-11,38.1,-4]) cube([6,3.9,8]);
                translate([pch_rear()-11,42,-7]) cube([6,2.2,14]);
            }
            // Catch stays inside the pad's existing +/-25 mm vertical extent.
            translate([pch_rear_back()+.5,4,21]) cube([pch_rear()+3.5-pch_rear_back(),3,4]);
            translate([pch_rear_back()+.5,4,21]) cube([1.2,5,4]);
        }
        pch_post_void(52,-26);
        ch_xcyl(13,post_size_mm+100);
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
module pch_front_cover_guides() {
    for(side=[-1,1]) scale([1,side,1]) translate([pch_front()+4,0,0]) difference() {
        // Continuous, top-open guides permit the established downward service.
        translate([-9,54.5,0]) cube([18,6.8,180]);
        translate([-4.3,54.4,16.7]) cube([8.6,3.9,164.3]);
        translate([-7.3,57.7,16.7]) cube([14.6,2.9,164.3]);
    }
}
module pch_front_cover_latch(released=false) {
    translate([pch_front()+29.5,-5,37]) cube([3.5,10,4]);
    // A rigid pivot is a nominal released envelope, not a flexural/force model.
    translate([pch_front()+30.25,0,40.5]) rotate([0,released ? atan(1.5/36) : 0,0])
        translate([-pch_front()-30.25,0,-40.5]) union() {
            translate([pch_front()+29.5,-5,40.5]) cube([1.5,10,38.5]);
            translate([pch_front(),0,0]) rotate([90,0,0]) linear_extrude(height=10,center=true)
                polygon([[27.5,75.3],[29.7,75.3],[29.7,79],[27.5,76.5]]);
        }
}
module corner_head_printed_front_cover(latch_released=false) {
    pch_checks() union() {
        difference() {
            translate([pch_front()-3,-65,0]) arbi_rounded_box([39,130,180],3,facets=32);
            translate([pch_front()-5,-61,-1]) cube([38,122,182]);
            for(y=[-41,23]) translate([pch_front()-5,y,30]) cube([43,18,151]);
        }
        pch_front_cover_guides();
        pch_front_cover_latch(latch_released);
    }
}
module pch_rear_cover_guides() {
    for(z=pch_rows()) for(side=[-1,1]) scale([1,side,1]) translate([0,0,z]) difference() {
        translate([pch_rear_back()-.3,38.5,-9]) cube([pch_rear()-.45-pch_rear_back(),6.8,18]);
        translate([pch_rear()-11.3,38.4,-4.3]) cube([11.6,3.9,8.6]);
        translate([pch_rear()-11.3,41.7,-7.3]) cube([11.6,2.9,14.6]);
    }
}
module pch_rear_cover_latch(released=false) {
    b=pch_rear_back();
    translate([b-.2,10,37]) cube([6.2,1.5,4]);
    translate([b+4,10.75,40.5]) rotate([released ? -atan(1.5/26) : 0,0,0])
        translate([-b-4,-10.75,-40.5]) union() {
            translate([b+2,10,40.5]) cube([4,1.5,28.5]);
            translate([0,0,65]) linear_extrude(height=4)
                polygon([[b+2,8],[b+3.5,8],[b+6,10],[b+2,10.2]]);
        }
}
module corner_head_printed_rear_cover(latch_released=false) {
    pch_checks() union() {
        difference() {
            translate([pch_bolt_tip()-7,-49,10]) arbi_rounded_box([pch_rear()-.75-pch_bolt_tip()+7,98,180],3,facets=32);
            translate([pch_rear_back(),-45,14]) cube([pch_rear()-pch_bolt_tip()+8,90,172]);
            for(y=[-30,30]) translate([pch_rear()-8,y,9]) cylinder(d=4,h=10,$fn=32);
            // Concealed underside blade port; all visible side/back faces are solid.
            translate([pch_rear_back()+2.5,6.5,9]) cube([3,7,6]);
        }
        pch_rear_cover_guides();
        pch_rear_cover_latch(latch_released);
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
module pch_print_left() { translate([0,205,60.2]) rotate([90,0,0]) corner_head_printed_left(); }
module pch_print_right() { translate([0,0,60.2]) rotate([-90,0,0]) corner_head_printed_right(); }
module pch_print_rear_pad() { translate([22-pch_rear(),44.2,25]) corner_head_printed_rear_pad(); }
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
    }
}
