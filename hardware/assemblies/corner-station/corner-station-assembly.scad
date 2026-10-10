// corner-station-assembly r0.1.0 — concept-unvalidated. Units: mm.
// Mounted ordinary winch + proposed printed head, on one abbreviated round post.
// The missing post length and line length are DRAWING BREAKS, not cuts to make.
include <../../lib/corner-head-printed.scad>
include <../../lib/winch-cover.scad>

scene_part = -1;
emit_scene = false;
head_bottom_mm = 500;
winch_center_mm = 100;
break_bottom_mm = 270;
break_gap_mm = 40;

assert(post_shape=="round" && post_size_mm==120 && line_diameter_mm==1.5);
// Winch local X is shaft, local Y is vertical, local Z is out from the post.
// Map wp_center(120) to the same post centre as pch_post: X=Y=0.
module station_winch_pose() {
    multmatrix([[0,0,1,-wp_center(post_size_mm)],
        [1,0,0,-wd_width(false)/2],[0,1,0,winch_center_mm],[0,0,0,1]]) children();
}
module station_head_pose() { translate([0,0,head_bottom_mm]) children(); }

// A sinusoidal section boundary makes the omitted middle length visible from
// every viewing angle. Nominal diameter is preserved at both mount interfaces.
module station_break_void() {
    rotate([90,0,0]) linear_extrude(height=post_size_mm+20,center=true)
        polygon(concat(
            [for(x=[-70:2:70]) [x,break_bottom_mm+9*sin(x*360/post_size_mm)]],
            [for(x=[70:-2:-70]) [x,break_bottom_mm+break_gap_mm+9*sin(x*360/post_size_mm)]]));
}
module station_post() {
    difference() {
        translate([0,0,-170]) cylinder(d=post_size_mm,h=920,$fn=96);
        station_break_void();
        for(z=pch_rows()) translate([0,0,head_bottom_mm+z]) ch_xcyl(13,post_size_mm+100);
        station_winch_pose() for(x=[wd_width(false)/2-25,wd_width(false)/2+25],y=[-60,60])
            translate([x,y,wp_back(post_size_mm)-1]) cylinder(d=9,h=post_size_mm+30,$fn=32);
    }
}
module station_line() {
    // Schematic vertical down-leg at the current sheave's nominal line plane.
    // Payout traverse, tension, drum angle and actual installed heights are unset.
    for(range=[[winch_center_mm+130,break_bottom_mm-12],
        [break_bottom_mm+break_gap_mm+12,head_bottom_mm+pch_sheave_z()]])
        translate([pch_sheave_x(),0,range[0]]) cylinder(d=1.5,h=range[1]-range[0],$fn=12);
}

station_parts = [
    ["abbreviated-timber-post","","corner-post-treated-timber","fixed",[.63,.53,.39],[0,0,0]],
    ["pulley-head-carriers","","corner-head-printed-kit","fixed",ARBI_CORE,[0,0,0]],
    ["pulley-head-fasteners","","corner-head-printed-hardware","fixed",ARBI_METAL,[0,0,0]],
    ["top-pulley","","top-positioning-line-pulley","fixed",ARBI_METAL,[0,0,0]],
    ["pulley-head-covers","","corner-head-printed-kit","cover",ARBI_SHELL,[0,70,0]],
    ["winch-cover-left","","winch-full-cover","cover",ARBI_SHELL,[0,0,0]],
    ["winch-cover-middle","","winch-full-cover","cover",ARBI_SHELL,[0,0,0]],
    ["winch-cover-right","","winch-full-cover","cover",ARBI_SHELL,[0,0,0]],
    ["winch-base","","winch-mount-hardware","fixed",ARBI_METAL,[0,0,0]],
    ["winch-cover-trim","","winch-full-cover","fixed",ARBI_SHELL,[0,0,0]],
    ["round-post-mount","","winch-round-pole-adapter","fixed",ARBI_METAL,[0,0,0]],
    ["round-post-fasteners","","winch-round-pole-hardware","fixed",ARBI_METAL,[0,0,0]],
    ["round-post-caps","","winch-round-pole-covers","cover",ARBI_SHELL,[0,0,0]],
    ["positioning-line-with-break","","dyneema-positioning-line","fixed",ARBI_CORE,[0,0,0]]
];
module station_geometry(i) {
    if(i==0) station_post();
    else if(i==1) station_head_pose() { corner_head_printed_left(); corner_head_printed_right(); pch_rear_pads(); }
    else if(i==2) station_head_pose() { pch_hardware(); pch_cross_hardware(); }
    else if(i==3) station_head_pose() pch_block();
    else if(i==4) station_head_pose() { corner_head_printed_front_cover(); corner_head_printed_rear_cover(); pch_straps(); }
    else if(i>=5 && i<=7) station_winch_pose() wc_panel_installed(false,i-5);
    else if(i==8) station_winch_pose() wc_base(false);
    else if(i==9) station_winch_pose() {
        for(i=[0:2]) {
            if(wc_payout_panel(false,i)) wc_shutter_installed(false,i);
            for(sy=[-1,1]) scale([1,sy,1]) wc_fascia_installed(false,i,sy==-1 && i==wc_pole_panel(false));
        }
        for(left=[true,false],j=[0:wc_rear_count(false,left)-1]) wc_rear_installed(false,left,j);
    }
    else if(i==10) station_winch_pose() for(y=[-60,60])
        translate([wd_width(false)/2,y,0]) { wp_front_saddle(120); wp_rear_saddle(120); }
    else if(i==11) station_winch_pose() wp_fasteners(false,120);
    else if(i==12) station_winch_pose() for(y=[-60,60])
        translate([wd_width(false)/2,y,0]) { wp_nut_cover(120); wp_nut_cover_bottom(120); }
    else if(i==13) station_line();
}
assert(scene_part>=-1 && scene_part<len(station_parts));
if(emit_scene) echo(["ARBI_ASSEMBLY_SCENE",1,"corner-station",
    "Ordinary winch and proposed printed head · round 120 mm post · middle length omitted · mounting heights schematic",
    "mounted",station_parts]);
if(scene_part>=0) color(station_parts[scene_part][4]) station_geometry(scene_part);
else for(i=[0:len(station_parts)-1]) color(station_parts[i][4]) station_geometry(i);
