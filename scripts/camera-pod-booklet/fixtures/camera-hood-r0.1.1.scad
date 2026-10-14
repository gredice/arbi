// Exact r0.1.1 hood geometry retained ONLY as an interference regression control.
// Helpers come from the copied source tree; this is not a current print model.
include <../arbi-hardware/lib/camera-pod-enclosure.scad>
difference() {
    union() {
        difference() {
            pe_round_xy([34,36],9,2,8,[0,-2.469]);
            pm_box([26.6,25.6,8],[0,0],3.4);
            pm_cyl(14,2,[0,-2.469,1.99]);
        }
        for(x=[-10.5,10.5],y=[9.931,-2.569]) {
            pm_cyl(4.8,1.4,[x,y,10]);
            pm_link([x,y],[x<0?-14.8:14.8,y],4.8,1.4,10);
        }
    }
    for(x=[-10.5,10.5],y=[9.931,-2.569])pm_cyl(2.3,3,[x,y,9.5]);
    for(x=[-10.5,10.5],y=[9.931,-2.569])pm_cyl(5.4,7.71,[x,y,1.99]);
}
