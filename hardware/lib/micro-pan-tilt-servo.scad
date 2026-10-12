// Owner measurements / fit report: docs/evidence/micro-servo-2026-10-12.md.
// X follows case length; shaft/lead exit at +X. Historical lug/shaft datums retained.
ms_body = [20,9,20.5]; // length and case-only height remain nominal
ms_bottom = -2.5; // extend away from existing lug/shaft datums; standalone origin is bottom
ms_envelope = [31.8,9,24.5]; // rigid envelope including output shaft, excluding leads
ms_hole_pitch = 25;
ms_lug_z = 13.5; // nominal, not measured
ms_lug_thickness = 2;
ms_shaft_offset = 5; // nominal, not measured
ms_lead_length = 145;
ms_lead_diameter = 1; // illustrative insulation diameter
ms_blue = [.08,.32,.86];
ms_wire_colors = [[.94,.94,.91],[.72,.025,.035],[.025,.025,.03]];

module ms_box(d,z=0) {translate([-d[0]/2,-d[1]/2,z])cube(d);}
module ms_holes() {
    for(x=[-ms_hole_pitch/2,ms_hole_pitch/2])
        translate([x,0,ms_lug_z-.02])cylinder(d=1.7,h=ms_lug_thickness+.04,$fn=32);
}
module ms_case(solid=false) {
    difference() {
        union() {
            ms_box(ms_body,ms_bottom);
            ms_box([ms_envelope[0],ms_body[1],ms_lug_thickness],ms_lug_z);
            translate([ms_shaft_offset,0,17.98])cylinder(d=7,h=1.72,$fn=64);
        }
        ms_holes();
        if(!solid)ms_box([ms_body[0]-1.5,ms_body[1]-1.5,ms_body[2]-1.5],ms_bottom+.75);
    }
}
module ms_shaft() {
    translate([ms_shaft_offset,0,19.68])cylinder(d=3.6,h=2.32,$fn=48);
}
// Display-only internals suggest a translucent case; no motor/gear fit claims.
module ms_internals() {
    translate([-4,0,2])cylinder(d=6.2,h=11,$fn=48);
    ms_box([14,6,.8],1.1);
}
function ms_raw_lead(t) = let(r=18+10*t,a=270*t) [r*sin(a),r*(cos(a)-1),-3*t];
function ms_lead_sum(n,i=1) = i>n ? 0 : norm(ms_raw_lead(i/n)-ms_raw_lead((i-1)/n))+ms_lead_sum(n,i+1);
function ms_lead_point(t,lane,n=72) = [ms_body[0]/2,lane*1.15,6]+ms_raw_lead(t)*ms_lead_length/ms_lead_sum(n);
module ms_lead(lane) {
    // The sampled centreline is exactly 145 mm; pose is illustrative, no connector assumed.
    for(i=[0:71])hull()for(t=[i/72,(i+1)/72])
        translate(ms_lead_point(t,lane))sphere(d=ms_lead_diameter,$fn=12);
}
module micro_pan_tilt_servo(leads=true,solid=false) {
    color(concat(ms_blue,[.65]))ms_case(solid);
    color([.92,.92,.87])ms_shaft();
    if(!solid)color([.22,.23,.25])ms_internals();
    if(leads)for(i=[0:2])color(ms_wire_colors[i])ms_lead(i-1);
}
