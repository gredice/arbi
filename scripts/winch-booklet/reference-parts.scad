// Illustration reference geometry, millimetres. NOT manufacturing files.
// Bought parts use nominal repository/catalog dimensions; inspect real hardware.
// Internal bearing details, fastener threads and coupling teeth are simplified.
part="bearing-608";
$fn=96;
e=0.02;

module ring(od,id,h) { difference(){cylinder(d=od,h=h);translate([0,0,-e])cylinder(d=id,h=h+2*e);} }
module bearing608() {
    difference() {
        ring(22,8,7);
        for(z=[-e,6.7]) translate([0,0,z]) ring(19.5,12,0.32);
    }
}
module collar() {
    difference() {
        ring(20,8,10);
        translate([0,-0.35,-e])cube([12,0.7,10+2*e]);
        translate([7,-12,5])rotate([-90,0,0])cylinder(d=3.2,h=24);
    }
}
module sector(r1,r2,angle,h) {
    linear_extrude(h) polygon(concat(
        [for(a=[-angle/2:angle/16:angle/2])[r2*cos(a),r2*sin(a)]],
        [for(a=[angle/2:-angle/16:-angle/2])[r1*cos(a),r1*sin(a)]]));
}
module jaw_hub() {
    difference() {
        union() {
            ring(20,8,8);
            for(a=[0,120,240])rotate([0,0,a])translate([0,0,7.9])sector(6.2,10,40,9.1);
        }
        translate([0,-11,4])rotate([-90,0,0])cylinder(d=3,h=22);
    }
}
module spider() {
    union() {
        ring(12,8.2,8.8);
        for(a=[30:60:330])rotate([0,0,a])sector(5.9,9.8,18,8.8);
    }
}
module chamfered_square(side,ch,h) {
    s=side/2;
    linear_extrude(h)polygon([[-s+ch,-s],[s-ch,-s],[s,-s+ch],[s,s-ch],
      [s-ch,s],[-s+ch,s],[-s,s-ch],[-s,-s+ch]]);
}
module motor() {
    difference() {
        union() {
            chamfered_square(57,4,122);
            translate([0,0,-1.6])cylinder(d=38.1,h=1.7);
            translate([0,0,-22])cylinder(d=8,h=22.1);
        }
        for(x=[-23.57,23.57],y=[-23.57,23.57])translate([x,y,-e])cylinder(d=4.5,h=8.2);
        translate([-5,3.5,-22-e])cube([10,2,15]);
        for(z=[8,104])translate([0,0,z])difference(){
            translate([-30,-30,0])cube([60,60,0.7]);
            chamfered_square(55.8,4,1);
        }
    }
}
module bolt(d,L) {
    hd=d==4?7:d==5?8.5:d==6?10:13;
    key=d==4?3:d==5?4:d==6?5:6;
    difference() {
        union(){ cylinder(d=d,h=L);translate([0,0,-d])cylinder(d=hd,h=d+e);}
        translate([0,0,-d-e])cylinder(d=key/cos(30),h=d*0.55,$fn=6);
    }
}
module nut(d,lock=false) {
    af=d==4?7:d==5?8:d==6?10:13;
    h=d==4?3.2:d==5?4:d==6?5:6.5;
    lh=d==4?5:d==5?5:d==6?6:8;
    difference() {
        union() {
            cylinder(d=af/cos(30),h=h,$fn=6);
            if(lock)translate([0,0,h-e])cylinder(d=af,h=lh-h+e);
        }
        translate([0,0,-e])cylinder(d=d,h=(lock?lh:h)+2*e);
    }
}
if(part=="bearing-608")bearing608();
else if(part=="inner-ring-spacer")ring(11,8.2,2);
else if(part=="shaft-collar-8")collar();
else if(part=="coupling-hub")jaw_hub();
else if(part=="coupling-spider")spider();
else if(part=="motor-23HS40-reference")motor();
else if(part=="shaft-8x340")cylinder(d=8,h=340);
else if(part=="shaft-8x660")cylinder(d=8,h=660);
else if(part=="tie-rod-M5x280")cylinder(d=5,h=280);
else if(part=="tie-rod-M5x610")cylinder(d=5,h=610);
else if(part=="washer-M4")ring(9,4.3,0.8);
else if(part=="washer-M5")ring(10,5.3,1);
else if(part=="washer-M6")ring(12,6.4,1.6);
else if(part=="washer-M8")ring(16,8.4,1.6);
else if(part=="nut-M4")nut(4);
else if(part=="nut-M5")nut(5);
else if(part=="nut-M8")nut(8);
else if(part=="nyloc-M4")nut(4,true);
else if(part=="nyloc-M5")nut(5,true);
else if(part=="nyloc-M6")nut(6,true);
else if(part=="nyloc-M8")nut(8,true);
else if(part=="bolt-M4x16")bolt(4,16);
else if(part=="line-passive-reference")cylinder(d=1.5,h=90);
else if(part=="line-powered-reference")cylinder(d=4.5,h=90);
else if(part=="loom-10mm-reference")cylinder(d=10,h=35);
else if(part=="bolt-M4x20")bolt(4,20);
else if(part=="bolt-M4x25")bolt(4,25);
else if(part=="bolt-M4x45")bolt(4,45);
else if(part=="bolt-M5x35")bolt(5,35);
else if(part=="bolt-M6x30")bolt(6,30);
else if(part=="bolt-M8x35")bolt(8,35);
else if(part=="bolt-M8x160")bolt(8,160);
else if(part=="bolt-M8x180")bolt(8,180);
else if(part=="bolt-M8x200")bolt(8,200);
else assert(false,"Unknown reference part");
