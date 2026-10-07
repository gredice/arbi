// ARBI integrated payload rain enclosure r0.1.0, millimetres.
// Ordinary-rain/splash prototype. No ingress rating or physical validation.
// All modules use the same spider-centred assembly frame as payload-mounts.scad.
include <payload-mounts.scad>

pe_wall = 1.2;
pe_floor_z = 13.2;
pe_floor_top = 14.4;
pe_body_center = [-3.5,0];
pe_body_xy = [160,86];
pe_body_radius = 10;
pe_hood_bottom = 14.8;
pe_hood_roof = 49.5;
pe_power_port = [-8,31];
pe_ribbon_port = [0,-27];
pe_servo_port = [-22,-32];

module pe_round_xy(size,r,z,h,center=pe_body_center) {
    hull() for(x=[-size[0]/2+r,size[0]/2-r],y=[-size[1]/2+r,size[1]/2-r])
        pm_cyl(2*r,h,[center[0]+x,center[1]+y,z]);
}
module pe_hood_volume(inset=0,bottom=pe_hood_bottom,top=pe_hood_roof) {
    // A printable 45-degree shoulder; continuous roof, no top fastener holes.
    hull() {
        pe_round_xy(pe_body_xy-[2*inset,2*inset],pe_body_radius-inset,bottom,top-bottom-6);
        pe_round_xy(pe_body_xy-[12+2*inset,12+2*inset],pe_body_radius-inset,top-.1,.1);
    }
}
module pe_port_holes(z,h) {
    pm_cyl(8,h,[pe_power_port[0],pe_power_port[1],z]);
    pm_box([24,8,h],pe_ribbon_port,z);
    pm_box([9,6,h],pe_servo_port,z);
}

module payload_rain_hood() {
    difference() {
        union() {
            difference() {
                pe_hood_volume();
                pe_hood_volume(pe_wall,pe_hood_bottom-.1,pe_hood_roof-pe_wall);
            }
            // Blind captive-nut columns clamp hood + deck + base from underneath.
            // Posts end on the deck top; they do not occupy the deck itself.
            for(x=pm_cover_x,y=pm_cover_y) {
                pm_cyl(8,pe_hood_roof-pe_wall-20.5,[x,y,20.5]);
                // Clip the rib to the shell so it cannot protrude through the shoulder.
                intersection() {
                    pm_link([x,y],[x,y<0?-41.8:41.8],3,3,44);
                    pe_hood_volume();
                }
            }
        }
        for(x=pm_cover_x,y=pm_cover_y) {
            pm_cyl(3.3,27.3,[x,y,20.49]);
            // Side-loaded M3 plain nut pocket; roof above it remains closed.
            translate([x,y,44])cylinder(d=5.8/cos(30),h=2.7,$fn=6);
            pm_box([7,9,2.7],[x,y+(y<0?4.5:-4.5)],44);
        }
    }
}

module pe_gimbal_volume(inset=0) {
    // Rounded lower fairing, entirely below the spider for vertical assembly.
    hull() {
        pm_cyl(108-2*inset,1.2,[0,0,-5.5]);
        pm_cyl(114-2*inset,1,[0,0,-20]);
        pm_cyl(106-2*inset,1,[0,0,-38]);
    }
}
pe_fairing_anchors = [[-40,0],[40,0],[0,-36],[0,36]];
module payload_pan_fairing() {
    difference() {
        union() {
            difference() {pe_gimbal_volume();pe_gimbal_volume(pe_wall);}
            for(p=pe_fairing_anchors) {
                pm_cyl(6,20.7,[p[0],p[1],-7.5]);
                // Reach the shell independently of each tower's radius.
                pm_link(p,[p[0]==0?0:(p[0]<0?-54:54),p[1]==0?0:(p[1]<0?-54:54)],6,3.2,-7.5);
            }
        }
        for(p=pe_fairing_anchors)pm_cyl(2.3,21,[p[0],p[1],-7.51]);
    }
}
module payload_enclosure_base() {
    difference() {
        union() {
            // Closed lower rain tray, with a raised lip inside the upper shell.
            pe_round_xy([156.8,82.8],8.4,pe_floor_z,pe_wall);
            difference() {
                pe_round_xy([156.8,82.8],8.4,4.3,16.1);
                pe_round_xy([154.4,80.4],7.2,4.29,16.2);
            }
            // Same cover anchors as the existing deck: no holes in the spider.
            for(x=pm_cover_x,y=pm_cover_y)pm_cyl(8,3.1,[x,y,pe_floor_top]);
            // Downward outlets / drip collars; connectors stay inside the shell.
            pm_cyl(11,5,[pe_power_port[0],pe_power_port[1],8.2]);
            pm_box([27,11,5],pe_ribbon_port,8.2);
            pm_box([12,9,5],pe_servo_port,8.2);
        }
        for(x=pm_cover_x,y=pm_cover_y)pm_cyl(3.3,5,[x,y,13.19]);
        for(p=pe_fairing_anchors)pm_cyl(2.3,2,[p[0],p[1],13.19]);
        for(x=[-pm_mount_xy,pm_mount_xy],y=[-pm_mount_xy,pm_mount_xy])
            pm_cyl(11.2,2,[x,y,13.19]); // Existing spacer passes through the tray.
        // Through clearance includes any outlet collar under the Pi screw tips.
        for(x=[-66,-8],y=[-24.5,24.5])pm_cyl(3.3,6.3,[x,y,8.19]);
        pe_port_holes(8.19,6.3);
        // Drain slots straddle the lip's inner edge; water exits down.
        for(x=[-40,40])pm_box([6,2,2],[x,-40],13.19);
    }
}

module payload_tilt_servo_boot() {
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

module payload_camera_cowl() {
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
