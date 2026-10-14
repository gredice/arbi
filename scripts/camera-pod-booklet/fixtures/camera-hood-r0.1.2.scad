// Exact previous r0.1.2 geometry; regression fixture, not a printable model.
include <../arbi-hardware/lib/camera-pod-enclosure.scad>
module previous_camera_hood() {
    difference() {
        union() {
            difference() {
                pe_round_xy([34,36],9,2,6,[0,-2.469]);
                // 1.2+ mm per side around the rounded 25 × 24 product PCB.
                pm_box([27.8,26.6,8],[0,0],3.1);
                // Clear the complete 10.8 ±0.15 square autofocus footprint,
                // including its corners, instead of only a Ø5.75 lens barrel.
                pe_round_xy([12.2,12.2],.6,1.99,2,[0,-2.469]);
            }
            for(x=[-10.5,10.5],y=[9.931,-2.569]) {
                // Short exposed seating lands; no roof over the incoming PCB.
                pm_cyl(4.8,1.4,[x,y,8]);
                pm_link([x,y],[x<0?-14.8:14.8,y],4.8,1.4,8);
            }
        }
        for(x=[-10.5,10.5],y=[9.931,-2.569])pm_cyl(2.3,3,[x,y,7.5]);
        // Recessed access tunnels admit the M2 head and 5 mm washer as well as its
        // driver. The clamp lands now occupy Z=8..9.4; their installed plane
        // is unchanged because the assembled hood translates 2 mm rearward.
        for(x=[-10.5,10.5],y=[9.931,-2.569])pm_cyl(5.4,5.71,[x,y,1.99]);
    }
}

previous_camera_hood();
