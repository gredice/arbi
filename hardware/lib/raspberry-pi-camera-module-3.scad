// Camera Module 3 Wide/Standard, mm. Origin: PCB underside; lens faces +Z.
// RP-008155-DS-1, RP-008154-DS-1 and TNBA2004; see the camera README.
// Nominal re-authored reference. Small details/materials approximate official
// IR-cut product photos. PDF PCB thickness; 12.4 mm Wide focus allowance.
CM3_PCB = [25,23.862,1.12];
CM3_LENS_Y = 2.469;
CM3_REAR_LIMIT = -2.75;
cm3_green = [.025,.43,.20];
cm3_gold = [.82,.62,.16];
cm3_black = [.035,.04,.045];
cm3_silver = [.68,.70,.71];
cm3_amber = [.61,.29,.065];

module cm3_box(size,xy,z) {
    translate([xy[0]-size[0]/2,xy[1]-size[1]/2,z]) cube(size);
}
module cm3_round_plate(size,r) {
    linear_extrude(size[2]) offset(r=r,$fn=64)
        square([size[0]-2*r,size[1]-2*r],center=true);
}
module cm3_bores() {
    for(x=[-10.5,10.5],y=[-9.931,2.569])
        translate([x,y,-3])cylinder(d=2.2,h=13,$fn=64);
}
module cm3_pcb() {
    difference() {
        cm3_round_plate(CM3_PCB,2);
        cm3_bores();
        // Flush copper lands preserve both PCB seating planes in the assembly.
        for(x=[-10.5,10.5],y=[-9.931,2.569]) {
            translate([x,y,-.01])cylinder(d=4.75,h=.035,$fn=64);
            translate([x,y,1.095])cylinder(d=4.75,h=.035,$fn=64);
        }
    }
}
module cm3_pads() {
    intersection() {
        cm3_round_plate(CM3_PCB,2);
        difference() {
            union() for(x=[-10.5,10.5],y=[-9.931,2.569]) {
                translate([x,y,0])cylinder(d=4.75,h=.035,$fn=64);
                translate([x,y,1.085])cylinder(d=4.75,h=.035,$fn=64);
                translate([x,y,0])cylinder(d=2.32,h=1.12,$fn=64);
            }
            cm3_bores();
        }
    }
    // 15 rear CSI contact positions, 1 mm pitch.
    for(x=[-7:7])cm3_box([.45,2.4,.12],[x,6.65],-.10);
    translate([-10,-5.9,1.10])cylinder(d=1.2,h=.055,$fn=32);
}
module cm3_flex() {
    // TNBA2004: 8.9-wide tail, 7-wide neck, 10.8-square sensor base.
    // The previous 11.15 x 18.1 box filled the air above this folded flex.
    cm3_box([8.9,4,.42],[.2,-8.231],1.10);
    cm3_box([7,3.5,.18],[0,-4.481],1.10);
    hull() {
        cm3_box([7,.18,.18],[0,-3.2],1.12);
        cm3_box([7,.18,.18],[0,-2.85],2.67);
    }
    cm3_box([10.8,10.8,.42],[0,CM3_LENS_Y],2.67);
}
module cm3_octagon(size,clip) {
    polygon([[-size/2+clip,-size/2],[size/2-clip,-size/2],
        [size/2,-size/2+clip],[size/2,size/2-clip],
        [size/2-clip,size/2],[-size/2+clip,size/2],
        [-size/2,size/2-clip],[-size/2,-size/2+clip]]);
}
module cm3_shield() {
    // Folded stainless autofocus can, corner folds and open top.
    translate([0,CM3_LENS_Y,3.04])difference() {
        linear_extrude(3.70)cm3_octagon(10.8,.45);
        translate([0,0,.20])linear_extrude(3.6)cm3_octagon(10.32,.4);
    }
    translate([0,CM3_LENS_Y,6.46])difference() {
        linear_extrude(.28)cm3_octagon(10.8,.45);
        translate([0,0,-.01])linear_extrude(.30)cm3_octagon(9.35,1.65);
    }
}
module cm3_black_parts(wide=true) {
    cm3_box([8.9,4,.52],[.2,-8.231],1.49);
    cm3_box([10.3,10.3,1.65],[0,CM3_LENS_Y],1.45);
    translate([0,CM3_LENS_Y,3.04])difference() {
        linear_extrude(3.44)cm3_octagon(10.34,.35);
        translate([0,0,1.1])cylinder(d=8.7,h=3,$fn=96);
    }
    // Stepped moving barrel with recessed front glass.
    top=wide?9.65:8.75;
    translate([0,CM3_LENS_Y,4.10])difference() {
        union() {
            cylinder(d=8.5,h=2.6,$fn=96);
            translate([0,0,2.58])cylinder(d1=8.5,d2=wide?6.95:5.75,h=top-6.68,$fn=96);
        }
        translate([0,0,top-4.10-.55])cylinder(d1=3.3,d2=wide?5.55:4.4,h=.7,$fn=96);
    }
    // Rear socket entry and movable locking bar are separate features.
    difference() {
        cm3_box([22.92,6.54,2.77],[0,8.291],CM3_REAR_LIMIT);
        cm3_box([16.2,3.5,.70],[0,10],-1.92);
        cm3_box([19.4,1.1,.40],[0,8.9],-2.76);
    }
    for(p=[[1.4,-3.931,4.9,6,1.77],[-6.6,-7.681,2.5,3.2,.95],
           [-8,-3.531,2.9,2.8,1.47],[-3.3,-3.531,2.9,2.8,1.47],
           [8,-2.131,2.9,2.8,1.47]])
        cm3_box([p[2],p[3],p[4]],[p[0],p[1]],.02-p[4]);
}
module cm3_latch() {
    cm3_box([19.2,.85,.42],[0,8.9],-2.74);
    for(x=[-10.6,10.6])cm3_box([.9,1.7,.32],[x,10.6],-2.74);
}
module cm3_glass(wide=true) {
    translate([0,CM3_LENS_Y,(wide?9.65:8.75)-.56])
        cylinder(d=3.28,h=.17,$fn=96);
}
module cm3_silkscreen() {
    // Identity only: no fabricated serial numbers or QR codes.
    translate([-7.5,-2,1.115])rotate([0,0,90])linear_extrude(.025)
        text("Raspberry Pi",size=1.05,halign="center",font="DejaVu Sans");
    translate([8,-1,1.115])rotate([0,0,90])linear_extrude(.025)
        text("Camera 3 Wide",size=1.05,halign="center",font="DejaVu Sans");
    translate([.2,-8.2,2.005])rotate([0,0,180])linear_extrude(.025)
        text("TNBA2004",size=.8,halign="center",valign="center",font="DejaVu Sans");
}
module cm3_component(index,wide=true) {
    if(index==0)cm3_pcb();
    else if(index==1)cm3_pads();
    else if(index==2)cm3_flex();
    else if(index==3)cm3_black_parts(wide);
    else if(index==4)cm3_shield();
    else if(index==5)cm3_latch();
    else if(index==6)cm3_glass(wide);
    else if(index==7)cm3_silkscreen();
}
module raspberry_pi_camera_module_3(wide=true) {
    colors=[cm3_green,cm3_gold,cm3_amber,cm3_black,cm3_silver,
            [.20,.21,.22],[.055,.09,.12],[.91,.93,.87]];
    for(i=[0:7])color(colors[i])cm3_component(i,wide);
}
