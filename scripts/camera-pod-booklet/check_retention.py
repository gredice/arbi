"""Nominal tie-free retention: capture, stopped channels, preload and tool paths."""
import json
from collections import Counter
import numpy as np
import trimesh
from integration import assembly,ROOT,T,R,ENCLOSURE,retention_matrix
from check_service import path,hits,cylinder


def box(size,mat):
 m=trimesh.creation.box(extents=size);m.apply_transform(mat);return m


def main():
 assert ENCLOSURE
 parts=assembly();by={p['name']:p for p in parts}
 assert not any('tie' in p['name'] or 'tie' in p['model'] for p in parts)
 counts=Counter(p['model'] for p in parts)
 for model,n in [('camera-pod-capacitor-retainer',1),('camera-pod-power-clamp',1),('camera-pod-ribbon-clamp',2),('camera-pod-loom-clamp',2),('ribbon-liner-reference',4),('loom-liner-reference',4),('power-liner-reference',1)]:assert counts[model]==n,(model,counts[model])
 capture=[]
 for offset in [T(.5),T(-.5),T(0,.5),T(0,-.5),T(0,0,.5),T(0,0,-.5)]:
  can=trimesh.load_mesh(ROOT/by['capacitor']['file']);can.apply_transform(offset@np.array(by['capacitor']['matrix']))
  collision=hits(can,[by['deck'],by['capacitor-retainer']]);assert collision,'Can escaped holder'
  capture.append({'offset_mm':offset[:3,3].tolist(),'capture_hits':collision})
 assert not hits(cylinder(8,5,T(32,-34,39.6)),[by['capacitor-retainer']]),'Nominal central vent opening blocked'
 paths=[];tools=[];channels=[]
 paths.append(path('capacitor removed upward after its ring and screws are removed',[by['capacitor']],[by[n] for n in ['deck','pi','converter']],[T(0,0,d) for d in np.arange(0,25.1,.5)]))
 paths.append(path('capacitor retaining ring lifted after its two screws are removed',[by['capacitor-retainer']],[by[n] for n in ['deck','pi','converter','capacitor']],[T(0,0,d) for d in np.arange(0,20.1,.5)]))
 for i in range(2):
  tools.append({'name':'capacitor driver with roof removed '+str(i),'hits':hits(cylinder(3,20,T([21,43][i],-31,43)),[by['deck'],by['pi'],by['converter'],by['capacitor'],by['capacitor-retainer']])})
  paths.append(path('capacitor washer/nut side preload '+str(i),[by[f'capacitor-nut-{i}'],by[f'capacitor-bottom-washer-{i}']],[by['deck']],[T(0,-d) for d in np.arange(10,-.01,-.5)]))
  paths.append(path('power washer/nut top preload '+str(i),[by[f'power-nut-{i}'],by[f'power-bottom-washer-{i}']],[by['deck']],[T(0,0,d) for d in np.arange(10,-.01,-.5)]))
  tools.append({'name':'power side driver with roof removed '+str(i),'hits':hits(cylinder(3,20,T(13.5,[32,48][i],25.5)@R('y',90)),[by['deck'],by['pi'],by['converter'],by['power-clamp']])})
 paths.append(path('power jaw separates laterally after screws and liner are removed',[by['power-clamp']],[by['deck']],[T(d) for d in np.arange(0,15.1,.5)]))
 specs=[('fixed-ribbon',(0,-39,24),1.1,13,16,'deck'),('pan-ribbon',(0,-19,-35),1.1,13,16,'pan-yoke'),('fixed-loom',(-40,11,21.5),2.8,7.5,4,'deck'),('pan-loom',(0,-7,-34.6),2.8,7.5,4,'pan-yoke')]
 for label,(x,y,z),gap,pitch,width,host in specs:
  base=by[host];cap=by[label+'-clamp'];pan=label.startswith('pan-');frame=retention_matrix((x,y,z),'pan' if pan else 'fixed')
  for i in range(2):
   paths.append(path(label+' underside nut loading before bolting '+str(i),[by[f'{label}-nut-{i}']],[base],[T(0,0,d if pan else -d) for d in np.arange(10,-.01,-.5)]))
   tools.append({'name':label+' driver on separate host before PCB/servo assembly '+str(i),'hits':hits(cylinder(3,20,frame@T([-pitch,pitch][i],0,gap+2.5)),[base,cap])})
  paths.append(path(label+' bridge lifts after screws and liners are removed',[cap],[base],[T(0,0,-d if pan else d) for d in np.arange(0,15.1,.5)]))
  right=box([width,9,gap],frame@T(0,0,gap/2));wrong=box([width,9,gap+.4],frame@T(0,0,(gap+.4)/2))
  assert not hits(right,[base,cap]),label
  control=hits(wrong,[base,cap]);assert control,label+' wrong stack missed'
  channels.append({'name':label,'stopped_gap_mm':gap,'free_liners_mm':[.5,.5],'nominal_compressed_liners_mm':[.4,.4],'nominal_wire_section_mm':[width,gap-.8],'oversize_stack_control':control})
 assert hits(cylinder(7.4,10,T(10,40,20.5)),[by['deck'],by['power-clamp']]),'Oversized power sleeve control missed'
 pose={p['name']:p for p in assembly(-90,0)}
 raised=trimesh.load_mesh(ROOT/pose['pan-ribbon-clamp']['file']);raised.apply_transform(T(0,0,12)@np.array(pose['pan-ribbon-clamp']['matrix']))
 regression=hits(raised,[pose['pan-mount']]);assert regression,'Raised carrier-clamp regression missed'
 report={'raised_carrier_clamp_control':{'pan_deg':-90,'upward_error_mm':12,'hits':regression},'status':'nominal CAD only; received fit, grip and fatigue unverified','configuration':'compact enclosure','installed_ties':0,'can_capture_controls':capture,'nominal_vent_probe_diameter_mm':8,'paths':paths,'tools':tools,'channels':channels,'power_sleeve':{'free_ID_OD_length_mm':[6,7,10],'stopped_bore_mm':6.8,'nominal_diametral_compression_mm':.2},'limits':'Measure the actual capacitor/vent, sleeved leads and FPC. Choose compatible insulating silicone liners and verify compression, pull-out, isolation, heat and fatigue. Clamps do not terminate positioning-line tension. Carrier clamps are fitted on the separate carrier before mounting; fixed servo clamp before the Pi.'}
 (ROOT/'retention-check.json').write_text(json.dumps(report,indent=2)+'\n')
 bad=[p for p in paths if p['failures']];toolbad=[t for t in tools if t['hits']]
 assert not bad,[(p['name'],len(p['failures'])) for p in bad]
 assert not toolbad,toolbad
 print('PASS tie-free retention: can capture, stopped channels, loading/removal/driver paths and wrong-size controls.')


if __name__=='__main__':main()
