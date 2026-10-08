// Corner support head r0.1.0 — concept-unvalidated, millimetres.
// Bought-part shapes are nominal envelopes, not supplier manufacturing drawings.
include <arbi.scad>

post_shape = "round";
post_size_mm = 120;
saddle_depth_mm = 10;
bracket_leg_mm = 200;
bracket_width_mm = 40;
bracket_thickness_mm = 5;
// The 200 mm proposed variant aligns with the committed round-pole winch.
// Select 150 to reproduce the historical angle and its 125 mm terminal hole.
// The purchased BA01090 has a double tang. Connection dimensions need measurement.
block_drop_mm = 70; // Beam underside to sheave centre; layout allowance only.
block_width_mm = 25;
block_body_mm = 36;
sheave_diameter_mm = 30;
line_diameter_mm = 1.5;
facets = 96;

function ch_round() = post_shape == "round";
function ch_front() = post_size_mm/2 + (ch_round() ? saddle_depth_mm : 0);
function ch_rear() = -ch_front();
function ch_rows() = bracket_leg_mm == 200 ? [45,155] : [35,115];
function ch_offset() = bracket_leg_mm == 200 ? 33 + (line_diameter_mm <= 1.5 ? 130.3 : 130.9)
    + sheave_diameter_mm/2-line_diameter_mm/2-(ch_round() ? saddle_depth_mm : 0) : 125;
function ch_pin_x() = ch_front() + ch_offset();
function ch_sheave_z() = bracket_leg_mm-bracket_thickness_mm-block_drop_mm;
function ch_plate_bottom() = bracket_leg_mm/2-100;
function ch_bolt_length() = ch_round() ? ceil((post_size_mm+2*saddle_depth_mm+31)/10)*10 : 160;
function ch_bolt_tip() = ch_front()+8-ch_bolt_length();

module ch_checks() {
    assert(post_shape == "round" || post_shape == "square");
    assert(post_size_mm >= 100 && post_size_mm <= 140);
    assert(saddle_depth_mm >= 10 && saddle_depth_mm <= 15);
    assert((bracket_leg_mm == 150 || bracket_leg_mm == 200) && bracket_width_mm == 40 && bracket_thickness_mm == 5);
    assert(ch_offset() > 100 && ch_offset() <= bracket_leg_mm-20);
    assert(block_drop_mm >= 60 && block_drop_mm <= 85);
    assert(block_width_mm >= 20 && block_width_mm <= 30);
    assert(line_diameter_mm > 0 && line_diameter_mm <= 4.5);
    children();
}
module ch_xcyl(d,h) { rotate([0,90,0]) cylinder(d=d,h=h,center=true,$fn=facets); }
module ch_ycyl(d,h) { rotate([90,0,0]) cylinder(d=d,h=h,center=true,$fn=facets); }
module ch_post(height=300, drilled=true) {
    difference() {
        translate([0,0,-50])
            if(ch_round()) cylinder(d=post_size_mm,h=height,$fn=facets);
            else translate([-post_size_mm/2,-post_size_mm/2,0]) cube([post_size_mm,post_size_mm,height]);
        if(drilled) for(z=ch_rows()) translate([0,0,z]) ch_xcyl(13,post_size_mm+60);
    }
}
module ch_bracket() {
    // Existing dimples, holes, bend radius and material certification unrepresented.
    difference() {
        union() {
            translate([ch_front(),-20,0]) cube([5,40,bracket_leg_mm]);
            translate([ch_front(),-20,bracket_leg_mm-5]) cube([bracket_leg_mm,40,5]);
        }
        for(z=ch_rows()) translate([ch_front()+2.5,0,z]) ch_xcyl(13,7);
        translate([ch_pin_x(),0,bracket_leg_mm-6]) cylinder(d=9,h=7,$fn=facets);
    }
}
module ch_backing() {
    for(i=[0,1]) difference() {
        translate([ch_rear()-2*(i+1),-50,ch_plate_bottom()]) cube([2,100,200]);
        for(z=ch_rows()) translate([ch_rear()-2*i-1,0,z]) ch_xcyl(13,4);
    }
}
module corner_head_front_saddle() {
    ch_checks() difference() {
        translate([0,-20,0]) cube([ch_front(),40,bracket_leg_mm]);
        translate([0,0,-1]) cylinder(d=post_size_mm+0.5,h=bracket_leg_mm+2,$fn=facets);
        for(z=ch_rows()) translate([0,0,z]) ch_xcyl(13,post_size_mm+60);
    }
}
module corner_head_rear_saddle() {
    ch_checks() difference() {
        translate([ch_rear(),-50,ch_plate_bottom()]) cube([-ch_rear(),100,200]);
        translate([0,0,ch_plate_bottom()-1]) cylinder(d=post_size_mm+0.5,h=202,$fn=facets);
        for(z=ch_rows()) translate([0,0,z]) ch_xcyl(13,post_size_mm+60);
    }
}
module ch_ring_x(od,id,h) {
    difference() { ch_xcyl(od,h); ch_xcyl(id,h+0.02); }
}
module ch_hardware() {
    for(z=ch_rows()) {
        translate([ch_front()+8-ch_bolt_length()/2,0,z]) ch_xcyl(12,ch_bolt_length());
        translate([ch_front()+12,0,z]) rotate([0,90,0]) cylinder(d=18/cos(30),h=8,center=true,$fn=6);
        translate([ch_front()+6.5,0,z]) ch_ring_x(37,13,3);
        translate([ch_rear()-5.5,0,z]) ch_ring_x(37,13,3);
        translate([ch_rear()-13,0,z]) difference() {
            rotate([0,90,0]) cylinder(d=19/cos(30),h=12,center=true,$fn=6);
            ch_xcyl(12,12.02);
        }
    }
}
module ch_connector() {
    // Simplified two-axis link envelope: bracket pin Z, block pin Y.
    // No M8-to-double-tang fit claim; dimensions must be checked on received parts.
    translate([ch_pin_x(),0,bracket_leg_mm-20]) {
        rotate([90,0,0]) rotate_extrude($fn=facets)
            translate([12,0]) circle(d=8,$fn=32);
        translate([0,0,12]) cylinder(d=8,h=16,$fn=facets);
    }
}
module ch_block() {
    // WASI lists 66 x 32 x 25 and a 30 x 12 sheave. Use a conservative
    // 36 mm body envelope and explicit assumed tang geometry; not a BA01090 CAD.
    translate([ch_pin_x(),0,ch_sheave_z()]) {
        for(s=[-1,1]) translate([0,s*(block_width_mm/2-1.5),0])
            hull() {
                ch_ycyl(block_body_mm,3);
                translate([0,0,25]) ch_ycyl(20,3);
            }
        difference() {
            ch_ycyl(sheave_diameter_mm,12);
            rotate([90,0,0]) rotate_extrude($fn=facets)
                translate([sheave_diameter_mm/2,0]) circle(r=1.5,$fn=24);
        }
        ch_ycyl(6,block_width_mm);
        for(s=[-1,1]) translate([0,s*6,40]) difference() {
            hull() { ch_ycyl(16,3); translate([0,0,-15]) ch_ycyl(16,3); }
            ch_ycyl(9,5);
        }
        translate([0,0,40]) ch_ycyl(8,25);
    }
}
module ch_line() {
    r=sheave_diameter_mm/2-line_diameter_mm/2;
    pts=concat([[ch_pin_x()-r,0,-180]],
        [for(a=[180:-5:90]) [ch_pin_x()+r*cos(a),0,ch_sheave_z()+r*sin(a)]],
        [[ch_pin_x()+180,0,ch_sheave_z()+r]]);
    for(i=[0:len(pts)-2]) hull()
        for(p=[pts[i],pts[i+1]]) translate(p) sphere(d=line_diameter_mm,$fn=12);
}
module corner_head_hood() {
    ch_checks() difference() {
        // Separate stem cover; a one-piece L hood was captured by the angle.
        translate([ch_front()+0.75,-27,0]) arbi_rounded_box([31.25,54,bracket_leg_mm-23],3,facets=32);
        // Open both ends; a cap here would intersect the vertical steel leg.
        translate([ch_front()-2,-22,-1]) cube([30,44,bracket_leg_mm+1]);
        // Two independent strap passages. Straps are replaceable bought parts.
        for(z=[20,bracket_leg_mm-30]) translate([ch_front()+8,-30,z]) cube([7,60,3]);
    }
}
module corner_head_roof() {
    ch_checks() difference() {
        translate([ch_front()+0.75,-27,bracket_leg_mm-8]) arbi_rounded_box([ch_offset()-17.75,54,20],3,facets=32);
        translate([ch_front()-2,-22,bracket_leg_mm-9]) cube([ch_offset()-12,44,16]);
    }
}
module corner_head_rear_cover() {
    ch_checks() difference() {
        translate([ch_bolt_tip()-6,-55,ch_plate_bottom()-5])
            arbi_rounded_box([ch_rear()-0.75-ch_bolt_tip()+6,110,210],3,facets=32);
        translate([ch_bolt_tip()-3,-51,ch_plate_bottom()-2])
            cube([ch_rear()-ch_bolt_tip()+7,102,204]);
        for(z=[20,bracket_leg_mm-30]) translate([ch_rear()-14,-57,z]) cube([7,114,3]);
        for(y=[-35,35]) translate([ch_rear()-8,y,ch_plate_bottom()-6]) cylinder(d=4,h=9,$fn=32);
    }
}
module ch_straps() {
    // Rigid rectangular routing envelopes for two bought flexible straps.
    // Width 2.5, thickness 1; actual closure, tension and deformation unmodelled.
    reach=max(59,post_size_mm/2+3);
    for(z=[20.8,bracket_leg_mm-29.2]) difference() {
        translate([ch_rear()-10.5,-reach,z]) cube([ch_front()-ch_rear()+22,2*reach,1]);
        translate([ch_rear()-8,-reach+2.5,z-0.01]) cube([ch_front()-ch_rear()+17,2*reach-5,1.02]);
    }
    // Third, independent bought strap around the removable roof and metal arm.
    difference() {
        translate([ch_front()+60,-29,bracket_leg_mm-9]) cube([2.5,58,23]);
        translate([ch_front()+59,-28,bracket_leg_mm-8]) cube([4.5,56,21]);
    }
}
module ch_marking_template() {
    difference() {
        translate([0,-25,0]) arbi_rounded_box([4,50,bracket_leg_mm],2,facets=32);
        for(z=ch_rows()) translate([2,0,z]) ch_xcyl(3,6);
        // Centerline notch at both ends; use only for marking, not powered drilling.
        for(z=[-1,bracket_leg_mm-4]) translate([-1,-1,z]) cube([6,2,5]);
    }
}
module corner_head_marking_template() {
    translate([bracket_leg_mm,25,0]) rotate([0,-90,0]) ch_marking_template();
}
module corner_head_assembly(show_covers=true, explode_mm=0, show_post=true, show_line=true) {
    ch_checks() {
        assert(explode_mm>=0 && explode_mm<=100);
        if(show_post) color([0.63,0.53,0.39]) ch_post();
        color(ARBI_METAL) {
            ch_bracket(); ch_backing(); ch_hardware(); ch_connector();
            if(ch_round()) { corner_head_front_saddle(); corner_head_rear_saddle(); }
        }
        color(ARBI_CORE) ch_block();
        if(show_line) color(ARBI_CORE) ch_line();
        if(show_covers) color(ARBI_SHELL) {
            translate([explode_mm/2,explode_mm,0]) corner_head_hood();
            translate([0,explode_mm,explode_mm>0 ? 20 : 0]) corner_head_roof();
            translate([-explode_mm,0,0]) corner_head_rear_cover();
        }
        if(show_covers && explode_mm==0) color(ARBI_CORE) ch_straps();
    }
}
