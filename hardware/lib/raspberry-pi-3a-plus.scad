// Raspberry Pi 3 Model A+ r0.2.0 drawing-derived purchased reference. Units: mm.
// Sources, traced plan coordinates and remaining nominal details:
// hardware/assemblies/camera-pod/raspberry-pi-3a-plus/README.md
// RP-008330 board plan; RPI-3A+_V1-0 mounting pitch; RPI-3A+ schematic rev 1.0.
// Not a manufacturing source or a supplier-certified 3D model.
// XY is centred on the PCB; Z=0 is its underside, populated face toward +Z.

module p3_box(xy,size,z,h) {
    translate([xy[0],xy[1],z]) cube([size[0],size[1],h]);
}

module p3_pcb(thickness,hole_diameter) {
    difference() {
        hull() for(x=[3,62],y=[3,53])
            translate([x,y,0]) cylinder(r=3,h=thickness,$fn=64);
        for(x=[3.5,61.5],y=[3.5,52.5])
            translate([x,y,-.02]) cylinder(d=hole_diameter,h=thickness+.04,$fn=64);
    }
}

module p3_gpio(z) {
    // Plan outline 50.8 x 5; centre [32.5,52.5]. 40 positions at 0.1 inch.
    color([.12,.12,.12]) p3_box([7.1,50],[50.8,5],z-.02,2.52);
    color([.73,.65,.36]) for(i=[0:19],y=[51.23,53.77])
        p3_box([8.37+2.54*i-.32,y-.32],[.64,.64],z+2.48,6.02);
}

module p3_ffc(points,slot_x,slot_y,z) {
    // Traced plan perimeter and published 5.5 mm height; mating detail nominal.
    color([.82,.82,.78]) difference() {
        translate([0,0,z-.02]) linear_extrude(5.52) polygon(points);
        p3_box([slot_x,slot_y],[.4,15],z+3.5,2.02);
    }
    color([.10,.10,.10]) p3_box([slot_x+.6,slot_y-.5],[.7,16],z+4.7,.8);
}

module p3_usb(z,height) {
    // RP-008330 footprint; 7.1 mm uses the larger 2018 height label.
    color([.70,.71,.70]) difference() {
        union() {
            p3_box([53.3,24.9],[14.2,13.2],z-.02,height+.02);
            p3_box([67,24.1],[.5,14.7],z-.02,height+.02);
        }
        p3_box([56,25.8],[12,11.4],z+.8,height-1.6);
    }
    color([.12,.12,.12]) p3_box([55.9,27],[10,9],z+2.6,1.5);
    color([.73,.65,.36]) for(y=[28.3,30.3,32.3,34.3])
        p3_box([61,y],[4.5,.8],z+4.09,.08);
}

module p3_hdmi(z) {
    color([.70,.71,.70]) difference() {
        p3_box([24.75,-1.5],[14.5,12.15],z-.02,6.52);
        // Trapezoidal socket mouth faces -Y. Contact detail is nominal.
        translate([32,-1.52,z+3.25]) rotate([-90,0,0])
            linear_extrude(10) polygon([[-6.6,-2.2],[6.6,-2.2],[5.3,2.2],[-5.3,2.2]]);
    }
    color([.12,.12,.12]) p3_box([26.5,-1.3],[11,9.85],z+3.1,.8);
}

module p3_power(z) {
    // J1 10103594-0001LF identified by the reduced schematic.
    // Plan is traced; 2.8 mm height and mating mouth remain nominal details.
    color([.70,.71,.70]) difference() {
        union() {
            p3_box([6.85,-.6],[7.5,5.3],z-.02,2.82);
            p3_box([6.6,-1.2],[8,.6],z-.02,2.82);
        }
        p3_box([7.35,-1.22],[6.5,5],z+.5,1.8);
    }
}

module p3_audio(z) {
    color([.12,.12,.12]) difference() {
        union() {
            p3_box([50,0],[7,12.5],z-.02,6.02);
            translate([53.5,0,z+3]) rotate([90,0,0]) cylinder(d=6,h=2.5,$fn=64);
        }
        translate([53.5,10,z+3]) rotate([90,0,0]) cylinder(d=3.5,h=12.52,$fn=48);
    }
}

module p3_sd() {
    // Underside socket detail is a nominal service reference, absent from plan.
    color([.70,.71,.70]) difference() {
        p3_box([.2,20],[13.5,15],-1.1,1.12);
        p3_box([-.02,21],[12.5,13],-.85,.7);
    }
}

module raspberry_pi_3a_plus(feature="all",pcb_thickness=1.6,hole_diameter=2.75,usb_height=7.1) {
    // Thickness/hole diameter are explicitly nominal until received-unit inspection.
    assert(pcb_thickness>0 && hole_diameter>0 && usb_height>1.6);
    translate([-32.5,-28,0]) {
        if(feature=="all" || feature=="pcb") color([.13,.32,.16]) p3_pcb(pcb_thickness,hole_diameter);
        if(feature=="all" || feature=="gpio") p3_gpio(pcb_thickness);
        if(feature=="all" || feature=="usb") p3_usb(pcb_thickness,usb_height);
        if(feature=="all" || feature=="hdmi") p3_hdmi(pcb_thickness);
        if(feature=="all" || feature=="power") p3_power(pcb_thickness);
        if(feature=="all" || feature=="audio") p3_audio(pcb_thickness);
        if(feature=="all" || feature=="dsi") p3_ffc([[1.5,21.3],[2.65,20.15],[2.65,16.8],[5.45,16.8],[5.45,39.2],[2.6,39.2],[2.6,35.8],[1.5,34.7]],4,20.5,pcb_thickness);
        if(feature=="all" || feature=="csi") p3_ffc([[43.55,.3],[46.4,.3],[46.4,3.7],[47.5,4.8],[47.5,18.2],[46.35,19.35],[46.35,22.7],[43.55,22.7]],44.7,4,pcb_thickness);
        if(feature=="all" || feature=="sd") p3_sd();
        if(feature=="all" || feature=="soc") color([.18,.18,.18]) p3_box([20,24.5],[14,14],pcb_thickness-.02,2.02);
        // Radio package, small passives and solder joints are intentionally not fit geometry.
    }
}
