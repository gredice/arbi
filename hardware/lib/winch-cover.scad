// Full assembly shell 0.1.0 — concept-unvalidated. Units mm.
// Same shaft/base frame as winch-mount.scad. +Y is up on a flat post.
include <winch-mount.scad>

wc_wall = 4;
wc_side = 80;
wc_front = 164;
wc_corner = 18;
wc_skirt = 14;
wc_seam = 0.6;
wc_lap = 7;
function wc_start() = -46;
function wc_end(powered) = wm_base_length(powered)-54;
function wc_count(powered) = powered ? 5 : 3;
function wc_length(powered) = (wc_end(powered)-wc_start())/wc_count(powered);
function wc_x(powered,index) = wc_start()+index*wc_length(powered);
function wc_clip_x(powered,index,side) = wc_x(powered,index)+(side==0 ? 16 : wc_length(powered)-16);
function wc_payout_panel(powered,index) = index < wc_count(powered)-1;

module wc_checks(powered=false) {
    wm_checks() wd_checks(powered) {
        assert(wc_wall >= 4 && wc_side-wc_wall >= 75);
        assert(wc_front-wc_wall >= mount_axis_height+70+8);
        assert(wc_length(powered)+wc_lap < 240);
        assert(wc_end(powered)-wm_motor_face(powered)-motor_body_length >= 30);
        children();
    }
}
// Local 2D coordinates are Y,Z. Broad rounded front shoulders, open base face.
module wc_profile(extra=0) {
    s=wc_side+extra; f=wc_front+extra; r=wc_corner+extra;
    hull() {
        translate([-s,0]) square([2*s,1]);
        for(y=[-s+r,s-r]) translate([y,f-r]) circle(r=r,$fn=64);
    }
}
module wc_axial(x,length) {
    translate([x,0,0]) rotate([90,0,90]) linear_extrude(height=length,convexity=10) children();
}
module wc_skin(x,length,outer=0,inner=-wc_wall) {
    wc_axial(x,length) difference() { wc_profile(outer); wc_profile(inner); }
}
module wc_line_void(powered) {
    // Sweeping payout along +Y, never a fixed fairlead. No wall touches the line.
    translate([2,70,120]) cube([wd_width(powered)+8,45,24]);
}
module wc_rain_brow(x,length) {
    wc_axial(x,length) polygon([[76,148],[98,144],[100,148],[80,154],[76,154]]);
}
module wc_panel_installed(powered=false,index=0) {
    wc_checks(powered) {
        n=wc_count(powered); l=wc_length(powered);
        x=wc_x(powered,index); len=l-wc_seam;
        difference() {
            union() {
                wc_skin(x,len);
                if(index==0 || index==n-1)
                    wc_axial(index==0 ? x : x+len-wc_wall,wc_wall) wc_profile();
                // Outward shingle cuff: remove panels from left to right.
                if(index<n-1) {
                    wc_skin(x+len-3,3,2.5,-wc_wall);
                    wc_skin(x+len,wc_lap,2.5,0.5);
                }
                // Local brow only above the actual full-width payout opening.
                intersection() {
                    wc_rain_brow(x,len);
                    translate([2,70,140]) cube([wd_width(powered)+8,40,20]);
                }
            }
            translate([x-1,-110,-1]) cube([l+wc_lap+2,220,wc_skirt+1]);
            wc_line_void(powered);
            // The next panel's projecting payout brow must not meet this cuff.
            if(index<n-1)
                translate([x+len,70,119]) cube([wc_lap+1,40,40]);
            // Remove the lower payout shutter before lifting the main panel.
            // Open to the base face: a threaded line cannot snag the rising skirt.
            if(wc_payout_panel(powered,index))
                translate([x-1,70,-1]) cube([l+wc_lap+2,45,121]);
            // Side driver approach; screw heads stay below the payout aperture.
            for(cx=[wc_clip_x(powered,index,0),wc_clip_x(powered,index,1)],sy=[-1,1])
                translate([cx,sy*78,24]) rotate([90,0,0]) cylinder(d=4.5,h=16,center=true,$fn=32);
            if(index==n-1) {
                // Two fixed loom exits, nominal <=10 mm OD each; add soft edging.
                for(z=[50,75]) translate([x+len-2,-48,z]) wm_xhole(14,12);
                // Lower (-Y) motor vents on post, offset from payout side.
                for(cx=[wm_motor_face(powered)+20:20:wm_motor_face(powered)+100])
                    translate([cx,-84,42]) cube([10,12,5]);
            }
        }
    }
}
module wc_shutter_installed(powered=false,index=0) {
    x=wc_x(powered,index); l=wc_length(powered)-wc_seam;
    difference() {
        translate([x,76,wc_skirt]) cube([l,wc_wall,119.4-wc_skirt]);
        for(cx=[wc_clip_x(powered,index,0),wc_clip_x(powered,index,1)])
            translate([cx,78,24]) rotate([90,0,0]) cylinder(d=4.5,h=8,center=true,$fn=32);
    }
}
module wc_print_shutter(powered=false) {
    // Outer face flat on bed: X->X, Z->Y, -Y->Z.
    translate([-wc_start(),-wc_skirt,80])
        multmatrix([[1,0,0,0],[0,0,1,0],[0,-1,0,0],[0,0,0,1]]) wc_shutter_installed(powered,0);
}
module wc_print_panel(powered=false,index=0) {
    // Axial seam on bed; 160..180 mm shell width and <190 mm print height.
    // Custom mapping: installed X->print Z, Y->print X, Z->print Y.
    translate([100,0,-wc_x(powered,index)])
        multmatrix([[0,1,0,0],[0,0,1,0],[1,0,0,0],[0,0,0,1]])
            wc_panel_installed(powered,index);
}
module wc_clip() {
    // Identical dark clips. At +Y: stem ends at inner shell face Y=76.
    difference() {
        union() {
            translate([-10,74,0]) cube([20,14,6]);
            // Raise the inward stem above existing post washers (<=24 mm OD).
            translate([-10,68,5.8]) cube([20,8,28.2]);
            for(x=[-10,7]) wc_axial(x,3) polygon([[74,5.8],[87,5.8],[74,14]]);
        }
        translate([0,82,-1]) cylinder(d=4.5,h=8,$fn=32);
        translate([0,72,24]) rotate([90,0,0]) cylinder(d=4.5,h=14,center=true,$fn=32);
        // Plain M4 nut, side-loaded along -X; 8.4 x 7.4 mm pocket.
        translate([-11,69,20.3]) cube([15.2,3.4,7.4]);
    }
}
module wc_print_clip() { translate([10,-68,0]) wc_clip(); }
module wc_cable_anchor() {
    // Fixed to the base, independent of the removable shell. Two soft-wrap pairs.
    difference() {
        translate([-18,-12,0]) arbi_rounded_box([36,24,6],3,facets=32);
        for(x=[-10,10]) translate([x,0,-1]) cylinder(d=4.5,h=8,$fn=32);
        for(x=[-4,4],y=[-7,7]) translate([x-3,y-1.5,-1]) cube([6,3,8]);
    }
}
module wc_print_cable_anchor() { translate([18,12,0]) wc_cable_anchor(); }
module wc_base(powered=false) {
    // Existing blank/interface unchanged; add only shell/loom-anchor Ø4.5 holes.
    difference() {
        wm_base(powered);
        for(i=[0:wc_count(powered)-1],side=[0,1],sy=[-1,1])
            translate([wc_clip_x(powered,i,side),sy*82,-9]) cylinder(d=4.5,h=10,$fn=32);
        for(dx=[-10,10]) translate([wc_end(powered)-22+dx,-48,-9]) cylinder(d=4.5,h=10,$fn=32);
    }
}
module wc_assembly(powered=false,exploded=false,show_core=true) {
    wc_checks(powered) {
        color(ARBI_METAL) wc_base(powered);
        if(show_core) wm_assembly(powered,true,true,false);
        for(i=[0:wc_count(powered)-1]) {
            for(side=[0,1],sy=[-1,1]) color(ARBI_CORE)
                translate([wc_clip_x(powered,i,side),0,0]) scale([1,sy,1]) wc_clip();
            color(ARBI_SHELL) translate([0,0,exploded ? 190+i*18 : 0]) wc_panel_installed(powered,i);
            if(wc_payout_panel(powered,i)) color(ARBI_SHELL)
                translate([0,exploded ? 90 : 0,0]) wc_shutter_installed(powered,i);
        }
        color(ARBI_CORE) translate([wc_end(powered)-22,-48,0]) wc_cable_anchor();
    }
}
