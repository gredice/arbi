// Frozen r0.1.0 carrier interface from 84f3b52; reference only, not a new print.
// Keep distinct from the r1.0.0 fabrication modules. See legacy-pulley-adapter.md.
include <corner-head-printed.scad>

function lch_pin_x() = pch_sheave_x()-40/sqrt(2);
module lch_strap_channels() {
    for(z=[21.5,171.5]) hull()
        for(x=[pch_front()+30.5,pch_front()+32.5]) translate([x,0,z]) ch_ycyl(3,140);
}
module lch_rear_pads() {
    for(z=pch_rows()) translate([0,0,z]) difference() {
        translate([pch_rear(),-40,-25]) cube([-pch_rear(),80,50]);
        pch_post_void(52,-26);
        ch_xcyl(13,post_size_mm+100);
    }
}
module lch_web() {
    rotate([90,0,0]) linear_extrude(height=16)
        difference() {
            offset(r=3,$fn=32) offset(delta=-3)
                polygon([[pch_front()-2,0],[lch_pin_x()+16,185],[lch_pin_x()+16,205],[pch_front()-2,205]]);
            polygon([[pch_front()+22,62],[lch_pin_x()-40,178],[pch_front()+22,178]]);
        }
}
module lch_carrier() {
    pch_checks() difference() {
        union() {
            translate([0,-40,0]) cube([pch_front(),80,205]);
            translate([0,40,0]) lch_web();
            translate([0,-24,0]) lch_web();
            translate([pch_front()-2,-40,185]) cube([lch_pin_x()+18-pch_front(),80,20]);
            translate([lch_pin_x()-16,-4,150]) cube([32,8,40]);
            for(z=[100,190]) translate([pch_radius()+50,0,z]) ch_ycyl(26,80);
        }
        pch_post_void();
        for(z=pch_rows()) translate([pch_front()/2,0,z]) ch_xcyl(13,pch_front()+2);
        for(z=[100,190]) translate([pch_radius()+50,0,z]) ch_ycyl(8.6,100);
        translate([lch_pin_x(),0,165]) ch_ycyl(8.6,10);
        lch_strap_channels();
    }
}
