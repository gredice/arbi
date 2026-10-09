"""Assembly-path, driver-access, optical-envelope and regression checks for nominal CAD."""
import json,math,hashlib
import numpy as np
import trimesh
import manifold3d as mf
from integration import assembly,T,R,ROOT,CONFIG,ENCLOSURE,ENCLOSURE_COVER_X,ENCLOSURE_COVER_Y,ENCLOSURE_POWER_PORT,ENCLOSURE_CSI_PORT,ENCLOSURE_SERVO_PORT,ENCLOSURE_TILT_AXIS_Y,ENCLOSURE_TILT_AXIS_Z,ENCLOSURE_DRIVE_SHIFT_X
from check_integration import solid,overlaps,EPS_VOLUME

parts=assembly();by={p['name']:p for p in parts}
AXIS_Y=ENCLOSURE_TILT_AXIS_Y if ENCLOSURE else 0
AXIS_Z=ENCLOSURE_TILT_AXIS_Z if ENCLOSURE else -59
CAMERA_SHIFT=T(0,AXIS_Y,AXIS_Z+59)
DRIVE_SHIFT=ENCLOSURE_DRIVE_SHIFT_X if ENCLOSURE else 0
def geom(mesh):return mf.Manifold(mf.Mesh(np.asarray(mesh.vertices,dtype=np.float32),np.asarray(mesh.faces,dtype=np.uint32)))
def hits(mesh,targets):
 g=geom(mesh);b=mesh.bounds;out=[]
 for p in targets:
  s,pb=solid(p)
  if overlaps(b,pb):
   v=float((g^s).volume())
   if v>EPS_VOLUME:out.append({'part':p['name'],'volume_mm3':round(v,5)})
 return out

def path(label,movers,targets,offsets,intended_engagements=()):
 bad=[]
 for step,matrix in enumerate(offsets):
  for p in movers:
   m=trimesh.load_mesh(ROOT/p['file']);m.apply_transform(matrix@np.array(p['matrix']))
   h=hits(m,[target for target in targets if (p['name'],target['name']) not in intended_engagements])
   if h:bad.append({'step':step,'moving':p['name'],'hits':h})
 report={'name':label,'positions':len(offsets),'failures':bad}
 if intended_engagements:report['intended_engagement_exclusions']=[list(pair) for pair in intended_engagements]
 return report

def cylinder(d,length,mat):
 m=trimesh.creation.cylinder(radius=d/2,height=length,sections=64);m.apply_translation([0,0,length/2]);m.apply_transform(mat);return m

def main():
 results=[]
 results.append(path('pan servo inserted downward through the upper opening',[by['pan-servo']],[by['pan-mount']],[T(0,0,z) for z in range(36,-1,-1)]))
 results.append(path('tilt servo inserted inward from the left with outer head removed' if ENCLOSURE else 'tilt servo inserted inward from the left',[by['tilt-servo']],[by['pan-yoke']],[T(-x) for x in range(30,-1,-1)]))
 results.append(path('camera and hood inserted upward after horn attachment',[by['camera'],by['camera-hood']],[by['camera-cradle']],[T(0,0,-z) for z in range(25,-1,-1)]))
 if ENCLOSURE:
  # The front eye face must pass each complete screw head and its OD5 washer,
  # not only the thinner driver tip. The rear nuts fit afterwards.
  for i in range(4):
   results.append(path(f'camera M2x12 bolt and front washer {i} enter through eye-face tunnel before rear nuts are fitted',
    [by[f'camera-bolt-{i}'],by[f'camera-front-washer-{i}']],
    [by['camera-hood'],by['camera'],by['camera-cradle']],
    [T(0,0,z) for z in np.arange(-20,.01,.5)]))
  results.append(path('rain hood lifts vertically with captive nuts after lower bolts are removed',[by['rain-hood']]+[p for p in parts if p['name'].startswith('cover-nut-')],[p for p in parts if p['name']!='rain-hood' and not p['name'].startswith('cover-')],[T(0,0,z) for z in range(61)]))
  results.append(path('upper rain tray lifts off spider before deck spacers and gimbal are fitted',[by['enclosure-base']],[by['spider']],[T(0,0,z) for z in range(61)]))
  # Assemble the carrier outside the single outer print. Its captive hardware
  # loads first. Long top access needs the electronics/tray stack absent, while
  # a bench fixture supports the retained spider and fixed pan-servo mount.
  outer_removed=[p['name'] for p in parts if p['name']=='gimbal-head' or p['name'].startswith('head-')]
  upper_removed=[p['name'] for p in parts if p['group']=='fixed' and p['name'] not in ['spider','pan-mount','pan-servo'] and not p['name'].startswith('pan-servo-')]
  service_parts=[p for p in parts if p['name'] not in upper_removed]
  results.append(path('rolled upper rain tray lifts off retained neutral gimbal after upper hardware and harness are removed',
   [by['enclosure-base']],service_parts,[T(0,0,z) for z in range(61)]))
  for i,(x,y) in enumerate([(x,y) for x in [-8,8] for y in [-30.5,30.5]]):
   loaded=path(f'outer head captive nut and lower washer {i} slide 11 mm from inward side before carrier fitting',
    [by[f'head-nut-{i}'],by[f'head-lower-washer-{i}']],[by['gimbal-head']],
    [T(0,(-1 if y>0 else 1)*d,0) for d in np.arange(11,-.01,-.5)])
   loaded['stage']='outer body alone; carrier and upper bolts not yet fitted'
   results.append(loaded)
  outer_release=path('with upper stack removed and pan mount fixture-supported, outer body lowers off complete neutral carrier after four upper bolts are removed',
   [by['gimbal-head']]+[p for p in parts if p['name'].startswith('head-nut-') or p['name'].startswith('head-lower-washer-')],
   [p for p in service_parts if p['name'] not in outer_removed],[T(0,0,-z) for z in range(101)])
  outer_release['removed_before']=upper_removed+[p['name'] for p in parts if p['name'].startswith('head-bolt-') or p['name'].startswith('head-upper-washer-')]
  results.append(outer_release)
  for i in range(4):
   results.append(path(f'head bolt and upper washer {i} inserted from open top before upper tray and electronics are fitted',
    [by[f'head-bolt-{i}'],by[f'head-upper-washer-{i}']],
    [p for p in service_parts if p['name'] not in [f'head-bolt-{i}',f'head-upper-washer-{i}']],
    [T(0,0,z) for z in np.arange(40,-.01,-.5)]))
  bare_carrier=[p for p in service_parts if p['name'] not in outer_removed]
  camera_removed=[p['name'] for p in parts if p['name'] in ['camera','camera-hood'] or p['name'].startswith('camera-') and p['name']!='camera-cradle']
  camera_front=[p for p in parts if p['name'] in ['camera','camera-hood'] or p['name'].startswith('camera-bolt-') or p['name'].startswith('camera-front-washer-')]
  retained_carrier=[p for p in bare_carrier if p['name'] not in camera_removed]
  camera_release=path('with outer body and rear camera nuts removed, camera hood PCB front bolts and washers lower from retained cradle',
   camera_front,retained_carrier,[T(0,0,-z) for z in range(31)])
  camera_release['removed_before']=upper_removed+outer_removed+[p['name'] for p in parts if p['name'].startswith('camera-nut-') or p['name'].startswith('camera-back-washer-')]
  results.append(camera_release)
  screw_release=path('with outer body and camera removed, OEM pan centre screw withdraws through open cradle',
   [by['pan-horn-center-screw']],[p for p in retained_carrier if p['name']!='pan-horn-center-screw'],
   [T(0,0,-z) for z in np.arange(0,35.01,.5)],(('pan-horn-center-screw','pan-servo'),))
  screw_release['removed_before']=upper_removed+outer_removed+camera_removed
  results.append(screw_release)
  carrier_release=path('after outer body camera and OEM centre screw removal, supported carrier lowers from fixed pan servo',
   [p for p in retained_carrier if p['group']!='fixed' and p['name']!='pan-horn-center-screw'],
   [p for p in retained_carrier if p['group']=='fixed'],[T(0,0,-z) for z in range(101)],(('pan-horn','pan-servo'),))
  carrier_release['removed_before']=upper_removed+outer_removed+camera_removed+['pan-horn-center-screw']
  results.append(carrier_release)
  for y in ENCLOSURE_COVER_Y:
   for x in ENCLOSURE_COVER_X:
    n=next(p for p in parts if p['name'].startswith('cover-nut-') and np.allclose(np.array(p['matrix'])[:2,3],[x,y]))
    results.append(path(f'M3 captive nut side load at {x},{y}',[n],[by['rain-hood']],[T(0,(-1 if y>0 else 1)*d,0) for d in np.arange(14,-.01,-.5)]))
 else:
  results.append(path('cover lifts vertically after removing its hardware',[by['electronics-cover']],[p for p in parts if p['name']!='electronics-cover' and not p['name'].startswith('cover-')],[T(0,0,z) for z in range(41)]))
 # Shift right to disengage, then seat left onto the spline; support is removed.
 moving=[by[n] for n in ['camera-cradle','tilt-horn','tilt-horn-retainer']]+[p for p in parts if p['name'].startswith('tilt-retainer-')]
 # Horn/spline is an intended engagement; test cradle/cap against servo separately.
 results.append(path('cradle seated on tilt servo with opposite support removed',moving,[by['pan-yoke']],[T(x,0,0) for x in np.arange(3,-.01,-.25)]))
 results.append(path('camera cradle clears tilt servo during seating',[p for p in moving if p['name']!='tilt-horn'],[by['tilt-servo']],[T(x,0,0) for x in np.arange(3,-.01,-.25)]))
 results.append(path('pivot nut drops through open-top slot',[by['pivot-nut']],[by['camera-cradle']],[T(0,0,z) for z in np.arange(12,-.01,-.5)]))
 # The shorter compact support slides in from the right; its upper screws and
 # pivot hardware are installed afterwards. The tall bench support fits upward.
 results.append(path('opposite support fitted inward from the right' if ENCLOSURE else 'opposite support fitted upward',[by['tilt-pivot-support']],[by['pan-yoke'],by['camera-cradle']],[T(x,0,0) if ENCLOSURE else T(0,0,-x) for x in np.arange(12,-.01,-.5)]))
 tools=[]
 def tool(name,d,l,mat,targets):
  tools.append({'name':name,'diameter_mm':d,'straight_tip_length_mm':l,'hits':hits(cylinder(d,l,mat),targets)})
 for y in [-10,10]:
  tool('pan retainer short driver before outer head and fixed pan host are fitted' if ENCLOSURE else 'pan retainer short driver before fairing installation',2,15,T(0,y,-25.99),[p for p in parts if p['name'] not in ['electronics-cover','rain-hood','enclosure-base','gimbal-head'] and not p['name'].startswith('pan-retainer-bolt')])
  if ENCLOSURE:
   # The horizontal servo blocks the rear retainer driver after engagement.
   # Fasten the horn on the separate cradle first, then use the checked seating
   # path to slide that completed subassembly onto the servo spline.
   horn_subassembly=[p for p in parts if p['name'] in ['camera-cradle','tilt-horn','tilt-horn-retainer'] or p['name'].startswith('tilt-retainer-')]
   tool('tilt retainer driver on separate cradle and horn before servo engagement',2,15,T(-23.01+DRIVE_SHIFT,y+AXIS_Y,AXIS_Z)@R('y',-90),[p for p in horn_subassembly if not p['name'].startswith('tilt-retainer-bolt')])
   tools[-1]['assembly_stage']={'description':'Cradle and captured stock horn on the bench, before engaging the mounted tilt servo or fitting the camera and opposite support.','subassembly_parts':[p['name'] for p in horn_subassembly]}
  else:tool('tilt retainer short driver before moving covers and fairing',2,15,T(-23.01,y,-59)@R('y',-90),[p for p in parts if not p['name'].startswith('tilt-retainer-bolt') and p['name']!='gimbal-head'])
 if ENCLOSURE:
  tool('pan OEM centre driver through open cradle after outer body and camera removal',2.5,65,T(0,0,-30.81)@R('x',180),[p for p in retained_carrier if p['name']!='pan-horn-center-screw'])
 else:tool('pan OEM centre driver',2.5,15,T(0,0,-30.81)@R('x',180),[by['pan-yoke']])
 tool('tilt OEM centre driver before camera mounting',2.5,15,T(-18.19+DRIVE_SHIFT,AXIS_Y,AXIS_Z)@R('y',90),[by['camera-cradle']])
 for x in [-10.5,10.5]:
  for y in [4.931,-7.569]:
   tool('camera front driver',2,15,CAMERA_SHIFT@T(x,y,-68.83)@R('x',180),[by['camera-hood'],by['camera'],by['camera-cradle']])
 if ENCLOSURE:
  for x in ENCLOSURE_COVER_X:
   for y in ENCLOSURE_COVER_Y:
    tool('rain hood lower screw driver',3,18,T(x,y,9.69)@R('x',180),[by['enclosure-base'],by['deck'],by['rain-hood'],by['spider']])
  for i,(x,y) in enumerate([(x,y) for x in [-8,8] for y in [-30.5,30.5]]):
   tool('head upper screw long driver with upper tray and electronics absent and spider retained',2,80,T(x,y,-26.89),[p for p in service_parts if p['name']!=f'head-bolt-{i}'])
  for i in range(4):
   nut=by[f'camera-nut-{i}'];_,bounds=solid(nut)
   x,y=np.array(nut['matrix'])[:2,3];z=float(bounds[1,2])+.01
   # A socket neck is hollow: its centre passes the protruding M2 screw. Check
   # every retained part, including that screw, instead of hiding its contact.
   socket=geom(cylinder(5.3,6,T(x,y,z)))-geom(cylinder(2.4,6.02,T(x,y,z-.01)))
   raw=socket.to_mesh();mesh=trimesh.Trimesh(vertices=np.asarray(raw.vert_properties)[:,:3],faces=np.asarray(raw.tri_verts))
   tools.append({'name':f'rear camera nut {i} short socket neck after outer body removal',
                 'diameter_mm':5.3,'through_bore_diameter_mm':2.4,'straight_tip_length_mm':6,
                 'axis_start_mm':[float(x),float(y),z],
                 'assembly_stage':'Neutral carrier with the outer body and upper stack removed; this checks only the local socket neck above the nut, not handle placement or wrench turning.',
                 'hits':hits(mesh,bare_carrier)})
 # Official Standard drawing gives 66 deg horizontal / 41 deg vertical.
 # 80 mm pyramid extends beyond the nearby bracket geometry; lens/board itself excluded.
 optics=[]
 origin=np.array([0,-7.469+AXIS_Y,-72.60+AXIS_Z+59]);depth=80.;xx=depth*math.tan(math.radians(33));yy=depth*math.tan(math.radians(20.5))
 vertices=[origin]+[origin+np.array([x,y,-depth]) for x in [-xx,xx] for y in [-yy,yy]]
 pyramid=trimesh.convex.convex_hull(np.array(vertices))
 for pan in ([-90,-45,0,45,90] if ENCLOSURE else [-90,0,90]):
  for tilt in [0,35,70]:
   m=pyramid.copy();m.apply_transform(R('z',pan)@T(0,AXIS_Y,AXIS_Z)@R('x',tilt)@T(0,-AXIS_Y,-AXIS_Z))
   targets=[p for p in assembly(pan,tilt) if p['name']!='camera']
   optics.append({'pan':pan,'tilt':tilt,'hits':hits(m,targets)})
 # Deliberately add a proud head at a rotating retainer. This must fail at pan=90.
 pose={p['name']:p for p in assembly(90,0)}
 bolt=pose['pan-retainer-bolt-0'];head=cylinder(3.6,2,np.array(bolt['matrix'])@R('x',180))
 regression=hits(head,[pose['pan-servo'],pose['pan-mount']])
 wiring=[]
 if ENCLOSURE:
  def rectangular(size,mat):
   m=trimesh.creation.box(extents=size);m.apply_transform(mat);return m
  port_defs=[('48 V input lead',cylinder(6,17,T(*ENCLOSURE_POWER_PORT,7)),[by['enclosure-base'],by['deck']],{'diameter_mm':6,'axis_mm':ENCLOSURE_POWER_PORT,'z_mm':[7,24]}),
   ('fixed CSI downward passage',rectangular([16,.3,17],T(*ENCLOSURE_CSI_PORT,15.5)),[by['enclosure-base'],by['deck']],{'section_mm':[16,.3],'axis_mm':ENCLOSURE_CSI_PORT,'z_mm':[7,24]}),
   ('pan servo downward leads',rectangular([4,2,17],T(*ENCLOSURE_SERVO_PORT,15.5)),[by['enclosure-base'],by['deck']],{'section_mm':[4,2],'axis_mm':ENCLOSURE_SERVO_PORT,'z_mm':[7,24]}),
   ('moving head upper lead passage',rectangular([6,2,8],T(-36.5,0,-4.1)),[by['gimbal-head']],{'section_mm':[6,2],'axis_mm':[-36.5,0],'z_mm':[-8.1,-.1]})]
  for label,mesh,targets,dimensions in port_defs:
   wiring.append({'name':label,'nominal_envelope':dimensions,'hits':hits(mesh,targets)})
  for x in [-30,20]:
   wiring.append({'name':f'tray drain at X={x} remains open through the rolled shoulder',
    'nominal_envelope':{'section_mm':[5.6,1.6],'axis_mm':[x,-56],'z_mm':[-7,14.4]},
    'hits':hits(rectangular([5.6,1.6,21.4],T(x,-56,3.7)),[by['enclosure-base']])})
 route_report=None
 if ENCLOSURE:
  points=np.array([[10,40,24],[10,40,1],[10,60,1],[10,60,-61],[10,70,-61]],dtype=float)
  route_solids=[]
  for a,b in zip(points[:-1],points[1:]):
   vector=b-a
   mesh=trimesh.creation.cylinder(radius=3,height=np.linalg.norm(vector),sections=64)
   mesh.apply_transform(trimesh.geometry.align_vectors([0,0,1],vector));mesh.apply_translation((a+b)/2);route_solids.append(geom(mesh))
  for point in points:
   mesh=trimesh.creation.icosphere(subdivisions=3,radius=3);mesh.apply_translation(point);route_solids.append(geom(mesh))
  route=mf.Manifold.batch_boolean(route_solids,mf.OpType.Add);raw=route.to_mesh()
  route_mesh=trimesh.Trimesh(vertices=np.asarray(raw.vert_properties)[:,:3],faces=np.asarray(raw.tri_verts))
  assert route_mesh.is_watertight and route_mesh.is_winding_consistent and route_mesh.volume>0 and route_mesh.body_count==1
  route_path=ROOT/'models/reference/fixed-power-route-6mm-NOMINAL.stl';route_path.write_bytes(route_mesh.export(file_type='stl'))
  entry={'id':'fixed-power-route-6mm-NOMINAL','model_id':'fixed-power-route-6mm-NOMINAL','file':str(route_path.relative_to(ROOT)),
   'kind':'rigid harness route proxy; not a selected flexible cable','units':'mm','bounds_mm':route_mesh.bounds.tolist(),
   'triangles':len(route_mesh.faces),'body_count':1,'volume_mm3':float(route_mesh.volume),'source':'source/check_service.py',
   'export_translation_mm':[0,0,0],'watertight':True,'winding_consistent':True,'stl_sha256':hashlib.sha256(route_path.read_bytes()).hexdigest()}
  manifest=[e for e in json.loads((ROOT/'mesh-manifest.json').read_text()) if e['model_id']!=entry['model_id']]+[entry]
  (ROOT/'mesh-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
  failures=[];pose_count=0
  for pan in range(-90,91,5):
   for tilt in [0,35,70]:
    h=hits(route_mesh,assembly(pan,tilt));pose_count+=1
    if h:failures.append({'pan':pan,'tilt':tilt,'hits':h})
  # Keep an intentionally misplaced drop near the pan stop as a sensitivity
  # control; it is separate from the compact deck's relocated power outlet.
  incorrect=hits(cylinder(6,94,T(-8,31,-70)),assembly(15,0))
  route_report={'diameter_mm':6,'centerline_mm':points.tolist(),'poses':pose_count,'pan_deg':[-90,90,5],'tilt_deg':[0,35,70],
    'file':entry['file'],'failures':failures,'incorrect_straight_route_control':{'description':'Deliberately misplaced central drop beside the pan stop; not the selected power outlet','axis_mm':[-8,31],'z_mm':[-70,24],'expected_collision_detected':any(h['part']=='pan-yoke' for h in incorrect),'hits':incorrect},
    'limits':'Rigid swept tube around a nominal polyline; actual bend radius, flexible loops, shrinkage, sleeves, ties and lead construction require bench inspection.'}
 report={'configuration':CONFIG,'enclosure_service_sequence':(['Support the pan mount and spider with a bench fixture, isolate power and release the flexible harness. Remove the upper hood, electronics deck and tray stack to reach the four head bolts from above.','At neutral remove the four head bolts and upper washers, then lower the one-piece outer body with its captive lower washers and nuts clear of the complete carrier.','Remove the four rear camera nuts and washers, then lower the camera/optical hood with its front fasteners from the retained cradle.','With the camera out, reach the OEM pan centre screw through the open cradle, remove it and lower the supported carrier from the fixed servo if required.','For assembly, fasten the stock tilt horn and retainer to the separate cradle before engaging the mounted servo spline; the horizontal servo blocks one retainer driver after engagement. Preload the four lower washers and nuts through the body inside openings, populate the carrier outside the body, then fit the body and four upper bolts before the upper tray and electronics.'] if ENCLOSURE else []),'fixed_power_route':route_report,'assembly_paths':results,'wiring_ports':wiring,'tool_access':tools,'view_check':{'horizontal_deg':66,'vertical_deg':41,'depth_mm':80,'poses':optics},
 'proud_head_regression_control':{'expected_collision_detected':bool(regression),'hits':regression},
 'limits':['Port checks cover only local openings; a straight downward power/CSI/servo route may hit the spider or gimbal. Route outboard before the sweep and inspect actual flex.',
           'Rigid nominal envelopes only; flexible leads, connectors and ribbon routing need a bench check.',
           'Straight-tool envelopes cover the listed lengths and stated assembly stages; driver handles, wrench turning and every tool insertion trajectory remain unmodeled.',
           'The servo spline and OEM threaded centre screw are intended engagement exclusions.']}
 (ROOT/'service-check.json').write_text(json.dumps(report,indent=2)+'\n')
 for r in results:print(r['name'],len(r['failures']),flush=True)
 for t in tools:
  if t['hits']:print('TOOL',t,flush=True)
 for w in wiring:
  if w['hits']:print('PORT',w,flush=True)
 for o in optics:
  if o['hits']:print('OPTIC',o,flush=True)
 assert not any(r['failures'] for r in results),'Assembly path blocked'
 assert not any(t['hits'] for t in tools),'Driver access blocked'
 assert not any(o['hits'] for o in optics),'Optical view obstructed'
 assert not any(w['hits'] for w in wiring),'Cable port blocked'
 if ENCLOSURE:
  print('Fixed power route',route_report['poses'],'poses',len(route_report['failures']),'failures',flush=True)
  for failure in route_report['failures'][:5]:print('ROUTE',failure,flush=True)
  assert not route_report['failures'],'Fixed power route blocked'
  assert route_report['incorrect_straight_route_control']['expected_collision_detected'],'Straight-wire regression control failed'
 assert regression,'Regression control did not detect a proud-head collision'
 print('Service, view and regression checks PASS',flush=True)
if __name__=='__main__':main()
