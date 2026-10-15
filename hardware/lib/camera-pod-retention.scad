// ARBI compact-pod removable retainers, millimetres; concept-unvalidated.
// Hard stops define liner spaces; screw torque must not crush wires or FPCs.
// The selected liners/can and pull-out performance require received-part checks.
PR_FN=24;
function pr_ribbon()=[16.8,1.1,13]; // throat width, stopped gap, screw half-pitch
function pr_loom()=[4.8,2.8,7.5];
module pr_box(s,c=[0,0],z=0){translate([c[0]-s[0]/2,c[1]-s[1]/2,z])cube(s);}
module pr_cyl(d,h,p=[0,0,0]){translate(p)cylinder(d=d,h=h,$fn=PR_FN);}
module pr_link(a,b,d,h,z){hull()for(p=[a,b])pr_cyl(d,h,[p[0],p[1],z]);}
module pr_xcyl(d,h,p=[0,0,0],n=PR_FN){translate(p)rotate([0,90,0])cylinder(d=d,h=h,$fn=n);}

// Base top is Z0. With the separate host inverted, load plain M3 nuts
// through the underside hex seats and hold them until screws engage.
// These eight nuts bear on printed ceilings; no lower washer is fitted.
module pr_flat_base(shape){
 g=shape[1];pitch=shape[2];nut=g-8.5;
 difference(){
  union(){
   pr_link([-pitch,0],[pitch,0],9.6,3,-3);
   for(x=[-pitch,pitch])pr_cyl(10,.2-nut,[x,0,nut-.2]);
  }
  pr_flat_bores(shape);
 }
}
module pr_flat_bores(shape,entry=0){
 g=shape[1];pitch=shape[2];nut=g-8.5;
 for(x=[-pitch,pitch]){
  pr_cyl(3.3,18,[x,0,-10]);
  translate([x,0,nut-.3-entry])cylinder(d=5.8/cos(30),h=2.7+entry,$fn=6);
 }
}
// One removable bridge; 0.5 mm liners above/below the nominal FPC/loom.
module pr_flat_cap(shape){
 w=shape[0];g=shape[1];pitch=shape[2];
 difference(){
  union(){
   pr_link([-pitch,0],[pitch,0],9.6,3,g);
   for(x=[-pitch,pitch])pr_cyl(9.6,g+.01,[x,0,0]);
  }
  for(x=[-pitch,pitch]){
   pr_cyl(3.3,g+4,[x,0,-.01]);
   pr_cyl(7.4,1.1,[x,0,g+2]);
  }
  // Liners extend past the bridge faces; inspect and smooth printed edges.
  pr_box([w,12,g+.01],[0,0],-.01);
 }
}
module camera_pod_ribbon_clamp(){pr_flat_cap(pr_ribbon());}
module camera_pod_loom_clamp(){pr_flat_cap(pr_loom());}

// Incoming power: split vertical bore at the unchanged [10,40] entry.
// A soft 6 ID / 7 OD / 10 long sleeve is captive between stopped jaws.
module pr_power_base(){
 difference(){
  union(){
   intersection(){pr_cyl(13,10);pr_box([9,30,10],[-4.5,0]);}
   pr_box([9,25.6,1],[-4.5,0]);
   for(y=[-8,8])pr_xcyl(9.6,9,[-9,y,5]);
  }
  pr_cyl(6.8,10.2,[0,0,-.1]);
  for(y=[-8,8]){
   pr_xcyl(3.3,17,[-10,y,5]);
   pr_xcyl(5.8/cos(30),2.6,[-7,y,5],6);
   pr_xcyl(7.4,.5,[-4.6,y,5]);
   pr_box([3.1,7.4,6],[-5.55,y],5);
  }
 }
}
module camera_pod_power_clamp(){
 difference(){
  union(){
   intersection(){pr_cyl(13,10);pr_box([6.5,30,10],[3.25,0]);}
   for(y=[-8,8])pr_xcyl(9.6,6.5,[0,y,5]);
  }
  pr_cyl(6.8,10.2,[0,0,-.1]);
  for(y=[-8,8]){
   pr_xcyl(3.3,8,[-.1,y,5]);
   pr_xcyl(7.4,4,[3,y,5]);
  }
 }
}

// Two M3 x 12 screws capture the can at its outer rim; centre stays open.
// Nominal can Ø10 x16 starts at deck Z23.5. Do not cover the actual vent.
module pr_capacitor_posts(can_d=10,can_h=16){
 pitch=(can_d+12)/2;nut=can_h-4;
 for(x=[-pitch,pitch])difference(){
  pr_cyl(10.4,can_h+3.3,[x,3,0]);
  pr_cyl(3.3,can_h+5,[x,3,-.1]);
  translate([x,3,nut])cylinder(d=5.8/cos(30),h=2.7,$fn=6);
  pr_cyl(7.4,.5,[x,3,nut+2.4]);
  pr_box([7.4,10,2.9],[x,-2],nut);
 }
}
module camera_pod_capacitor_retainer(can_d=10){
 pitch=(can_d+12)/2;
 difference(){
  union(){
   pr_cyl(can_d+3.4,2.7);
   pr_link([-pitch,3],[pitch,3],10.4,2.7,0);
  }
  pr_cyl(can_d-1.4,3,[0,0,-.1]);
  for(x=[-pitch,pitch])pr_cyl(3.3,3,[x,3,-.1]);
 }
}
