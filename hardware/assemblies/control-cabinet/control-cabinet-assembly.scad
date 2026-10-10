// control-cabinet-assembly — r0.1.1, concept-unvalidated. Units: mm.
// Proposed packaging reference; not a cabinet fabrication or wiring drawing.
// ARBI_ASSEMBLY_SCENE metadata and individually selected solids share this source.
include <../../lib/catalog-visualizations.scad>
use <controller-buck-converter-48v-5v.scad>
use <din-rail-ground-distribution-block.scad>
use <emergency-stop-switch.scad>
use <pico-terminal-expansion-board.scad>
use <power-supply-48v-350w.scad>
use <raspberry-pi-pico-2-w.scad>

scene_part = -1;
emit_scene = false;
door_angle = 105;
explode = 0;
cabinet_width = 500;
cabinet_height = 600;
cabinet_depth = 250;
cc_wall = 3;
cc_backplate_y = cabinet_depth/2-20;
cc_green = [0.18,0.38,0.25];

// node, registered model (empty for context), BOM owner, group, color, explosion.
// Reserved/protection shapes have no selected SKU or implied electrical rating.
cc_parts = [
    ["proposed-cabinet-shell", "", "control-panel-enclosure", "fixed", ARBI_SHELL, [0,0,0]],
    ["mounting-plate", "", "cabinet-installation-kit", "fixed", ARBI_METAL, [0,-25,0]],
    ["left-wiring-duct", "", "cabinet-installation-kit", "fixed", ARBI_CORE, [-35,-50,0]],
    ["right-wiring-duct", "", "cabinet-installation-kit", "fixed", ARBI_CORE, [35,-50,0]],
    ["mains-din-rail", "", "cabinet-installation-kit", "fixed", ARBI_METAL, [0,-65,0]],
    ["dc-din-rail", "", "cabinet-installation-kit", "fixed", ARBI_METAL, [0,-65,0]],
    ["mains-isolator-envelope-unselected", "", "cabinet-protection-kit", "fixed", ARBI_SHELL, [-40,-100,15]],
    ["rcbo-envelope-unselected", "", "cabinet-protection-kit", "fixed", ARBI_SHELL, [0,-100,15]],
    ["surge-protection-envelope-unselected", "", "cabinet-protection-kit", "fixed", ARBI_SHELL, [40,-100,15]],
    ["protective-earth-bar-envelope-unselected", "", "cabinet-installation-kit", "fixed", ARBI_METAL, [0,-100,0]],
    ["power-supply-a", "power-supply-48v-350w", "power-supply-48v-350w", "fixed", ARBI_METAL, [-50,-135,0]],
    ["power-supply-b", "power-supply-48v-350w", "power-supply-48v-350w", "fixed", ARBI_METAL, [50,-135,0]],
    ["five-dc-branch-protection-envelopes-unselected", "", "cabinet-protection-kit", "fixed", ARBI_SHELL, [-35,-155,0]],
    ["hardwired-stop-interface-reserve", "", "cabinet-protection-kit", "fixed", ARBI_CORE, [35,-155,0]],
    ["pico-terminal-board", "pico-terminal-expansion-board", "pico-terminal-expansion-board", "fixed", cc_green, [-40,-190,0]],
    ["pico-motion-controller", "raspberry-pi-pico-2-w", "raspberry-pi-pico-2-w", "fixed", cc_green, [-40,-215,0]],
    ["controller-5v-converter", "controller-buck-converter-48v-5v", "controller-buck-converter-48v-5v", "fixed", cc_green, [-40,-190,-20]],
    ["signal-ground-terminals", "din-rail-ground-distribution-block", "din-rail-ground-distribution-block", "fixed", ARBI_CORE, [-40,-190,0]],
    ["edge-computer-reserved-space", "", "", "fixed", ARBI_METAL, [45,-190,0]],
    ["bottom-field-terminal-envelopes-unselected", "", "cabinet-installation-kit", "fixed", ARBI_CORE, [0,-230,-20]],
    ["bottom-cable-entry-envelopes-unselected", "", "cable-gland-assortment", "fixed", ARBI_CORE, [0,0,-65]],
    ["open-service-door", "", "control-panel-enclosure", "cover", ARBI_SHELL, [-130,-80,0]],
    ["emergency-stop", "emergency-stop-switch", "emergency-stop-switch", "cover", [0.72,0.10,0.08], [-130,-80,0]]
];

assert(cabinet_width >= 500 && cabinet_height >= 600 && cabinet_depth >= 250,
    "This placement needs the proposed 500 W x 600 H x 250 D envelope; redesign before shrinking.");
assert(door_angle >= 0 && door_angle <= 110, "Proposed door pose is 0..110 degrees.");
assert(scene_part >= -1 && scene_part < len(cc_parts), "Unknown cabinet component.");

module cc_box(size, center) {
    translate(center) cube(size, center=true);
}

module cc_shell() {
    difference() {
        translate([0,0,cabinet_height/2])
            arbi_rounded_box([cabinet_width,cabinet_depth,cabinet_height],8,center=true,facets=24);
        translate([0,-cc_wall,cabinet_height/2])
            arbi_rounded_box([cabinet_width-2*cc_wall,cabinet_depth,cabinet_height-2*cc_wall],5,center=true,facets=24);
        // Illustrative bottom entries; not a drilling schedule or gland selection.
        for(x=[-175,-105,-35,35,105,175])
            translate([x,-40,-.1]) cylinder(d=24,h=cc_wall+.2,$fn=24);
    }
}

module cc_door_frame() {
    translate([-cabinet_width/2,-cabinet_depth/2,0]) rotate([0,0,-door_angle])
        translate([cabinet_width/2,0,0]) children();
}

module cc_rail(z, width) {
    cc_box([width,1.5,35],[0,cc_backplate_y-4,z]);
    for(dz=[-17,17]) cc_box([width,6,1.5],[0,cc_backplate_y-6,z+dz]);
}

module cc_din_device(x,z,width) {
    difference() {
        cc_box([width,60,85],[x,cc_backplate_y-37,z]);
        for(dz=[-28,28]) for(dx=[-width/4,width/4])
            translate([x+dx,cc_backplate_y-68,z+dz]) rotate([-90,0,0]) cylinder(d=4,h=5,$fn=16);
    }
    cc_box([width*.55,4,22],[x,cc_backplate_y-69,z]);
}

module cc_board_at(x,z,depth=0) {
    translate([x,cc_backplate_y-8-depth,z]) rotate([90,0,0]) children();
}

module cc_reserve(size,center) {
    // Open edges show reserved occupied space, not a selected computer casing.
    for(a=[-1,1],b=[-1,1]) {
        cc_box([size[0],2,2],center+[0,a*size[1]/2,b*size[2]/2]);
        cc_box([2,size[1],2],center+[a*size[0]/2,0,b*size[2]/2]);
        cc_box([2,2,size[2]],center+[a*size[0]/2,b*size[1]/2,0]);
    }
}

module cc_geometry(index) {
    if(index==0) cc_shell();
    else if(index==1) cc_box([cabinet_width-40,2,cabinet_height-40],[0,cc_backplate_y,cabinet_height/2]);
    else if(index==2 || index==3) {
        x = (index==2?-1:1)*(cabinet_width/2-36);
        difference() {
            cc_box([28,35,cabinet_height-70],[x,cc_backplate_y-21,cabinet_height/2]);
            for(z=[50:20:cabinet_height-40]) cc_box([30,20,8],[x,cc_backplate_y-35,z]);
        }
    }
    else if(index==4) cc_rail(535,340);
    else if(index==5) cc_rail(225,340);
    else if(index==6) cc_din_device(-130,535,54);
    else if(index==7) cc_din_device(-58,535,36);
    else if(index==8) cc_din_device(10,535,54);
    else if(index==9) {
        cc_box([95,8,12],[118,cc_backplate_y-20,535]);
        for(x=[80:15:155]) translate([x,cc_backplate_y-27,535])rotate([-90,0,0])cylinder(d=5,h=3,$fn=16);
    }
    else if(index==10 || index==11)
        cc_board_at(index==10?-92:92,380) rotate([0,0,90]) cabinet_power_supply();
    else if(index==12) for(x=[-140:25:-40]) cc_din_device(x,225,18);
    else if(index==13) cc_reserve([85,65,85],[90,cc_backplate_y-40,225]);
    else if(index==14) cc_board_at(-95,115) cabinet_pico_terminal_board();
    else if(index==15) cc_board_at(-95,115,18) cabinet_pico();
    else if(index==16) cc_board_at(-150,55) cabinet_controller_converter();
    else if(index==17) cc_board_at(-55,55) cabinet_signal_ground();
    else if(index==18) cc_reserve([140,55,110],[100,cc_backplate_y-38,115]);
    else if(index==19) for(x=[-160:20:160]) cc_box([16,30,28],[x,-65,35]);
    else if(index==20) for(x=[-175,-105,-35,35,105,175])
        translate([x,-40,-18]) arbi_tube(30,20,18,facets=24);
    else if(index==21) cc_door_frame() {
        translate([0,0,cabinet_height/2]) rotate([90,0,0])
            arbi_rounded_box([cabinet_width-6,cabinet_height-6,4],6,center=true,facets=24);
        cc_box([15,12,65],[cabinet_width/2-30,-6,300]);
    }
    else if(index==22) cc_door_frame()
        translate([cabinet_width/2-75,23,435])rotate([90,0,0])cabinet_emergency_stop();
}

module control_cabinet_assembly() {
    for(i=[0:len(cc_parts)-1])
        color(cc_parts[i][4]) translate(cc_parts[i][5]*explode) cc_geometry(i);
}

if(emit_scene)
    echo(["ARBI_ASSEMBLY_SCENE",1,"control-cabinet","Proposed 500 W x 600 H x 250 D mm cabinet; approximate components", "service-exploded",cc_parts]);
if(scene_part >= 0) color(cc_parts[scene_part][4]) cc_geometry(scene_part);
else control_cabinet_assembly();
