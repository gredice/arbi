// Received fixed-5 V converter, 12 October 2026. Units: mm.
// Measured envelope and holes; component/PCB detail remains a photo-based reference.
// Evidence: docs/evidence/buck-converter-2026-10-12.md. Not a fabrication source.
bc_board = [50,30,1.6]; // thickness is nominal, not measured
bc_height = 17;
bc_hole_pitch = [45,24];
bc_hole_diameter = 3;
bc_pad_centres = [[-22,5],[-22,-5],[22,5],[22,-5]]; // IN+, IN-, OUT+, OUT-
bc_eps = 0.02;

function bc_holes() = [for(x=[-bc_hole_pitch[0]/2,bc_hole_pitch[0]/2],
                          y=[-bc_hole_pitch[1]/2,bc_hole_pitch[1]/2]) [x,y]];

module bc_box(size,p) {translate(p) cube(size,center=true);}
module bc_can(p,d,h) {
    translate([p[0],p[1],bc_board[2]-bc_eps]) cylinder(d=d,h=h+bc_eps,$fn=64);
}
module buck_converter_48v_5v() {
    // +X runs from input to output; +Z is the populated face. Bottom is Z=0.
    // The photographed flat metallic underside is shown as a thin facing only;
    // its material, thickness and electrical potential have not been established.
    difference() {
        union() {
            color([.18,.19,.18]) translate([-bc_board[0]/2,-bc_board[1]/2,0]) cube(bc_board);
            color([.70,.64,.40]) translate([-bc_board[0]/2,-bc_board[1]/2,0]) cube([bc_board[0],bc_board[1],.2]);
            for(p=bc_holes()) color([.80,.80,.74])
                translate([p[0],p[1],bc_board[2]-.06]) cylinder(d=5,h=.06,$fn=64);
            for(p=bc_pad_centres) color([.74,.65,.38])
                bc_box([3,3,.08],[p[0],p[1],bc_board[2]-.04]);
            // Three cylindrical capacitors and the input power device.
            color([.76,.77,.74]) for(y=[-9,9]) bc_can([-14,y],10,11);
            color([.76,.77,.74]) bc_can([15,-9],10,11);
            color([.12,.13,.13]) bc_box([8,7,3],[-17,0,bc_board[2]+1.48]);
            color([.10,.11,.11]) bc_box([4,6,1],[12,7,bc_board[2]+.48]);
            // Wound inductor: horizontal toroidal body and visible copper turns.
            color([.10,.11,.11]) translate([12,7,bc_board[2]-bc_eps])
                rotate([90,0,0]) translate([0,(bc_height-bc_board[2])/2+bc_eps,0])
                    rotate_extrude($fn=64) translate([5,0,0]) circle(r=2.7,$fn=24);
            color([.72,.38,.14]) for(x=[8,10,12,14,16])
                bc_box([.65,5,8],[x,7,bc_board[2]+7]);
            // Photo-derived power/logic envelopes, with no invented terminal blocks.
            color([.24,.25,.22]) for(x=[-2,6])
                bc_box([6,7,3],[x,-9,bc_board[2]+1.48]);
            color([.13,.14,.14]) bc_box([6,6,1.5],[-3,5,bc_board[2]+.73]);
            color([.55,.52,.42]) for(x=[-7,-3,1,5],y=[-2,1])
                bc_box([2.4,1.6,1],[x,y,bc_board[2]+.48]);
        }
        for(p=bc_holes()) translate([p[0],p[1],-bc_eps])
            cylinder(d=bc_hole_diameter,h=bc_height+2*bc_eps,$fn=64);
        // Crop simplified details to the measured overall envelope.
        translate([-40,-30,bc_height]) cube([80,60,30]);
    }
}
