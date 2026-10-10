// ARBI compact integrated camera pod rain enclosure, millimetres.
// Ordinary-rain/splash prototype. No ingress rating or physical validation.
// All modules use the same spider-centred assembly frame as camera-pod-mounts.scad.
include <camera-pod-mounts.scad>

pe_wall = 1.2;
pe_floor_z = 13.2;
pe_floor_top = 14.4;
pe_body_center = [0,0];
pe_body_xy = [124,118];
pe_body_radius = 20;
// Front/rear gaps between spider arms keep the underside screw drivers clear.
pe_cover_x = [-22,22];
pe_cover_y = [-46,46];
pe_hood_bottom = 14.8;
pe_hood_roof = 49.5;
pe_power_port = [10,40];
pe_ribbon_port = [0,-48];
pe_servo_port = [-40,-15];
// The fixed shoulder overlaps the circular moving neck without touching it.
// Open-bottom arm reliefs retain a straight upward tray-removal path.
pe_neck_radius = 51.5;
pe_shoulder_bottom = -6.1;

module pe_round_xy(size,r,z,h,center=pe_body_center) {
    hull() for(x=[-size[0]/2+r,size[0]/2-r],y=[-size[1]/2+r,size[1]/2-r])
        pm_cyl(2*r,h,[center[0]+x,center[1]+y,z]);
}
module pe_hood_volume(inset=0,bottom=pe_hood_bottom,top=pe_hood_roof) {
    // Broad rolled crown: sampled quarter-circle shoulder, not a chamfer.
    // Inner and outer profiles share the shoulder centre for a nominal 1.2 mm skin.
    shoulder = 14-inset;
    shoulder_z = pe_hood_roof-14;
    hull() {
        pe_round_xy(pe_body_xy-[2*inset,2*inset],pe_body_radius-inset,bottom,shoulder_z-bottom);
        for(a=[0:7.5:90]) let(d=14-shoulder*cos(a))
            pe_round_xy(pe_body_xy-[2*d,2*d],pe_body_radius-d,
                min(top-.02,shoulder_z+shoulder*sin(a)),.02);
    }
}
module pe_port_holes(z,h) {
    pm_cyl(8,h,[pe_power_port[0],pe_power_port[1],z]);
    pm_box([24,8,h],pe_ribbon_port,z);
    pm_box([9,6,h],pe_servo_port,z);
}

module pe_shoulder_volume(inset=0,lift=0) {
    // A rolled underside changes from the existing rounded tray outline to a
    // circular throat. Vertical and radial inner offsets keep a real skin at
    // the turned-under corners rather than a flat plate with exposed holes.
    profile = [for(a=[0:5:90]) let(t=1-cos(a))
        [pe_floor_z-(pe_floor_z-pe_shoulder_bottom)*sin(a)+lift,
         (pe_body_xy-[3.2,3.2])*(1-t)+[105.4,105.4]*t-[2*inset,2*inset],
         (pe_body_radius-1.6)*(1-t)+52.69*t-inset]];
    // Corresponding corner samples form one ruled solid. This avoids a large
    // stack of CGAL hull unions while retaining the rolled quarter-ellipse.
    corners = [[1,1],[-1,1],[-1,-1],[1,-1]];
    profiles = [for(p=profile) [for(k=[0:3],j=[0:16]) let(a=k*90+j*90/16)
        [corners[k][0]*(p[1][0]/2-p[2])+p[2]*cos(a),
         corners[k][1]*(p[1][1]/2-p[2])+p[2]*sin(a),p[0]]]];
    arbi_ring_volume(profiles);
}

module pe_lower_shoulder() {
    difference() {
        pe_shoulder_volume();
        pe_shoulder_volume(pe_wall,pe_wall);
        pm_cyl(2*pe_neck_radius,22,[0,0,pe_shoulder_bottom-.02]);
        // The original 22 mm spider arms remain the only tensile structure.
        for(a=[45,135,225,315]) rotate([0,0,a])
            translate([0,-11.6,pe_shoulder_bottom-.02])cube([130,23.2,10.22]);
        // Concealed rear breakout for the existing outboard power-route proxy.
        pm_box([9,24,9],[pe_power_port[0],58],-3.5);
        // Recessed bottom access to the existing cover fasteners and CSI port.
        for(x=pe_cover_x,y=pe_cover_y)pm_cyl(8,21,[x,y,pe_shoulder_bottom-.02]);
        pm_box([27,11,21],pe_ribbon_port,pe_shoulder_bottom-.02);
        // Carry the two original drains through the rolled outer skin.
        for(x=[-30,20])pm_box([6,2,21],[x,-56],pe_shoulder_bottom-.02);
    }
}

module camera_pod_rain_hood() {
    difference() {
        union() {
            difference() {
                pe_hood_volume();
                pe_hood_volume(pe_wall,pe_hood_bottom-.1,pe_hood_roof-pe_wall);
            }
            // Blind captive-nut columns clamp hood + deck + base from underneath.
            // Posts end on the deck top; they do not occupy the deck itself.
            for(x=pe_cover_x,y=pe_cover_y) {
                intersection() {
                    pm_cyl(8,pe_hood_roof-pe_wall-20.5,[x,y,20.5]);
                    pe_hood_volume();
                }
                // Clip the rib to the shell so it cannot protrude through the shoulder.
                intersection() {
                    pm_link([x,y],[x,y<0?-58:58],3,3,33);
                    pe_hood_volume();
                }
            }
        }
        for(x=pe_cover_x,y=pe_cover_y) {
            pm_cyl(3.3,27.3,[x,y,20.49]);
            // Side-loaded M3 plain nut pocket; roof above it remains closed.
            translate([x,y,44])cylinder(d=5.8/cos(30),h=2.7,$fn=6);
            pm_box([7,9,2.7],[x,y+(y<0?4.5:-4.5)],44);
        }
    }
}

module pe_gimbal_volume(inset=0) {
    // A narrow neck and rounded cheeks form a separate camera head. Each
    // circular section is centred on the pan/camera axis, not the former tray
    // offset. The lower cheeks clear the swept tilt-servo boot, then roll in.
    profile = [[3.9,90,86],[-8,90,86],[-14,88,86],[-22,94,92],
        [-32,100,98],[-44,102,100],[-60,102,100],[-70,100,98],
        [-76,96,94],[-81,88,86],[-84,78,76]];
    for(i=[0:len(profile)-2]) hull() for(j=[i,i+1])
        translate([0,0,profile[j][0]])
            scale([(profile[j][1]-2*inset)/2,(profile[j][2]-2*inset)/2,1])
                cylinder(r=1,h=.02,$fn=128);
}
pe_fairing_anchors = [[-40,0],[40,0],[0,-36],[0,36]];
module camera_pod_pan_fairing() {
    difference() {
        union() {
            difference() {pe_gimbal_volume();pe_gimbal_volume(pe_wall);}
            for(p=pe_fairing_anchors) {
                pm_cyl(6,20.7,[p[0],p[1],-7.5]);
                // Reach the shell independently of each tower's radius.
                pm_link(p,[p[0]==0?0:(p[0]<0?-44:44),p[1]==0?0:(p[1]<0?-42:42)],6,3.2,-7.5);
            }
        }
        for(p=pe_fairing_anchors)pm_cyl(2.3,21,[p[0],p[1],-7.51]);
        // Open-top arm notches permit a straight approach from below the spider.
        // Clear the four existing 22 mm arms; no new load path through the skin.
        for(a=[45,135,225,315]) rotate([0,0,a])
            translate([0,-11.6,-4.1])cube([130,23.2,9]);
        // A front visor frames the eye; the rounded rear cap remains behind it.
        // The wraparound lower opening leaves the full side-looking optical
        // sweep clear instead of enclosing the lens in fixed side cheeks.
        intersection() {
            union() {
                translate([0,-120,-92])rotate([-90,0,0])cylinder(d=128,h=240,$fn=128);
                translate([-64,-120,-120])cube([128,240,28]);
            }
            translate([0,0,-130])linear_extrude(140)
                polygon([[-120,120],[120,120],[120,-102],[0,0],[-120,-102]]);
        }
    }
}
module camera_pod_enclosure_base() {
    difference() {
        union() {
            // Closed lower rain tray, with a raised lip inside the upper shell.
            pe_round_xy(pe_body_xy-[3.2,3.2],pe_body_radius-1.6,pe_floor_z,pe_wall);
            pe_lower_shoulder();
            difference() {
                pe_round_xy(pe_body_xy-[3.2,3.2],pe_body_radius-1.6,pe_floor_z,7.2);
                pe_round_xy(pe_body_xy-[5.6,5.6],pe_body_radius-2.8,pe_floor_z-.01,7.3);
            }
            // Same cover anchors as the existing deck: no holes in the spider.
            for(x=pe_cover_x,y=pe_cover_y)pm_cyl(8,3.1,[x,y,pe_floor_top]);
            // Downward outlets / drip collars; connectors stay inside the shell.
            pm_cyl(11,5,[pe_power_port[0],pe_power_port[1],8.2]);
            pm_box([27,11,5],pe_ribbon_port,8.2);
            pm_box([12,9,5],pe_servo_port,8.2);
        }
        for(x=pe_cover_x,y=pe_cover_y)pm_cyl(3.3,5,[x,y,13.19]);
        for(x=[-pm_mount_xy,pm_mount_xy],y=[-pm_mount_xy,pm_mount_xy])
            pm_cyl(11.2,2,[x,y,13.19]); // Existing spacer passes through the tray.
        // Through clearance includes any outlet collar under the Pi screw tips.
        for(x=[-51,7],y=[-24.5,24.5])pm_cyl(3.3,6.3,[x,y,8.19]);
        pe_port_holes(8.19,6.3);
        // Drain slots straddle the lip's inner edge; water exits down.
        for(x=[-30,20])pm_box([6,2,2],[x,-56],13.19);
    }
}

module camera_pod_tilt_servo_boot() {
    difference() {
        union() {
            difference() {
                pe_round_xy([20,15],2,-70,31.5,[-36.5,0]);
                pe_round_xy([17.6,12.6],.8,-68.8,29.1,[-36.5,0]);
                // Open spline side; boot never retains the servo itself.
                pm_box([5,13,31],[-26.5,0],-69);
            }
            for(y=[-10,10]) hull() {
                pm_xcyl(6,2.5,[-29,y,-35]);
                pm_xcyl(6,2.5,[-29,y<0?-5:5,-40]);
            }
        }
        // Lug/gearbox relief also cuts the attachment bridges, not just the skin.
        pm_box([21,9.7,28],[-34.5,0],-68);
        // Clear the yoke's thicker upper bridge while retaining the outer ears.
        pm_box([4,14.2,16],[-25.1,0],-44);
        for(y=[-10,10])pm_xcyl(2.3,4,[-29.01,y,-35]);
        // Provisional 6 x 4 downward lead exit; check the received case exit.
        pm_box([19,4,5],[-33.5,0],-70.01); // Open to spline side: fit around an attached lead.
    }
}

module camera_pod_camera_cowl() {
    difference() {
        union() {
            difference() {
                pe_round_xy([37,37],4,-66.2,14, [0,-5]);
                pe_round_xy([34.6,34.6],2.8,-66.21,12.81,[0,-5]);
            }
            // Bosses seat on the existing camera nuts so the cowl clamps solidly.
            for(x=[-10.5,10.5],y=[4.931,-7.569])pm_cyl(5,3.4,[x,y,-55.6]);
        }
        for(x=[-10.5,10.5],y=[4.931,-7.569])pm_cyl(2.3,3.5,[x,y,-55.61]);
        // Reliefs for driven horn carrier and supported pivot, not sealing surfaces.
        pm_box([10,29,24],[-20,0],-72);
        // Open-ended relief lets the cowl lift past the pivot and support pad.
        pm_box([10,24,16],[19,0],-68);
        // Camera CSI plug + relaxed flat ribbon exit, away from the optical face.
        // Open to the lower edge so the cowl can withdraw past retained screws.
        pm_box([24,6,9.21],[0,12.5],-66.21);
    }
}

// Integrated optical face: a rounded eye centred on the nominal lens axis.
// The rear cavity and clamp axes retain the board/hardware clearances.
module camera_pod_integrated_camera_hood() {
    difference() {
        union() {
            difference() {
                pe_round_xy([34,36],9,2,8,[0,-2.469]);
                pm_box([26.6,25.6,8],[0,0],3.4);
                pm_cyl(14,2,[0,-2.469,1.99]);
            }
            for(x=[-10.5,10.5],y=[9.931,-2.569]) {
                pm_cyl(4.8,1.4,[x,y,10]);
                pm_link([x,y],[x<0?-14.8:14.8,y],4.8,1.4,10);
            }
        }
        for(x=[-10.5,10.5],y=[9.931,-2.569])pm_cyl(2.3,3,[x,y,9.5]);
        // Recessed access tunnels admit the M2 head and 5 mm washer as well as its
        // driver. Keep the original clamp tabs at Z=10..11.4 intact.
        for(x=[-10.5,10.5],y=[9.931,-2.569])pm_cyl(5.4,7.71,[x,y,1.99]);
    }
}
