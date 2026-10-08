// ARBI one-piece moving payload head r0.1.2, millimetres.
// Concept-unvalidated: the outer enclosure pans with the separate inner carrier.
include <payload-enclosure.scad>
include <payload-integrated-gimbal.scad>

ph_mount_x = [-8,8];
ph_mount_y = [-30.5,30.5];

// A superelliptic front outline narrows continuously from the wide shoulder
// to the chin. The elliptical side outline preserves camera/rear-cowl room.
// No local belly or straight-to-steep kink is introduced by stacked sections.
ph_x_radius = 47;
ph_y_radius = 38;
ph_x_height = 75;
ph_y_height = 75;
ph_x_exponent = 3;
ph_y_exponent = 2.5;
ph_plan_exponent = 3;
ph_sides = 96;

function ph_radius(drop,radius,height,exponent) =
    radius*pow(1-pow(drop/height,exponent),1/exponent);
function ph_slope(drop,radius,height,exponent) =
    -(radius/height)*pow(drop/height,exponent-1)*
    pow(1-pow(drop/height,exponent),1/exponent-1);
function ph_inner_radius(drop,radius,height,exponent,inset) =
    // Compensate the radial inset for slope so the steep chin does not become
    // a paper-thin wall. This is a sampled offset, not a print-fit guarantee.
    ph_radius(drop,radius,height,exponent)-inset*
        sqrt(1+pow(ph_slope(drop,radius,height,exponent),2));

module ph_volume(inset=0) {
    // The final ring is inside the camera aperture and is cut away completely.
    rings = [for(drop=[0:2:74])
        [-4.1-drop,
         ph_inner_radius(drop,ph_x_radius,ph_x_height,ph_x_exponent,inset),
         ph_inner_radius(drop,ph_y_radius,ph_y_height,ph_y_exponent,inset)]];
    vertices = [for(p=rings,j=[0:ph_sides-1])
        let(a=j*360/ph_sides)
        [p[1]*sign(cos(a))*pow(abs(cos(a)),2/ph_plan_exponent),
         p[2]*sign(sin(a))*pow(abs(sin(a)),2/ph_plan_exponent),p[0]]];
    faces = concat(
        [[for(j=[ph_sides-1:-1:0])j]],
        [[for(j=[0:ph_sides-1])(len(rings)-1)*ph_sides+j]],
        [for(i=[0:len(rings)-2],j=[0:ph_sides-1])
            [i*ph_sides+j,i*ph_sides+(j+1)%ph_sides,
             (i+1)*ph_sides+(j+1)%ph_sides,(i+1)*ph_sides+j]]);
    polyhedron(points=vertices,faces=faces,convexity=10);
}

module ph_eye_opening() {
    // One connected front/underside opening follows the camera's tilt range.
    // Side walls conceal the servo, pivot and horn; the complete housing pans
    // with them, so no fixed side-looking windows are required.
    translate([0,pg_tilt_y,pg_tilt_z-11.5])rotate([-90,0,0])linear_extrude(90)
        offset(r=10)square([22,24],center=true);
    pe_round_xy([42,48],10,pg_tilt_z-51,46,[0,pg_tilt_y-7]);
}

module payload_integrated_gimbal_head() {
    difference() {
        union() {
            difference() {ph_volume();ph_volume(pe_wall);ph_eye_opening();}
            for(x=ph_mount_x,y=ph_mount_y) {
                // Captive plain nut and washer load from the inside before the
                // carrier enters; no hidden wrench is needed inside the head.
                pm_cyl(8.2,5.8,[x,y,-37.5]);
                intersection() {
                    pm_link([x,y],[x,y<0?-48:48],5,3,-34.7);
                    ph_volume();
                }
            }
        }
        for(x=ph_mount_x,y=ph_mount_y) {
            pm_cyl(2.3,6,[x,y,-37.6]);
            translate([x,y,-36.8])cylinder(d=4.4/cos(30),h=1.8,$fn=6);
            pm_cyl(5.4,.3,[x,y,-35]);
            pm_box([5.4,8,2.1],[x,y+(y<0?4:-4)],-36.8);
        }
    }
}
