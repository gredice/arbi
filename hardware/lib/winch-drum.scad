// ARBI segmented winch-drum family 2.1.0 — concept-unvalidated.
// All dimensions mm. PLA bench prototype; ASA requires separate process qualification.
include <arbi.scad>

core_diameter = 100;
shaft_nominal_diameter = 8;
shaft_diametral_clearance = 0.2;
required_line_length = 32000;
passive_line_diameter = 1.5;
wire_outer_diameter = 1.5;
reserve_turns = 3;
edge_margin = 7;
shell_thickness = 5;
web_thickness = 6;
flange_diameter = 128;
flange_thickness = 6;
body_hub_diameter = 24;
clamp_gap = 0.8;
clamp_height = 20;
clamp_foot_thickness = 6;
m4_clearance = 4.4;
m5_clearance = 5.4;
alignment_pin_diameter = 5;
alignment_clearance = 0.2;
alignment_pin_length = 8;
facets = 96;
helix_segments_per_turn = 64;
groove_profile_facets = 12;
// Asymmetric bolt pattern prevents 120-degree misassembly.
tie_angles = [0, 115, 240];
tie_radius = 39;

function wd_line(powered) = powered ? passive_line_diameter + 2 * wire_outer_diameter : passive_line_diameter;
function wd_pitch(powered) = wd_line(powered) + (powered ? 0.8 : 0.7);
function wd_radius(powered) = wd_line(powered) / 2 + (powered ? 0.3 : 0.2);
function wd_depth(powered) = wd_line(powered) * 0.3;
function wd_effective_diameter(powered) = core_diameter - 2 * wd_depth(powered) + wd_line(powered);
function wd_length_per_turn(powered) = sqrt(pow(PI * wd_effective_diameter(powered), 2) + pow(wd_pitch(powered), 2));
function wd_working_turns(powered) = ceil(required_line_length / wd_length_per_turn(powered));
function wd_turns(powered) = wd_working_turns(powered) + reserve_turns;
function wd_width(powered) = wd_turns(powered) * wd_pitch(powered) + 2 * wd_radius(powered) + 2 * edge_margin;
function wd_sections(powered) = powered ? 3 : 2;
function wd_section_height(powered) = wd_width(powered) / wd_sections(powered);
function wd_shaft_length(powered) = ceil((wd_width(powered) + 88) / 10) * 10;
function wd_tie_length(powered) = ceil((wd_width(powered) + 2 * flange_thickness + 18) / 10) * 10;

module wd_checks(powered = false) {
    assert(core_diameter >= 90 && core_diameter <= 110, "Nominal 100 mm core expected.");
    assert(required_line_length > 0 && passive_line_diameter > 0 && wire_outer_diameter > 0);
    assert(shaft_nominal_diameter > 0 && shaft_diametral_clearance >= 0 && shaft_diametral_clearance <= 0.5);
    assert(clamp_gap > 0 && clamp_gap < 2);
    assert(wd_pitch(powered) > 2 * wd_radius(powered), "Groove sweeps overlap.");
    assert(wd_depth(powered) < shell_thickness - 2, "Insufficient remaining groove wall.");
    assert(reserve_turns >= 1 && reserve_turns == floor(reserve_turns));
    assert(wd_section_height(powered) < 240, "Section exceeds X1C height allowance.");
    assert(flange_diameter <= 230 && flange_diameter >= core_diameter + 20);
    assert(web_thickness > alignment_pin_diameter + alignment_clearance);
    assert(alignment_pin_length / 2 + 0.3 < flange_thickness);
    assert(m4_clearance >= 4 && m4_clearance < 5 && m5_clearance >= 5 && m5_clearance < 6);
    assert(helix_segments_per_turn >= 48 && groove_profile_facets >= 8);
    children();
}

module wd_hole(d, h) {
    translate([0, 0, -ARBI_EPSILON]) cylinder(d = d, h = h + 2 * ARBI_EPSILON, $fn = 32);
}
module wd_tie_holes(h) {
    for (a = tie_angles) rotate([0, 0, a]) translate([tie_radius, 0, 0]) wd_hole(m5_clearance, h);
}
module wd_mount_holes(h) {
    for (x = [-26, 26], y = [-9, 9]) translate([x, y, 0]) wd_hole(m4_clearance, h);
}
module wd_alignment_socket() {
    // One offset pin keys the seam; through-rods provide joint compression.
    translate([26, 0, 0]) wd_hole(alignment_pin_diameter + alignment_clearance, alignment_pin_length / 2 + 0.3);
}

// Local part of a globally phased helix. Caps remain beyond each section's faces,
// except the intentionally rounded profile at the two ends of the whole drum.
module wd_groove(powered, start_z, end_z) {
    pitch = wd_pitch(powered);
    pr = wd_radius(powered);
    base_z = edge_margin + pr;
    first_turn = max(0, floor((start_z - base_z - pr) / pitch) - 1);
    last_turn = min(wd_turns(powered), ceil((end_z - base_z + pr) / pitch) + 1);
    turns = last_turn - first_turn;
    n = ceil(turns * helix_segments_per_turn);
    r = core_diameter / 2 + pr - wd_depth(powered);
    points = [for (i = [0:n], j = [0:groove_profile_facets-1])
        let(a = 360 * (first_turn + turns * i/n), b = 360*j/groove_profile_facets,
            rr = r + pr*cos(b))
        [rr*cos(a), rr*sin(a), base_z + pitch*(first_turn + turns*i/n) + pr*sin(b)]];
    faces = concat(
        [for(i=[0:n-1], j=[0:groove_profile_facets-1])
            let(a=i*groove_profile_facets+j, b=i*groove_profile_facets+(j+1)%groove_profile_facets,
                c=(i+1)*groove_profile_facets+(j+1)%groove_profile_facets, d=(i+1)*groove_profile_facets+j)
            each [[a,b,c],[a,c,d]]],
        [[for(j=[groove_profile_facets-1:-1:0]) j]],
        [[for(j=[0:groove_profile_facets-1]) n*groove_profile_facets+j]]);
    polyhedron(points=points, faces=faces, convexity=10);
}

module wd_body_section(powered = false, section = 0) {
    wd_checks(powered) {
        count = wd_sections(powered);
        h = wd_section_height(powered);
        z0 = section*h;
        assert(section >= 0 && section < count && section == floor(section));
        difference() {
            union() {
                arbi_tube(core_diameter, core_diameter-2*shell_thickness, h, facets=facets);
                cylinder(d=body_hub_diameter,h=h,$fn=64);
                for(a=tie_angles) rotate([0,0,a]) {
                    translate([body_hub_diameter/2-2,-web_thickness/2,0])
                        cube([core_diameter/2-body_hub_diameter/2+1,web_thickness,h]);
                    translate([tie_radius,0,0]) cylinder(d=14,h=h,$fn=32);
                }
            }
            wd_hole(shaft_nominal_diameter+shaft_diametral_clearance,h);
            wd_tie_holes(h);
            wd_alignment_socket();
            translate([0,0,h]) mirror([0,0,1]) wd_alignment_socket();
            translate([0,0,-z0]) wd_groove(powered,z0,z0+h);
            // One/two/three recessed dots identify section order without fonts.
            for(mark=[0:section]) translate([-3+3*mark,8,h-0.5]) cylinder(d=1.5,h=0.6,$fn=16);
        }
    }
}

// Left flange prints flat at Z=0 with the locating socket facing upward.
// The right flange is a separate handed print because the bolt pattern is asymmetric.
module wd_flange() {
    wd_checks() difference() {
        union() {
            cylinder(d=flange_diameter-2,h=flange_thickness,$fn=facets);
            translate([0,0,1]) cylinder(d=flange_diameter,h=flange_thickness-2,$fn=facets);
            cylinder(d1=flange_diameter-2,d2=flange_diameter,h=1,$fn=facets);
            translate([0,0,flange_thickness-1]) cylinder(d1=flange_diameter,d2=flange_diameter-2,h=1,$fn=facets);
        }
        wd_hole(shaft_nominal_diameter+0.5,flange_thickness);
        wd_tie_holes(flange_thickness);
        wd_mount_holes(flange_thickness);
        translate([0,0,flange_thickness]) mirror([0,0,1]) wd_alignment_socket();
        for(x=[-9,9]) translate([x,55,0]) wd_hole(m4_clearance,flange_thickness);
        // Open feed notch: chamfered flange edge must also be smoothed after printing.
        translate([0,63,0]) wd_hole(5,flange_thickness);
        translate([-2.5,63,-ARBI_EPSILON]) cube([5,4,flange_thickness+2*ARBI_EPSILON]);
        // Two generous open lead-throughs outside the body, for powered conductors.
        for(x=[-20,20]) translate([x,54,0]) wd_hole(5,flange_thickness);
    }
}

module wd_flange_right() { mirror([0,1,0]) wd_flange(); }

// Two identical halves; the second is rotated 180 deg about Z. Flat foot at Z=0.
// Accessible metal M4 nuts on cross-bolts; no plastic screw threads.
module wd_clamp_half() {
    wd_checks() difference() {
        union() {
            translate([-32,clamp_gap/2,0]) cube([64,16-clamp_gap/2,clamp_foot_thickness]);
            translate([-20,clamp_gap/2,0]) cube([40,16-clamp_gap/2,clamp_height]);
        }
        wd_hole(shaft_nominal_diameter+shaft_diametral_clearance,clamp_height);
        for(x=[-12,12]) translate([x,-1,13]) rotate([-90,0,0]) cylinder(d=m4_clearance,h=19,$fn=32);
        for(x=[-26,26]) translate([x,9,0]) wd_hole(m4_clearance,clamp_foot_thickness);
    }
}

module wd_tail_clamp() {
    difference() {
        arbi_rounded_box([28,12,6],2,center=false,facets=32);
        for(x=[5,23]) translate([x,6,0]) wd_hole(m4_clearance,6);
        // Two shallow channels for the bare Dyneema tail; the insulated wires
        // bypass this clamp through the separate flange holes.
        for(y=[3,9]) translate([-1,y,0]) rotate([0,90,0]) cylinder(d=1.8,h=30,$fn=32);
    }
}
module wd_alignment_pin() { cylinder(d=alignment_pin_diameter,h=alignment_pin_length,$fn=32); }

module wd_assembly(powered=false) {
    wd_checks(powered) {
        w=wd_width(powered);
        echo(variant=powered?"powered":"passive",working_turns=wd_working_turns(powered),reserve_turns=reserve_turns,
             capacity_mm=wd_working_turns(powered)*wd_length_per_turn(powered),body_width_mm=w,
             section_height_mm=wd_section_height(powered),shaft_cut_allowance_mm=wd_shaft_length(powered),
             tie_rod_cut_allowance_mm=wd_tie_length(powered));
        color("orange") wd_flange();
        for(i=[0:wd_sections(powered)-1]) color(i%2==0?"gold":"orange")
            translate([0,0,flange_thickness+i*wd_section_height(powered)]) wd_body_section(powered,i);
        color("orange") translate([0,0,w+2*flange_thickness]) rotate([180,0,0]) wd_flange_right();
        for(a=[0,180]) color("slategray") translate([0,0,w+2*flange_thickness]) rotate([0,0,a]) wd_clamp_half();
        color("slategray") translate([-14,49,w+2*flange_thickness]) wd_tail_clamp();
        // Hardware is context only, not exported in fabrication entrypoints.
        color("silver",0.5) translate([0,0,-22]) cylinder(d=shaft_nominal_diameter,h=w+88,$fn=32);
        for(z=[-9,w+34]) color("dimgray") translate([0,0,z]) arbi_tube(22,8,7,facets=48);
        for(z=[-11,w+41]) color("silver") translate([0,0,z]) arbi_tube(11,8.2,2,facets=48);
        for(z=[-21,w+43]) color("silver") translate([0,0,z]) arbi_tube(20,8,10,facets=48);
        color("silver",0.5) translate([0,0,w+56]) arbi_tube(20,8,25,facets=48);
        for(i=[0:wd_sections(powered)]) color("slategray")
            translate([26,0,flange_thickness+i*wd_section_height(powered)-alignment_pin_length/2]) wd_alignment_pin();
        for(a=tie_angles) color("silver") rotate([0,0,a]) translate([tie_radius,0,-9])
            cylinder(d=5,h=wd_tie_length(powered),$fn=16);
    }
}
