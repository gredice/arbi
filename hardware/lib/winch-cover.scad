// Full assembly shell 0.3.0 — concept-unvalidated. Units mm.
// Same shaft/base frame as winch-mount.scad. +Y is up on a flat post.
include <winch-pole.scad>

wc_wall = 4;
wc_side = 80;
wc_front = 164;
wc_corner = 18;
wc_skirt = 14;
wc_seam = 0.6;
wc_lap = 7;
// Cosmetic fascia sits outside the original screwed interface. No metal is
// substituted by a plastic load path. Key retention needs print-cycle testing.
wc_fascia_outer = 98;
wc_rear_z = -27.6;
wc_post_half_width = 51; // 100 mm nominal post + 1 mm side clearance.
// Bottom loom ports, adjacent to the post, clear the existing lower clips.
function wc_loom_x(powered,i) = wd_width(powered)/2-(i==0 ? 55 : 35);
function wc_loom_z(i) = i==0 ? 13 : 25;
function wc_pole_panel(powered) = powered ? 1 : 0;
function wc_anchor_x(powered) = wd_width(powered)/2+60;
module wc_loom_void(powered) {
    for(i=[0,1]) {
        translate([wc_loom_x(powered,i),-90,wc_loom_z(i)])
            rotate([90,0,0]) cylinder(d=14,h=36,center=true,$fn=64);
        // Widen only the inner bend corridor. The external 14 mm tunnel
        // remains round and baffled against oblique views of opposite clips.
        translate([wc_loom_x(powered,i)-7,-80.3,wc_loom_z(i)-7]) cube([27,8.3,14]);
    }
}
function wc_start() = -46;
function wc_end(powered) = wm_base_length(powered)-54;
function wc_count(powered) = powered ? 5 : 3;
function wc_length(powered) = (wc_end(powered)-wc_start())/wc_count(powered);
function wc_x(powered,index) = wc_start()+index*wc_length(powered);
function wc_clip_x(powered,index,side) = wc_x(powered,index)+(side==0 ? 16 : wc_length(powered)-16);
function wc_payout_panel(powered,index) = index < wc_count(powered)-1;
function wc_print_origin(powered,index) = wc_x(powered,index)-(index==0 ? 8 : 0);
function wc_rear_count(powered,left) = left ? (powered ? 2 : 1) : (powered ? 3 : 2);
function wc_rear_start(powered,left) = left ? -50 : wd_width(powered)/2+wc_post_half_width;
function wc_rear_end(powered,left) = left ? wd_width(powered)/2-wc_post_half_width : wm_base_length(powered)-50;
function wc_rear_length(powered,left) = (wc_rear_end(powered,left)-wc_rear_start(powered,left))/wc_rear_count(powered,left);

module wc_checks(powered=false) {
    wm_checks() wd_checks(powered) {
        assert(wc_wall >= 4 && wc_side-wc_wall >= 75);
        assert(wc_front-wc_wall >= mount_axis_height+70+8);
        assert(wc_length(powered)+wc_lap < 240);
        assert(wc_end(powered)-wm_motor_face(powered)-motor_body_length >= 30);
        assert(wc_fascia_outer >= 98 && wc_post_half_width >= 51);
        assert(wc_rear_z+3 < -20.4, "Rear shield must clear the M4 base screw tip.");
        assert(wc_rear_length(powered,false) < 240);
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
                // A continuous overlap above the fascia closes the seam-cuff
                // recesses to steep front views of the clip bolt heads.
                translate([x,-84,49]) cube([len,4.2,4]);
                if(!wc_payout_panel(powered,index))
                    translate([x,79.8,49]) cube([len,4.2,4]);
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
            // The previous hood's cuff occupies this first 7 mm outside -Y.
            // It provides the overlap here; do not collide with it using a visor.
            if(index>0) translate([x-1,-83.1,48.9]) cube([8,3.09,4.2]);
            wc_line_void(powered);
            wc_loom_void(powered);
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
                // Lower (-Y) motor vents on post, offset from payout side.
                for(cx=[wm_motor_face(powered)+20:20:wm_motor_face(powered)+100])
                    translate([cx,-84,58]) cube([10,12,5]);
            }
        }
        // End returns hide the original 14 mm open-skirt view of base hardware.
        // They stand OUTSIDE the unchanged aluminium plate, never through it.
        if(index==0 || index==n-1) {
            e=index==0 ? -54 : wm_base_length(powered)-49.6;
            difference() {
                union() {
                    translate([e,-98,-32]) cube([3.6,196,50]);
                    // Wrap the lower end corner up to the fascia seam. Without
                    // these returns an oblique rear view exposes anchor tips.
                    for(sy=[-1,1]) scale([1,sy,1])
                        translate([index==0 ? -54 : x+len+0.4,94,-32])
                            cube([index==0 ? 7.6 : wm_base_length(powered)-46-(x+len+0.4),4,50]);
                    translate([index==0 ? -54 : x+len-4,-80,14])
                        cube([index==0 ? 12 : wm_base_length(powered)-46-(x+len-4),index==0 ? 155.4 : 160,4]);
                }
                // Downward baffled drainage, never a direct hardware sightline.
                for(y=[-60:20:60]) translate([e-1,y,-31]) cube([6,8,2]);
            }
            // End-of-kit fascia sockets have no neighboring cuff. Close their
            // inner corner while leaving 0.1 mm to the fascia end wall at Y=83.
            ex=index==0 ? x : x+len-4;
            translate([ex,-82.9,18]) cube([4,3.1,37]);
            if(index==n-1) translate([ex,79.8,18]) cube([4,3.1,37]);
        }
    }
}
module wc_shutter_installed(powered=false,index=0) {
    x=wc_x(powered,index); l=wc_length(powered)-wc_seam;
    difference() {
        union() {
            translate([x,76,wc_skirt]) cube([l,wc_wall,119.4-wc_skirt]);
            translate([x,79.8,49]) cube([l,4.2,4]);
            for(ex=[x,x+l-4]) translate([ex,79.8,18]) cube([4,3.1,37]);
        }
        for(cx=[wc_clip_x(powered,index,0),wc_clip_x(powered,index,1)])
            translate([cx,78,24]) rotate([90,0,0]) cylinder(d=4.5,h=8,center=true,$fn=32);
    }
}
module wc_print_shutter(powered=false) {
    // Outer face flat on bed: X->X, Z->Y, -Y->Z.
    translate([-wc_start(),-wc_skirt,84])
        multmatrix([[1,0,0,0],[0,0,1,0],[0,-1,0,0],[0,0,0,1]]) wc_shutter_installed(powered,0);
}
module wc_print_panel(powered=false,index=0) {
    // Axial seam on bed; 160..180 mm shell width and <190 mm print height.
    // Custom mapping: installed X->print Z, Y->print X, Z->print Y.
    translate([100,32,-wc_print_origin(powered,index)])
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
            // Two rigid key lugs flank the base screw. Lift the fascia and rear
            // shields 2 mm +Z to align the keyhole neck, then withdraw +/-Y.
            for(x=[-9.5,6.5]) {
                translate([x,74,8.8]) cube([3,21,2.4]);
                translate([x,93,11]) cube([3,2,2]);
            }
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
module wc_fascia_installed(powered=false,index=0,pole_side=false) {
    x=wc_x(powered,index); l=wc_length(powered)-wc_seam;
    difference() {
        union() {
            // Smooth white outer face and return conceal side heads, clip heads
            // and rear nuts. Top/rear openings are baffled by the shell/shields.
            wc_axial(x,l) polygon([[80.4,45],[94,45],[98,41],[98,-32],
                [90,-32],[90,-28],[94,-28],[94,38],[80.4,38]]);
            for(ex=[x,x+l-3]) translate([ex,83,14]) cube([3,15,31]);
            for(cx=[wc_clip_x(powered,index,0),wc_clip_x(powered,index,1)],dx=[-8,8])
                translate([cx+dx-2.5,90,4]) cube([5,8,11]);
            if(pole_side) for(i=[0,1])
                translate([wc_loom_x(powered,i),89.15,wc_loom_z(i)])
                    rotate([90,0,0]) cylinder(d=20,h=17.7,center=true,$fn=64);
        }
        if(pole_side) mirror([0,1,0]) wc_loom_void(powered);
        // Clear the preceding main hood's shingle cuff at an axial seam.
        translate([x-1,79,37]) cube([8,4.1,9]);
        // Clear the final cuff/end return over the last 4 mm.
        translate([x+l-4,79,37]) cube([5,4.1,9]);
        for(cx=[wc_clip_x(powered,index,0),wc_clip_x(powered,index,1)],dx=[-8,8]) {
            translate([cx+dx-2,89,5.6]) cube([4,7,5.8]);
            translate([cx+dx-2,93,5.6]) cube([4,3,7.8]);
        }
        // Blind rear shield catches. The outer face remains uninterrupted.
        translate([x-1,93.5,-18.4]) cube([l+2,2.5,3.8]);
        // Underside finger access; opaque outer face conceals the metal stacks.
        for(cx=[wc_clip_x(powered,index,0),wc_clip_x(powered,index,1)])
            translate([cx-12,89,-33]) cube([24,7,6]);
    }
}
module wc_print_fascia(powered=false,pole_side=false) {
    index=pole_side ? wc_pole_panel(powered) : 0;
    // Outer face on bed, same mapping as a payout shutter.
    translate([-wc_x(powered,index),32,98])
        multmatrix([[1,0,0,0],[0,0,1,0],[0,-1,0,0],[0,0,0,1]])
            wc_fascia_installed(powered,index,pole_side);
}
module wc_rear_piece(x,length) {
    union() {
        translate([x,-93.2,wc_rear_z]) cube([length,186.4,3]);
        for(sy=[-1,1]) scale([1,sy,1]) {
            // Rear lip seats in the fascia groove; release fascia before shield.
            translate([x+8,91,wc_rear_z+2.8]) cube([length-16,2.2,11.1]);
            translate([x+8,93,-18]) cube([length-16,2.5,3]);
        }
    }
}
module wc_rear_installed(powered=false,left=true,index=0) {
    l=wc_rear_length(powered,left);
    wc_rear_piece(wc_rear_start(powered,left)+index*l,l-wc_seam);
}
module wc_print_rear(powered=false,left=true) {
    translate([-wc_rear_start(powered,left),93.2,-wc_rear_z]) wc_rear_installed(powered,left,0);
}
module wc_rear_blank_installed(powered=false) {
    // Optional bench closure. REMOVE before attaching the plate to a post.
    wc_rear_piece(wd_width(powered)/2-50.5,101);
}
module wc_print_rear_blank() {
    translate([-wd_width(false)/2+50.5,93.2,-wc_rear_z]) wc_rear_blank_installed(false);
}
module wc_base(powered=false) {
    // Existing blank/interface unchanged; add only shell/loom-anchor Ø4.5 holes.
    difference() {
        wm_base(powered);
        for(i=[0:wc_count(powered)-1],side=[0,1],sy=[-1,1])
            translate([wc_clip_x(powered,i,side),sy*82,-9]) cylinder(d=4.5,h=10,$fn=32);
        for(dx=[-10,10]) translate([wc_anchor_x(powered)+dx,-60,-9]) cylinder(d=4.5,h=10,$fn=32);
    }
}
module wc_assembly(powered=false,exploded=false,show_core=true,show_fascia=true,post_mounted=false) {
    wc_checks(powered) {
        color(ARBI_METAL) wc_base(powered);
        if(show_core) wm_assembly(powered,true,true,false);
        for(i=[0:wc_count(powered)-1]) {
            for(side=[0,1],sy=[-1,1]) color(ARBI_CORE)
                translate([wc_clip_x(powered,i,side),0,0]) scale([1,sy,1]) wc_clip();
            color(ARBI_SHELL) translate([0,0,exploded ? 190+i*18 : 0]) wc_panel_installed(powered,i);
            if(wc_payout_panel(powered,i)) color(ARBI_SHELL)
                translate([0,exploded ? 90 : 0,0]) wc_shutter_installed(powered,i);
            if(show_fascia) for(sy=[-1,1]) color(ARBI_SHELL)
                translate([0,sy*(exploded ? 50 : 0),0]) scale([1,sy,1]) wc_fascia_installed(powered,i,sy==-1 && i==wc_pole_panel(powered));
        }
        if(show_fascia) {
            for(left=[true,false],i=[0:wc_rear_count(powered,left)-1]) color(ARBI_SHELL)
                translate([0,0,exploded ? -50 : 0]) wc_rear_installed(powered,left,i);
            if(!post_mounted) color(ARBI_SHELL)
                translate([0,0,exploded ? -50 : 0]) wc_rear_blank_installed(powered);
        }
        color(ARBI_CORE) translate([wc_anchor_x(powered),-60,0]) wc_cable_anchor();
    }
}

// Nominal stationary looms for context/clearance illustrations, not fabrication.
function wc_bezier(a,b,c,d,t) = a*pow(1-t,3)+b*3*pow(1-t,2)*t+c*3*(1-t)*t*t+d*t*t*t;
function wc_unit(v) = v/norm(v);
function wc_loom_tangent(points,j) = wc_unit(points[min(j+1,len(points)-1)]-points[max(j-1,0)]);
function wc_loom_ring(points,j,k,n) =
    let(t=wc_loom_tangent(points,j),u=wc_unit(cross(t,[0,0,1])),v=cross(t,u))
    points[j]+5*(u*cos(k*360/n)+v*sin(k*360/n));
module wc_loom_run(powered=false,i=0) {
    px=wc_loom_x(powered,i); z=wc_loom_z(i);
    target=wd_width(powered)/2+(i==0 ? -8 : 8);
    a=[px,-105,z]; b=[px,-145,z]; c=[target,-175,-24]; d=[target,-215,-24];
    points=concat([[wm_motor_face(powered)+75,-60,z]],
        [for(angle=[0:3:90]) [px+30-30*sin(angle),-90+30*cos(angle),z]],
        [for(t=[0:0.025:1]) wc_bezier(a,b,c,d,t)], [[target,-310,-24]]);
    // One closed sweep keeps this nominal cable reference quick to export.
    // It is context geometry, not a manufactured cable or bend qualification.
    n=24; last=len(points)-1;
    polyhedron(points=[for(j=[0:last],k=[0:n-1]) wc_loom_ring(points,j,k,n)],
        faces=concat([[for(k=[0:n-1]) k]],
            [for(j=[0:last-1],k=[0:n-1])
                [j*n+k,(j+1)*n+k,(j+1)*n+(k+1)%n,j*n+(k+1)%n]],
            [[for(k=[n-1:-1:0]) last*n+k]]),convexity=10);
}
