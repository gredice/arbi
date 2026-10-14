// micro-pan-tilt-servo r0.2.0, concept-unvalidated. Units: mm.
// Owner-measured rigid envelope / pitch; internal detail and lead pose illustrative.
include <../../lib/micro-pan-tilt-servo.scad>
emit_appearance = false;
appearance_part = -1;
// ARBI_MODEL_APPEARANCE: node, sRGB, roughness, metalness, transmission, thickness, IOR.
surfaces = [
    ["blue-case",ms_blue,.22,0,.65,.75,1.46],
    ["white-shaft",[.92,.92,.87],.38,0,0,0,1.5],
    ["internal-reference",[.22,.23,.25],.42,.2,0,0,1.5],
    ["white-lead",ms_wire_colors[0],.6,0,0,0,1.5],
    ["red-lead",ms_wire_colors[1],.6,0,0,0,1.5],
    ["black-lead",ms_wire_colors[2],.6,0,0,0,1.5]
];
if(emit_appearance)echo(["ARBI_MODEL_APPEARANCE",1,ms_envelope,surfaces]);
translate([0,0,-ms_bottom]) {
    if(appearance_part==0)ms_case();
    else if(appearance_part==1)ms_shaft();
    else if(appearance_part==2)ms_internals();
    else if(appearance_part>=3)ms_lead(appearance_part-4);
    else micro_pan_tilt_servo();
}
