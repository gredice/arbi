// corner-stand-assembly r0.1.0 — concept-unvalidated. Schematic tube locations.
include <../../lib/corner-stand-adapter.scad>
include <../../lib/corner-head-printed.scad>
include <../../lib/winch-cover.scad>

head_bottom_mm=1100;
winch_center_mm=550;
powered=false;
show_winch=true;
show_front_cover=false;
assert(post_shape=="round" && post_size_mm==120 && line_diameter_mm==1.5 && !powered,
    "The indoor fixture reference is the passive round-120 selection.");
assert(head_bottom_mm>winch_center_mm+300);

// Tube samples identify interfaces only; no measured tripod/collar/leg model.
color(ARBI_METAL) {
    translate([0,0,winch_center_mm-200]) cylinder(d=winch_tube_diameter_mm,h=400,$fn=128);
    translate([0,0,head_bottom_mm-50]) cylinder(d=head_tube_diameter_mm,h=280,$fn=128);
}
for(z=pch_rows()) translate([0,0,head_bottom_mm+z]) {
    color(ARBI_CORE) { corner_stand_head_front(); corner_stand_rear_clamp(head_tube_diameter_mm); }
    color(ARBI_METAL) {
        csa_clamp_hardware(head_tube_diameter_mm);
        // M12 x 90, two large washers and one nominal 12 mm locking nut.
        translate([virtual_post_offset_mm+95-45,0,0]) csa_xcylinder(12,90);
        translate([virtual_post_offset_mm+99,0,0])
            rotate([0,90,0]) cylinder(d=18/cos(30),h=8,center=true,$fn=6);
        for(x=[virtual_post_offset_mm+93.5,csa_head_seat()-1.5])
            translate([x,0,0]) csa_xring(37,13,3);
        translate([csa_head_seat()-9,0,0]) difference() {
            rotate([0,90,0]) cylinder(d=19/cos(30),h=12,center=true,$fn=6);
            csa_xcylinder(12,12.04);
        }
    }
}
translate([virtual_post_offset_mm,0,head_bottom_mm]) {
    color(ARBI_CORE) { corner_head_printed_left(); corner_head_printed_right(); pch_block(); pch_line(); }
    color(ARBI_METAL) pch_cross_hardware();
    if(show_front_cover) color(ARBI_SHELL) corner_head_printed_front_cover();
}
for(z=[-60,60]) translate([0,0,winch_center_mm+z]) {
    color(ARBI_CORE) { corner_stand_winch_front(); corner_stand_rear_clamp(winch_tube_diameter_mm); }
    color(ARBI_METAL) {
        csa_clamp_hardware(winch_tube_diameter_mm);
        for(y=[-25,25]) {
            translate([csa_base_front()+1.6-20,y,0]) csa_xcylinder(8,40);
            translate([csa_base_front()+5.6,y,0]) csa_xcylinder(13,8);
            for(x=[csa_base_front()+.8,csa_winch_seat()-16-.8])
                translate([x,y,0]) csa_xring(16,8.4,1.6);
            translate([csa_winch_seat()-16-5.6,y,0]) difference() {
                rotate([0,90,0]) cylinder(d=13/cos(30),h=8,center=true,$fn=6);
                csa_xcylinder(8,8.04);
            }
        }
    }
}
if(show_winch) multmatrix([[0,0,1,csa_base_front()],[1,0,0,-wd_width(false)/2],
    [0,1,0,winch_center_mm],[0,0,0,1]]) wc_assembly(false,false,true,true,true);
