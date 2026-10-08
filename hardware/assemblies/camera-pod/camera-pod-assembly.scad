// ARBI camera-pod-assembly 0.3.4 — preferred integrated rain-payload reference.
// NON-MANUFACTURING LAYOUT MODEL; concept-unvalidated. Canonical units are millimetres.
include <../../lib/camera-pod.scad>
use <payload-rain-assembly.scad>
show_legacy = false;
show_context = false;
pan = 0;
tilt = 0;
show_hood = true;
if(show_legacy)camera_pod_assembly(show_context);
else payload_rain_assembly(pan,tilt,show_hood);
