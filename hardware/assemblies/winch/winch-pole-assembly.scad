// winch-pole-assembly 0.1.0 — concept-unvalidated. Units mm.
include <../../lib/winch-cover.scad>
powered=false;
pole_diameter=120;
show_post=true;
show_caps=true;
wc_assembly(powered,false,true,true,true);
wp_mount(powered,pole_diameter,show_post,show_caps);
color(ARBI_CORE) for(i=[0,1]) wc_loom_run(powered,i);
wp_fasteners(powered,pole_diameter);
