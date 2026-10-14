// Camera Module 3 Wide/Standard — supplier-derived reference, mm.
// RP-008155-DS-1 Wide / RP-008153-DS-1 Standard drawings and RP-008154-DS-1
// STEP archive, inspected 2026-10-12. The received/baseline camera is Wide.
// Origin: carrier PCB underside centre; lens faces +Z. X is the 25 mm side.
// Y=−11.931 is the edge beside the lower hole row; rear CSI socket is at +Y.
// Primitive envelopes preserve occupied space, not production component detail.
// PCB thickness follows the PDF (1.12), not the STEP's 0.75692 mm laminate.
// Rear socket uses the larger STEP footprint; Z reserves the 12.4 mm Wide product
// envelope and autofocus extremes. Physical fit and flexible routing unverified.
CM3_PCB = [25,23.862,1.12];
CM3_LENS_Y = 2.469;
CM3_REAR_LIMIT = -2.75;

module cm3_box(size,xy,z) {
    translate([xy[0]-size[0]/2,xy[1]-size[1]/2,z]) cube(size);
}
module cm3_round_plate(size,r) {
    hull() for(x=[-size[0]/2+r,size[0]/2-r],y=[-size[1]/2+r,size[1]/2-r])
        translate([x,y,0]) cylinder(r=r,h=size[2],$fn=64);
}

module raspberry_pi_camera_module_3(wide=true) {
    difference() {
        union() {
            color([.13,.32,.16]) cm3_round_plate(CM3_PCB,2);
            // Sensor flex and carrier: bounding primitives from STEP solids.
            // Connect to the carrier for a single inspectable reference solid.
            color([.12,.14,.15]) cm3_box([11.15,18.1,2.02],[.175,-1.181],1.10);
            color([.12,.14,.15]) cm3_box([10.8,10.8,wide?4.07:3.26],[0,CM3_LENS_Y],2.67);
            // The tall autofocus assembly is square, not just a small cylinder.
            color([.12,.14,.15]) cm3_box([8.5,8.5,wide?2.60:2.35],[0,CM3_LENS_Y],wide?6.70:5.90);
            color([.025,.025,.03]) translate([0,CM3_LENS_Y,wide?9.28:8.23])
                cylinder(d=wide?6.95:5.75,h=wide?.37:.52,$fn=96);
            // Standard STEP rear CSI connector: 22.92 × 6.54 at the +Y edge.
            color([.94,.94,.92]) cm3_box([22.92,6.54,2.77],[0,8.291],CM3_REAR_LIMIT);
            // Smaller populated rear-side regions, bounded from the STEP.
            color([.12,.14,.15]) {
                cm3_box([4.9,6,1.77],[1.4,-3.931],-1.75);
                cm3_box([2.5,3.2,.95],[-6.6,-7.681],-.93);
                for(x=[-8,-3.3])cm3_box([2.9,2.8,1.47],[x,-3.531],-1.45);
                cm3_box([2.9,2.8,1.47],[8,-2.131],-1.45);
            }
        }
        for(x=[-10.5,10.5],y=[-9.931,2.569])
            translate([x,y,-3])cylinder(d=2.2,h=13,$fn=64);
    }
}
