// Unreleased short-exit hood retained only to detect the thin closing lip.
include <../arbi-hardware/lib/camera-pod-enclosure.scad>
module short_exit_hood() {
    difference() {
        union() {
            difference() {
                pe_round_xy([34,36],9,2,4,[0,-2.469]);
                // 29.4 × 28.2 cavity, flared to 31 × 30 at the low rear rim.
                // The walls end 3.4 mm below the PCB seat, so a tilted board
                // cannot become trapped inside a deep pocket.
                pm_box([29.4,28.2,8],[0,0],3.1);
                hull() {
                    pm_box([29.4,28.2,.02],[0,0],5);
                    pm_box([31,30,.02],[0,0],6);
                }
                // Extra clearance for the complete autofocus body and hand
                // alignment. Keep 1 mm webs beside the Ø5.4 screw tunnels.
                pe_round_xy([13.6,13.6],.6,1.99,2,[0,-2.469]);
                // Open rear CSI edge: cable/latch access above the front rim.
                pm_box([25,8,8],[0,-16],3.1);
            }
            for(x=[-10.5,10.5],y=[9.931,-2.569]) {
                // Short exposed seating lands; no roof over the incoming PCB.
                pm_cyl(4.8,1.4,[x,y,8]);
                pm_link([x,y],[x<0?-14.8:14.8,y],4.8,1.4,8);
                // Outside gusset joins each unchanged clamp land to the low
                // shell without adding an inward lip over the camera PCB.
                hull() {
                    pm_cyl(4.8,.2,[x<0?-14.8:14.8,y,5.6]);
                    pm_cyl(4.8,.2,[x<0?-14.8:14.8,y,8]);
                }
            }
        }
        for(x=[-10.5,10.5],y=[9.931,-2.569])pm_cyl(2.3,3,[x,y,7.5]);
        // Recessed access tunnels admit the M2 head and 5 mm washer as well as its
        // driver. The clamp lands now occupy Z=8..9.4; their installed plane
        // is unchanged because the assembled hood translates 2 mm rearward.
        // Clear the complete front washer up to the Z=8 land underside,
        // including the outside gusset's overlap with the tunnel wall.
        for(x=[-10.5,10.5],y=[9.931,-2.569])pm_cyl(5.4,6.01,[x,y,1.99]);
    }
}

short_exit_hood();
