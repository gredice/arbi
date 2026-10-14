// raspberry-pi-camera-module-3 — r0.2.0, concept-unvalidated.
// Official Wide references and product-photo detail; physical fit unverified.
include <../../lib/raspberry-pi-camera-module-3.scad>
emit_appearance = false;
appearance_part = -1;
// ARBI_MODEL_APPEARANCE: node, sRGB, roughness, metalness, transmission, thickness, IOR.
surfaces = [
    ["green-pcb",cm3_green,.45,0,0,0,1.5],
    ["gold-pads",cm3_gold,.28,.75,0,0,1.5],
    ["amber-flex",cm3_amber,.42,0,0,0,1.5],
    ["black-components",cm3_black,.31,0,0,0,1.5],
    ["autofocus-shield",cm3_silver,.25,.85,0,0,1.5],
    ["connector-latch",[.20,.21,.22],.48,0,0,0,1.5],
    ["lens-glass",[.055,.09,.12],.08,.05,.25,.16,1.52],
    ["white-silkscreen",[.91,.93,.87],.7,0,0,0,1.5]
];
if(emit_appearance)echo(["ARBI_MODEL_APPEARANCE",1,[25,23.862,12.4],surfaces]);
if(appearance_part>=0)cm3_component(appearance_part,wide=true);
else raspberry_pi_camera_module_3(wide=true);
