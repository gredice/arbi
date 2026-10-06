// ARBI payload mount set 0.1.0 — concept-unvalidated, millimetres.
// Assembly frame: spider mid-plane Z=0; camera looks -Z at pan=tilt=0.
// Servo nominal dimensions are provisional; measure before a full print.
include <arbi.scad>

PM_EPS = 0.02;
PM_FN = 64;
pm_servo_body = [20,8.5,18];
pm_servo_lug_pitch = 24;
pm_servo_lug_span = 27;
pm_servo_fit = 0.8; // total body clearance, 0.4 per side
pm_mount_xy = 22/sqrt(2);
pm_pi_center = [-37,0];
pm_pi_pitch = [58,49];
pm_cover_x = [-72,65];
pm_cover_y = [-32,32];
pm_pan_stop_angle = 95 + 2*asin(3/(2*30));
pm_tilt_stop_delta = 2*asin(3/(2*10));

module pm_box(size,center=[0,0],z=0) {
    translate([center[0]-size[0]/2,center[1]-size[1]/2,z]) cube(size);
}
module pm_cyl(d,h,p=[0,0,0]) {translate(p)cylinder(d=d,h=h,$fn=PM_FN);}
module pm_hole(d,h,p=[0,0,0]) {pm_cyl(d,h,p);}
module pm_link(a,b,width,h,z) {
    hull() for(p=[a,b]) pm_cyl(width,h,[p[0],p[1],z]);
}
module pm_slot(a,b,d,h,z) {pm_link(a,b,d,h,z);}
module pm_xcyl(d,h,p=[0,0,0]) {translate(p)rotate([0,90,0])cylinder(d=d,h=h,$fn=PM_FN);}
module pm_zring(od,id,h,z=0) {difference(){pm_cyl(od,h,[0,0,z]);pm_cyl(id,h+2*PM_EPS,[0,0,z-PM_EPS]);}}

// Built in assembly coordinates. Feet touch the existing spider at Z=3.5.
module payload_electronics_deck() {
    difference() {
        union() {
            // Open Pi frame and power-board frame, with a central connecting spine.
            for(x=[-66,-8]) pm_link([x,-24.5],[x,24.5],7,3,17.5);
            for(y=[-24.5,24.5]) pm_link([-66,y],[-8,y],7,3,17.5);
            pm_link([-66,0],[65,0],10,3,17.5);
            for(y=[-16,16]) pm_link([14,y],[65,y],6,3,17.5);
            for(x=[14,65]) pm_link([x,-16],[x,16],6,3,17.5);
            for(x=[-pm_mount_xy,pm_mount_xy],y=[-pm_mount_xy,pm_mount_xy]) {
                pm_cyl(10,3,[x,y,17.5]);
                pm_link([x,y],[x,0],6,3,17.5);
            }
            // Pi standoffs, 10 mm board underside clearance above the deck.
            for(x=[-66,-8],y=[-24.5,24.5]) pm_cyl(6,10,[x,y,20.5]);
            // Converter supports: 2 mm below-board air space, no assumed PCB holes.
            for(x=[20,60],y=[-10,10]) {
                pm_link([x,y],[x,y<0?-16:16],5,3,17.5);
                pm_cyl(5,2,[x,y,20.5]);
            }
            // Capacitor foot and loose cup: nominal 10 mm can, 10.6 mm pocket.
            pm_link([48,16],[48,26],14,3,17.5);
            pm_cyl(13.4,9,[48,26,20.5]);
            pm_link([39,26],[57,26],6,3,17.5);
            for(x=pm_cover_x,y=pm_cover_y) {
                pm_cyl(8,3,[x,y,17.5]);
                pm_link([x,y],[x<0?-66:65,y<0?-24.5:24.5],5,3,17.5);
                if(x>0) pm_link([x,y<0?-24.5:24.5],[65,y<0?-16:16],5,3,17.5);
            }
            // Dedicated tie-down pad for the sleeved incoming wire, not a tensile termination.
            pm_link([14,16],[14,31],9,3,17.5);
            pm_link([0,0],[0,-31],22,3,17.5);
        }
        for(x=[-pm_mount_xy,pm_mount_xy],y=[-pm_mount_xy,pm_mount_xy])pm_hole(4.5,4,[x,y,17.49]);
        for(x=[-66,-8],y=[-24.5,24.5])pm_hole(2.9,15,[x,y,17.49]);
        for(x=pm_cover_x,y=pm_cover_y)pm_hole(3.3,4,[x,y,17.49]);
        // Two 2.5 mm wide ties cross clear strips on the illustrative converter PCB.
        for(x=[28,62],y=[-16,16])pm_box([3.2,2.0,4],[x,y],17.49);
        pm_cyl(10.6,7,[48,26,23.5]);
        pm_cyl(6.2,7,[48,26,17.49]);
        for(x=[39,57])pm_box([1.8,3.2,4],[x,26],17.49);
        for(x=[-9,9])pm_box([1.8,3.2,4],[x,-31],17.49);
        for(y=[23,29])pm_box([3.2,1.8,4],[14,y],17.49);
    }
}

// Pan servo inserted from above BEFORE attaching this cradle to the spider.
module payload_pan_servo_mount() {
    difference() {
        union() {
            pm_cyl(54,3,[0,0,-6.5]);
            // End columns keep servo sides and horn-retainer screws accessible.
            for(x=[-21,11])pm_box([3,14,18.5],[x,0],-25);
            pm_box([35,14,2.5],[-5,0],-25);
            for(a=[-pm_pan_stop_angle,pm_pan_stop_angle]) {
                p=[-30*sin(a),30*cos(a)];
                pm_link([p[0],p[1]],[p[0]*.65,p[1]*.65],5,3,-6.5);
                pm_cyl(3,18.5,[p[0],p[1],-25]);
            }
        }
        // Upper insertion opening clears the entire servo including mounting ears.
        pm_box([pm_servo_lug_span+1.2,pm_servo_body[1]+1.5,4],[-5,0],-6.51);
        pm_box([pm_servo_body[0]+pm_servo_fit,pm_servo_body[1]+pm_servo_fit,3],[-5,0],-25.01);
        for(x=[-5-pm_servo_lug_pitch/2,-5+pm_servo_lug_pitch/2]) {
            pm_cyl(1.9,4,[x,0,-25.01]);
            translate([x,0,-25.01])cylinder(d1=3.5,d2=1.9,h=1.11,$fn=PM_FN);
        }
        for(x=[-pm_mount_xy,pm_mount_xy],y=[-pm_mount_xy,pm_mount_xy])pm_cyl(4.5,4,[x,y,-6.51]);
    }
}

// Stock horn pockets use a loose hub + single arm. No printed servo spline.
// Local pocket opens at Z=0, extends -2.2. Nominal horn: hub OD8, arm 12 long.
module pm_horn_pocket() {
    pm_cyl(8.6,2.3,[0,0,-2.2]);
    pm_slot([0,0],[12,0],4.0,2.3,-2.2);
    pm_cyl(4.5,8,[0,0,-6]); // OEM horn-screw head/driver access from underside
}
module payload_horn_retainer() {
    difference() {
        union() {
            pm_box([21,26,1.2],[3,0],0);
            pm_box([8,2,0.7],[9,0],-.7);
            pm_cyl(12,1.2);
        }
        pm_cyl(8.2,3,[0,0,-1]);
        for(x=[-7,7])pm_cyl(4.6,3,[x,0,-1]); // servo-ear nut / tip clearance
        for(y=[-10,10]) {
            pm_cyl(2.3,3,[0,y,-1]);
            translate([0,y,.1])cylinder(d1=2.3,d2=4.2,h=1.12,$fn=PM_FN);
        }
    }
}

module payload_pan_yoke() {
    difference() {
        union() {
            pm_box([53,16,4.5],[-1.5,0],-31.7); // pan horn-bearing crossbeam
            pm_box([23,26,4.5],[2,0],-31.7);
            // Vertical tilt-servo lug plate, holes reached from the outside.
            pm_box([2.5,14,33],[-25.25,0],-71);
            pm_box([3,14,10],[-25.5,0],-40);
            // Removable opposite pivot support fastens below this pad.
            pm_box([10,22,4.5],[23,0],-31.7);
            pm_link([0,-8],[0,-23],22,2.5,-31.7);
            // Pan hard-stop tab remains above the crossbeam and outside servo body.
            pm_link([0,8],[0,30],4,4.5,-31.7);
            pm_cyl(3,10.2,[0,30,-31.7]);

        }
        translate([0,0,-27.2])pm_horn_pocket();
        for(y=[-10,10])pm_cyl(2.3,6,[0,y,-32]);
        for(x=[-9,9])pm_box([1.8,3.2,4],[x,-23],-32);
        // Body crosses the plate along X, its 20 mm length is vertical here.
        pm_box([4,pm_servo_body[1]+pm_servo_fit,pm_servo_body[0]+pm_servo_fit],[-25.5,0],-54-(pm_servo_body[0]+pm_servo_fit)/2);
        for(z=[-54-pm_servo_lug_pitch/2,-54+pm_servo_lug_pitch/2]) {
            pm_xcyl(1.9,4,[-27,0,z]);
            translate([-23.99,0,z])rotate([0,-90,0])cylinder(d1=3.5,d2=1.9,h=1.11,$fn=PM_FN);
        }
        for(y=[-7,7])pm_cyl(2.3,6,[23,y,-32]);
    }
}

// Camera cradle at tilt=0. PCB underside at -64; lens points down.
module payload_camera_cradle() {
    difference() {
        union() {
            difference() {
                pm_box([29,28,2.5],[0,-5],-60);
                pm_box([18,20,3],[0,-5],-60.01);
            }
            for(x=[-10.5,10.5],y=[4.931,-7.569])pm_cyl(4.8,6.5,[x,y,-64]);
            // Driven side: same stock horn pocket as pan, turned about Y.
            translate([-21.8,0,-59])rotate([0,-90,0]) {
                pm_box([23,26,4],[2,0],-4);
            }
            pm_box([7,10,2.5],[-16.5,0],-60);
            pm_box([7,7,7],[16,0],-62.5);
            pm_xcyl(7,3.3,[18,0,-59]);
            // Pivot stop tab on inner face of the 0.7 mm pivot gap.
            hull() for(z=[-59,-69])pm_xcyl(3,1.5,[20.3,0,z]);
        }
        for(x=[-10.5,10.5],y=[4.931,-7.569])pm_cyl(2.3,8,[x,y,-64.01]);
        translate([-21.8,0,-59])rotate([0,-90,0])pm_horn_pocket();
        for(y=[-10,10])pm_xcyl(2.3,6,[-23,y,-59]);
        pm_xcyl(3.3,12,[11,0,-59]);
        pm_xcyl(4.5,16,[-24,0,-59]); // stock horn screw / driver access
        // Recesses clear the actual represented nut/washer and rear CSI connector envelope.
        pm_box([2.72,5.8,7],[16.66,0],-59); // pivot nut drops in from above
        translate([15.3,0,-59])rotate([0,90,0])cylinder(d=5.8/cos(30),h=2.72,$fn=6);
        pm_xcyl(7.4,.6,[21.3,0,-59]);
        pm_box([20.4,5.8,3.16],[0,3.431],-64.01);
        for(x=[-10.5,10.5],y=[4.931,-7.569])pm_cyl(5.5,4,[x,y,-57.5]);
    }
}

// Print on the optical rim. Four tabs share the camera's M2 fasteners.
module payload_camera_hood() {
    difference() {
        union() {
            difference() {
                pm_box([29,28,10],[0,0],0);
                pm_box([26.6,25.6,11],[0,0],-.01);
            }
            for(x=[-10.5,10.5],y=[9.931,-2.569]) {
                pm_cyl(4.8,1.4,[x,y,10]);
                pm_link([x,y],[x<0?-13.9:13.9,y],4.8,1.4,10);
            }
        }
        for(x=[-10.5,10.5],y=[9.931,-2.569])pm_cyl(2.3,3,[x,y,9.5]);
    }
}

// Print roof face down. Four integral columns are flipped onto the deck.
module payload_electronics_cover() {
    difference() {
        union() {
            hull() for(x=[-75,68],y=[-35,35])pm_cyl(4,1.5,[x,y,0]);
            for(x=pm_cover_x,y=pm_cover_y)pm_cyl(6,25.5,[x,y,0]);
            // Two long drip edges, open front/back for ventilation and harnesses.
            for(y=[-36.4,36.4])pm_box([145,1.2,4],[-3.5,y],0);
        }
        for(x=pm_cover_x,y=pm_cover_y)pm_cyl(3.3,27,[x,y,-.01]);
    }
}

// Isolated fit coupon: same nominal body window and 24 mm ear spacing.
module payload_servo_fit_coupon() {
    difference() {
        pm_box([34,15,2.5]);
        pm_box([pm_servo_body[0]+pm_servo_fit,pm_servo_body[1]+pm_servo_fit,3],[0,0],-.01);
        for(x=[-pm_servo_lug_pitch/2,pm_servo_lug_pitch/2])pm_cyl(1.9,3,[x,0,-.01]);
    }
}

module payload_spider_spacer() {pm_zring(10,4.5,14);}

// Removable side support allows the cradle to slide onto the tilt spline.
module payload_tilt_pivot_support() {
    difference() {
        union() {
            pm_box([10,22,3],[23,0],-34.7);
            pm_box([3,8,25],[23.5,0],-59);
            pm_xcyl(8,3,[22,0,-59]);
            for(a=[-5-pm_tilt_stop_delta,75+pm_tilt_stop_delta]) {
                yy=10*sin(a);zz=-59-10*cos(a);
                hull() for(p=[[0,-59],[yy,zz]])pm_xcyl(3,3,[22,p[0],p[1]]);
                pm_xcyl(3,3.6,[21.4,yy,zz]);
            }
        }
        for(y=[-7,7])pm_cyl(2.3,4,[23,y,-34.71]);
        pm_xcyl(3.3,5,[21,0,-59]);
    }
}
