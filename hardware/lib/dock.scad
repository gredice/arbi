// DOCK-IF-01 r0.2.0 - concept-unvalidated, millimetres.
// Candidate bench mechanics only. No load rating or installed authority.
// Shared post parameters and spider dimensions retain their owning sources.
include <corner-head.scad>
include <camera-pod.scad>

dk_axis_x = post_size_mm/2+390;
dk_joint_x = post_size_mm/2+190;
dk_mouth_z = 65;
dk_throat_z = 120;
dk_fork_z = 145.6;
dk_release_mm = 40;
dk_head_d = 24;
dk_stem_d = 14;
dk_locator_d = 26;
dk_slot = 17;
dk_bridge_r = 90;
dk_bridge_z = 70;
dk_facets = 64;
dk_roof_wall = 2.8;
dk_roof_bottom = 175;
dk_roof_profiles = [[300,40,175], [300,40,195], [296,38,207],
                    [280,34,215], [220,26,219], [1,.5,219.98]];

module dk_box(size,center=[0,0],z=0) {
    translate([center[0]-size[0]/2,center[1]-size[1]/2,z])cube(size);
}
module dk_cyl(d,h,p=[0,0,0]) {translate(p)cylinder(d=d,h=h,$fn=dk_facets);}
module dk_link(a,b,w,h,z) {
    hull()for(p=[a,b])dk_cyl(w,h,[p[0],p[1],z]);
}
module dk_round_plan(size,r) {
    hull()for(x=[-size[0]/2+r,size[0]/2-r],
               y=[-size[1]/2+r,size[1]/2-r])
        translate([x,y])circle(r=r,$fn=64);
}
// Edge-open passage: the round inner end is at radius 95 mm.
// Only a synthetic vertical line pose is accepted by the nominal bench checks.
module dk_line_slot(z,h) {
    rotate([0,0,45])hull()for(r=[104,235])dk_cyl(18,h,[r,0,z]);
}
module dk_checks() {
    assert(post_shape=="round","Dock study uses the shared round-post configuration.");
    assert(post_size_mm>=100 && post_size_mm<=140);
    assert(dk_stem_d<dk_slot && dk_slot<dk_head_d && dk_head_d<dk_locator_d);
    assert(dk_release_mm>26+dk_head_d/2);
    children();
}

// One independently attached quadrant; install four rotated about +Z.
module dock_guide_quarter_tapered() {
    dk_checks()difference() {
        union() {
            intersection() {
                difference() {
                    translate([0,0,65])cylinder(h=55,d1=283,d2=68,$fn=128);
                    translate([0,0,64.98])cylinder(h=55.04,d1=275,d2=60,$fn=128);
                }
                translate([0,0,65])cube([150,150,60]);
            }
            dk_cyl(16,5,[30,30,115]);
        }
        dk_cyl(4.5,8,[30,30,114]);
        // Underside tool/nut relief; the tab's flat seat stays at Z115.
        dk_cyl(10,10,[30,30,105]);
        dk_line_slot(60,65);
    }
}

module dock_locator_carrier() {
    dk_checks()difference() {
        union() {
            dk_cyl(68,52.8,[0,0,120]);
            dk_box([90,90,6],[0,0],150);
            // Two guide rails and a stationary spring reaction bridge.
            for(y=[-26,26])dk_box([112,6,9],[-22,y],141);
            dk_box([8,58,20],[-82,0],141);
        }
        translate([0,0,119.98])cylinder(h=24.54,d1=60,d2=dk_locator_d,$fn=dk_facets);
        dk_cyl(dk_locator_d,16.32,[0,0,144.5]);
        // Upward stop contacts the mushroom rim, clearing its bought bolt head.
        dk_cyl(10,5,[0,0,160.8]);
        dk_box([180,45,5.2],[-30,0],145.2);
        // Nominal spring/guide rod passage; product and force remain unselected.
        translate([-83,0,147.6])rotate([0,90,0])cylinder(d=4.5,h=10,$fn=32);
        for(x=[-30,30],y=[-30,30])dk_cyl(4.5,38,[x,y,119]);
        for(x=[-40,40],y=[-40,40])dk_cyl(4.5,8,[x,y,149]);
    }
}

module dock_latch_fork() {
    dk_checks()difference() {
        union() {
            dk_box([52,44,4],[0,0],dk_fork_z);
            dk_box([16,12,4],[-30,0],dk_fork_z);
        }
        // Open-ended U slot; asymmetric rear lead-in is a capture study only.
        dk_cyl(dk_slot,4.04,[0,0,dk_fork_z-.02]);
        dk_box([36,dk_slot,4.04],[18,0],dk_fork_z-.02);
        translate([0,0,dk_fork_z-.02])cylinder(h=3,d1=30,d2=dk_slot,$fn=dk_facets);
        dk_cyl(3.5,4.04,[-31,0,dk_fork_z-.02]);
    }
}

module dock_pod_bridge() {
    dk_checks()difference() {
        union() {
            for(a=[45,135,225,315])rotate([0,0,a]) {
                dk_box([20,40,8],[dk_bridge_r,0],3.5);
                dk_cyl(8,63.5,[dk_bridge_r,0,11.5]);
            }
            for(a=[45,135,225,315])
                dk_link([0,0],[dk_bridge_r*cos(a),dk_bridge_r*sin(a)],6,5,dk_bridge_z);
            dk_cyl(36,5,[0,0,dk_bridge_z]);
        }
        for(a=[45,135,225,315])rotate([0,0,a])
            for(y=[-16,16])dk_cyl(3.5,8.04,[dk_bridge_r,y,3.48]);
        dk_cyl(4.5,5.04,[0,0,dk_bridge_z-.02]);
        for(a=[45,135,225,315])dk_cyl(12,8.04,[104*cos(a),104*sin(a),3.48]);
    }
}

// One lower shoe per spider arm. Side cheeks capture the arm width positively.
module dock_pod_bridge_shoe() {
    difference() {
        union() {
            dk_box([20,40,6],[0,0],-9.5);
            for(y=[-15.65,15.65])dk_box([20,8.7,6.5],[0,y],-3.5);
        }
        for(y=[-16,16])dk_cyl(3.5,13.04,[0,y,-9.52]);
        dk_cyl(12,13.04,[104-dk_bridge_r,0,-9.52]);
    }
}

module dock_pod_stud() {
    difference() {
        union() {
            dk_cyl(32,4,[0,0,75]);
            dk_cyl(dk_stem_d,70.8,[0,0,79]);
            // Flat shoulder settles 0.2 mm onto the Z149.6 fork top.
            // A taper at the retained contact would wedge against the slot edge.
            dk_cyl(dk_head_d,11,[0,0,149.8]);
        }
        dk_cyl(4.5,85.84,[0,0,74.98]);
    }
}

module dock_arm_root() {
    dk_checks()difference() {
        union() {
            dk_box([post_size_mm/2+28,60,205],[(post_size_mm/2+28)/2,0]);
            // Two triangular webs and a top chord; dedicated dock bolt rows.
            for(y=[-22,30])translate([0,y,0])rotate([90,0,0])
                linear_extrude(height=8)polygon([[post_size_mm/2+20,5],[dk_joint_x,120],[dk_joint_x,150],[post_size_mm/2+20,205]]);
            dk_box([230,60,30],[post_size_mm/2+115,0],120);
        }
        dk_cyl(post_size_mm+.5,207,[0,0,-1]);
        for(z=[45,155])translate([0,0,z])rotate([0,90,0])cylinder(d=13,h=120,$fn=32);
        // Clear the upper-row washer/head and a nominal 40 mm axial tool path.
        translate([post_size_mm/2+28,0,155])rotate([0,90,0])cylinder(d=40,h=205,$fn=64);
        // Horizontal lap; extension seats above this tongue.
        dk_box([42,64,16],[dk_joint_x+21,0],135);
        for(x=[dk_joint_x+10,dk_joint_x+30])dk_cyl(8.6,17,[x,0,119]);
    }
}

module dock_arm_extension() {
    difference() {
        union() {
            dk_box([245,60,30],[dk_joint_x+122.5,0],120);
            dk_box([95,100,30],[dk_axis_x-2.5,0],120);
        }
        dk_box([40.02,64,15.02],[dk_joint_x+20,0],119.98);
        for(x=[dk_joint_x+10,dk_joint_x+30])dk_cyl(8.6,17,[x,0,134]);
        dk_cyl(70,32,[dk_axis_x,0,119]);
        dk_box([135,59.2,11], [dk_axis_x-27.5,0],140.5);
        for(x=[-30,30],y=[-30,30])dk_cyl(4.5,32,[dk_axis_x+x,y,119]);
        for(x=[-40,40],y=[-40,40]) {
            dk_cyl(4.5,32,[dk_axis_x+x,y,119]);
            dk_cyl(11,6,[dk_axis_x+x,y,119]);
        }
    }
}

module dock_post_rear_pad() {
    dk_checks()difference() {
        dk_box([post_size_mm/2+14,60,50],[-(post_size_mm/2+14)/2,0],-25);
        dk_cyl(post_size_mm+.5,52,[0,0,-26]);
        translate([-100,0,0])rotate([0,90,0])cylinder(d=13,h=102,$fn=32);
    }
}

// Rounded removable appearance shell; it is not the pod retention load path.
// Hull profiles form a shallow crown and an open underside. Inner profiles
// are inset 2.8 mm in XY and Z; sampled mesh sections check actual skin thickness.
module dk_roof_envelope(inset=0) {
    hull()for(p=dk_roof_profiles) {
        w=max(1,p[0]-2*inset);
        r=max(.5,min(w/2,p[1]-inset));
        z=p[2]-inset;
        translate([0,0,z])linear_extrude(height=.02)dk_round_plan([w,w],r);
    }
    if(inset>0)translate([0,0,170])linear_extrude(height=6)
        dk_round_plan([300-2*inset,300-2*inset],40-inset);
}
// Four identical quadrants retain the existing roof bolt and seam axes.
// Print rim-down with reviewed supports, not on the curved exterior.
module dock_roof_quarter(open_lines=true) {
    difference() {
        union() {
            intersection() {
                difference(){dk_roof_envelope();dk_roof_envelope(dk_roof_wall);}
                dk_box([150,150,60],[75,75],170);
            }
            // Flat Z205 spacer contact, Z215 washer pocket floor; the boss
            // reaches the crown so the fastener is not a disconnected island.
            dk_cyl(16,14.2,[40,40,205]);
            dk_box([3,30,20],[1.5,80],198);
            dk_box([30,3,20],[80,1.5],198);
        }
        dk_cyl(4.5,28,[40,40,204]);
        dk_cyl(11,20,[40,40,215]);
        if(open_lines)dk_line_slot(170,65);
        else dk_cyl(18,65,[104*cos(45),104*sin(45),170]);
        translate([-1,80,203])rotate([0,90,0])cylinder(d=3.5,h=5,$fn=24);
        translate([80,-1,203])rotate([-90,0,0])cylinder(d=3.5,h=5,$fn=24);
    }
}
module dock_roof_spacer() {
    difference() {dk_cyl(10,49);dk_cyl(4.5,49.04,[0,0,-.02]);}
}

module dock_assembly(released=false) {
    color(ARBI_CORE) {
        dock_locator_carrier();
        translate([released?-dk_release_mm:0,0,0])dock_latch_fork();
        for(a=[0,90,180,270])rotate([0,0,a])dock_guide_quarter_tapered();
        translate([-dk_axis_x,0,0]) {dock_arm_root();dock_arm_extension();
            for(z=[45,155])translate([0,0,z])dock_post_rear_pad();}
        dock_pod_bridge();dock_pod_stud();
        for(a=[45,135,225,315])rotate([0,0,a])translate([dk_bridge_r,0,0])dock_pod_bridge_shoe();
        for(x=[-40,40],y=[-40,40])translate([x,y,156])dock_roof_spacer();
    }
    color(ARBI_SHELL)for(a=[0,90,180,270])rotate([0,0,a])dock_roof_quarter();
    color([.66,.70,.73])dock_bench_hardware();
}

// Provisional nominal bought envelopes. Threads simplified; no supplier approval.
module dk_washer(d,od,h,z=0) {
    difference(){dk_cyl(od,h,[0,0,z]);dk_cyl(d+.5,h+.04,[0,0,z-.02]);}
}
module dk_nut(d,od,h,z=0) {
    difference(){translate([0,0,z])cylinder(d=od,h=h,$fn=6);dk_cyl(d+.5,h+.04,[0,0,z-.02]);}
}
module dk_bolt(d,length,bearing,head_d,head_h) {
    dk_cyl(d,length,[0,0,bearing-length]);
    translate([0,0,bearing])cylinder(d=head_d,h=head_h,$fn=6);
}
module dock_bench_hardware() {
    // M12 axes toward +X, two dedicated dock rows.
    for(z=[45,155])translate([-dk_axis_x,0,z])rotate([0,90,0]) {
        dk_bolt(12,post_size_mm+70,post_size_mm/2+31,21,8);
        dk_washer(12,37,3,post_size_mm/2+28);
        dk_washer(12,37,3,-post_size_mm/2-17);
        dk_nut(12,21,12,-post_size_mm/2-29);
    }
    for(x=[dk_joint_x+10,dk_joint_x+30])translate([x-dk_axis_x,0,0]) {
        dk_bolt(8,50,151.6,14,5.5);dk_washer(8,16,1.6,150);
        dk_washer(8,16,1.6,118.4);dk_nut(8,14,6.5,111.9);
    }
    for(x=[-40,40],y=[-40,40])translate([x,y,0]) {
        dk_bolt(4,100,216,7,3);dk_washer(4,9,1,215);
        dk_washer(4,9,1,124);dk_nut(4,7,4,120);
    }
    for(x=[-30,30],y=[-30,30])translate([x,y,0]) {
        dk_bolt(4,50,157,7,3);dk_washer(4,9,1,156);
        dk_washer(4,9,1,114);dk_nut(4,7,4,110);
    }
    dk_bolt(4,100,161.8,7,3);dk_washer(4,9,1,160.8);
    dk_washer(4,9,1,69);dk_nut(4,7,4,65);
    for(a=[45,135,225,315])rotate([0,0,a])translate([dk_bridge_r,0,0])
        for(y=[-16,16])translate([0,y,0]) {
            dk_bolt(3,30,12,5.5,2);dk_washer(3,7,.5,11.5);
            dk_washer(3,7,.5,-10);dk_nut(3,5.5,2.4,-12.4);
        }
    for(a=[0,90,180,270])rotate([0,0,a])translate([0,80,203])rotate([0,90,0]) {
        dk_bolt(3,16,3.5,5.5,2);dk_washer(3,7,.5,3);
        dk_washer(3,7,.5,-3.5);dk_nut(3,5.5,2.4,-5.9);
    }
}
