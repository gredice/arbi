"""Assembly-path, driver-access, optical-envelope and regression checks for nominal CAD."""
import json,math,hashlib
import numpy as np
import trimesh
import manifold3d as mf
from integration import assembly,T,R,ROOT,CONFIG,ENCLOSURE
from check_integration import solid,overlaps,EPS_VOLUME

parts=assembly();by={p['name']:p for p in parts}
def geom(mesh):return mf.Manifold(mf.Mesh(np.asarray(mesh.vertices,dtype=np.float32),np.asarray(mesh.faces,dtype=np.uint32)))
def hits(mesh,targets):
 g=geom(mesh);b=mesh.bounds;out=[]
 for p in targets:
  s,pb=solid(p)
  if overlaps(b,pb):
   v=float((g^s).volume())
   if v>EPS_VOLUME:out.append({'part':p['name'],'volume_mm3':round(v,5)})
 return out

def path(label,movers,targets,offsets):
 bad=[]
 for step,matrix in enumerate(offsets):
  for p in movers:
   m=trimesh.load_mesh(ROOT/p['file']);m.apply_transform(matrix@np.array(p['matrix']))
   h=hits(m,targets)
   if h:bad.append({'step':step,'moving':p['name'],'hits':h})
 return {'name':label,'positions':len(offsets),'failures':bad}

def cylinder(d,length,mat):
 m=trimesh.creation.cylinder(radius=d/2,height=length,sections=64);m.apply_translation([0,0,length/2]);m.apply_transform(mat);return m

def main():
 results=[]
 results.append(path('pan servo inserted downward through the upper opening',[by['pan-servo']],[by['pan-mount']],[T(0,0,z) for z in range(36,-1,-1)]))
 results.append(path('tilt servo inserted inward from the left',[by['tilt-servo']],[by['pan-yoke']],[T(-x) for x in range(30,-1,-1)]))
 results.append(path('camera and hood inserted upward after horn attachment',[by['camera'],by['camera-hood']],[by['camera-cradle']],[T(0,0,-z) for z in range(25,-1,-1)]))
 if ENCLOSURE:
  results.append(path('rain hood lifts vertically with captive nuts after lower bolts are removed',[by['rain-hood']]+[p for p in parts if p['name'].startswith('cover-nut-')],[p for p in parts if p['name']!='rain-hood' and not p['name'].startswith('cover-')],[T(0,0,z) for z in range(61)]))
  results.append(path('upper rain tray lifts off spider before deck spacers and gimbal are fitted',[by['enclosure-base']],[by['spider']],[T(0,0,z) for z in range(61)]))
  service_parts=assembly(45,0);service_by={p['name']:p for p in service_parts}
  results.append(path('pan fairing lowers at pan45 tilt0 after four bolts removed before incoming harness is routed',[service_by['pan-fairing']],[p for p in service_parts if p['name']!='pan-fairing' and not p['name'].startswith('fairing-')],[T(0,0,-z) for z in range(101)]))
  results.append(path('tilt servo boot withdraws20mm outward then lowers below fairing with bolts removed',[by['tilt-servo-boot']],[p for p in parts if p['name']!='tilt-servo-boot' and not p['name'].startswith('boot-')],[T(-x,0,0) for x in range(21)]+[T(-20,0,-z) for z in range(1,16)]+[T(-20-x,0,-15) for x in range(1,21)]))
  results.append(path('rear camera cowl lifts14mm then withdraws45mm toward -Y after rear nuts removed',[by['camera-cowl']],[p for p in parts if p['name']!='camera-cowl' and not p['name'].startswith('camera-cowl-nut-')],[T(0,0,z) for z in range(15)]+[T(0,-y,14) for y in range(1,46)]))
  for n in [p for p in parts if p['name'].startswith('fairing-nut-')]:
   results.append(path('fairing M2 nut loaded before deck installation '+n['name'],[n],[by['enclosure-base'],by['pan-fairing']],[T(0,0,z) for z in range(11)]))
  for i,y in enumerate([-32,32]):
   for x in [-72,65]:
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
 # Removable support goes upward; the pivot fastener/shim are not installed yet.
 results.append(path('opposite support fitted upward',[by['tilt-pivot-support']],[by['pan-yoke'],by['camera-cradle']],[T(0,0,-z) for z in np.arange(12,-.01,-.5)]))
 tools=[]
 def tool(name,d,l,mat,targets):
  tools.append({'name':name,'diameter_mm':d,'straight_tip_length_mm':l,'hits':hits(cylinder(d,l,mat),targets)})
 for y in [-10,10]:
  tool('pan retainer short driver before fairing installation',2,15,T(0,y,-25.99),[p for p in parts if p['name'] not in ['electronics-cover','rain-hood','enclosure-base','pan-fairing'] and not p['name'].startswith('pan-retainer-bolt')])
  tool('tilt retainer short driver before moving covers and fairing',2,15,T(-23.01,y,-59)@R('y',-90),[p for p in parts if not p['name'].startswith('tilt-retainer-bolt') and p['name'] not in ['tilt-servo-boot','camera-cowl','pan-fairing']])
 tool('pan OEM centre driver',2.5,15,T(0,0,-30.81)@R('x',180),[by['pan-yoke']])
 tool('tilt OEM centre driver before camera mounting',2.5,15,T(-18.19,0,-59)@R('y',90),[by['camera-cradle']])
 for x in [-10.5,10.5]:
  for y in [4.931,-7.569]:
   tool('camera front driver',2,15,T(x,y,-68.83)@R('x',180),[by['camera-hood'],by['camera'],by['camera-cradle']])
 if ENCLOSURE:
  for x in [-72,65]:
   for y in [-32,32]:
    tool('rain hood lower screw driver',3,18,T(x,y,9.69)@R('x',180),[by['enclosure-base'],by['deck'],by['rain-hood'],by['spider']])
  for y in [-10,10]:
   tool('servo boot outside short driver',2,15,T(-31.31,y,-35)@R('y',-90),[by['tilt-servo-boot'],by['pan-yoke'],by['tilt-servo']])
  for x,y in [(-40,0),(40,0),(0,-36),(0,36)]:
   tool('fairing lower short driver',2,15,T(x,y,-9.81)@R('x',180),[by['pan-fairing'],by['spider'],by['pan-mount']])
   tool('fairing M2 nut socket before deck installed',5.3,10,T(x,y,16.01),[by['enclosure-base'],by['pan-fairing']])
  for x in [-10.5,10.5]:
   for y in [4.931,-7.569]:
    tool('camera cowl M2 nut socket',5.3,10,T(x,y,-50.59),[by['camera-cowl'],by['camera-cradle'],by['tilt-horn-retainer'],by['tilt-pivot-support']])
 # Official Standard drawing gives 66 deg horizontal / 41 deg vertical.
 # 80 mm pyramid extends beyond the nearby bracket geometry; lens/board itself excluded.
 optics=[]
 origin=np.array([0,-7.469,-72.60]);depth=80.;xx=depth*math.tan(math.radians(33));yy=depth*math.tan(math.radians(20.5))
 vertices=[origin]+[origin+np.array([x,y,-depth]) for x in [-xx,xx] for y in [-yy,yy]]
 pyramid=trimesh.convex.convex_hull(np.array(vertices))
 for pan in ([-90,-45,0,45,90] if ENCLOSURE else [-90,0,90]):
  for tilt in [0,35,70]:
   m=pyramid.copy();m.apply_transform(R('z',pan)@T(0,0,-59)@R('x',tilt)@T(0,0,59))
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
  port_defs=[('48 V input lead',cylinder(6,17,T(-8,31,7)),[by['enclosure-base'],by['deck']],{'diameter_mm':6,'axis_mm':[-8,31],'z_mm':[7,24]}),
   ('fixed CSI downward passage',rectangular([16,.3,17],T(0,-28,15.5)),[by['enclosure-base'],by['deck']],{'section_mm':[16,.3],'axis_mm':[0,-28],'z_mm':[7,24]}),
   ('pan servo downward leads',rectangular([4,2,17],T(-22,-32,15.5)),[by['enclosure-base'],by['deck']],{'section_mm':[4,2],'axis_mm':[-22,-32],'z_mm':[7,24]}),
   ('tilt servo boot lead opening',rectangular([6,2,5],T(-36.5,0,-69)),[by['tilt-servo-boot']],{'section_mm':[6,2],'axis_mm':[-36.5,0],'z_mm':[-71.5,-66.5]}),
   ('camera CSI rear exit',rectangular([16,4,6],T(0,12.5,-61)),[by['camera-cowl']],{'section_mm':[16,4],'axis_mm':[0,12.5],'z_mm':[-64,-58]})]
  for label,mesh,targets,dimensions in port_defs:
   wiring.append({'name':label,'nominal_envelope':dimensions,'hits':hits(mesh,targets)})
 seating=[]
 if ENCLOSURE:
  cowl,_=solid(by['camera-cowl'])
  def ring_probe(x,y,z):
   return geom(cylinder(3.6,.05,T(x,y,z)))-geom(cylinder(2.4,.07,T(x,y,z-.01)))
  for i in range(4):
   _,lower_bounds=solid(by[f'camera-nut-{i}']);_,upper_bounds=solid(by[f'camera-cowl-nut-{i}'])
   x,y=np.array(by[f'camera-nut-{i}']['matrix'])[:2,3];lower=float(lower_bounds[1,2]);upper=float(upper_bounds[0,2])
   coupons={'above_lower_nut':ring_probe(x,y,lower+.001),'below_lower_nut':ring_probe(x,y,lower-.051),'below_upper_nut':ring_probe(x,y,upper-.051),'above_upper_nut':ring_probe(x,y,upper+.001)}
   volumes={name:float((shape^cowl).volume()) for name,shape in coupons.items()}
   expected=float(coupons['above_lower_nut'].volume())
   passed=volumes['above_lower_nut']>.99*expected and volumes['below_upper_nut']>.99*expected and volumes['below_lower_nut']<EPS_VOLUME and volumes['above_upper_nut']<EPS_VOLUME
   seating.append({'name':f'camera-cowl-clamp-{i}','existing_nut_top_z_mm':lower,'cowl_nut_bottom_z_mm':upper,'annular_seating_probe_volume_mm3':expected,'cowl_intersections_mm3':volumes,'passed':passed})
 route_report=None
 if ENCLOSURE:
  points=np.array([[-8,31,24],[-8,31,-14],[16,37,-14],[16,37,-42],[16,60,-42]],dtype=float)
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
  incorrect=hits(cylinder(6,94,T(-8,31,-70)),assembly(15,0))
  route_report={'diameter_mm':6,'centerline_mm':points.tolist(),'poses':pose_count,'pan_deg':[-90,90,5],'tilt_deg':[0,35,70],
    'file':entry['file'],'failures':failures,'incorrect_straight_route_control':{'expected_collision_detected':any(h['part']=='pan-yoke' for h in incorrect),'hits':incorrect},
    'limits':'Rigid swept tube around a nominal polyline; actual bend radius, flexible loops, shrinkage, sleeves, ties and lead construction require bench inspection.'}
 report={'configuration':CONFIG,'fixed_power_route':route_report,'cowl_clamp_seating':seating,'assembly_paths':results,'wiring_ports':wiring,'tool_access':tools,'view_check':{'horizontal_deg':66,'vertical_deg':41,'depth_mm':80,'poses':optics},
 'proud_head_regression_control':{'expected_collision_detected':bool(regression),'hits':regression},
 'limits':['Port checks cover only local openings; a straight downward power/CSI/servo route may hit the spider or gimbal. Route outboard before the sweep and inspect actual flex.',
           'Rigid nominal envelopes only; flexible leads, connectors and ribbon routing need a bench check.',
           'Short straight tool tips represent local access, not every handle, wrench or insertion trajectory.',
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
  for seat in seating:print('Cowl clamp seating',seat['name'],seat['passed'],flush=True)
  assert all(s['passed'] for s in seating),'Camera cowl axial clamp gap'
  print('Fixed power route',route_report['poses'],'poses',len(route_report['failures']),'failures',flush=True)
  for failure in route_report['failures'][:5]:print('ROUTE',failure,flush=True)
  assert not route_report['failures'],'Fixed power route blocked'
  assert route_report['incorrect_straight_route_control']['expected_collision_detected'],'Straight-wire regression control failed'
 assert regression,'Regression control did not detect a proud-head collision'
 print('Service, view and regression checks PASS',flush=True)
if __name__=='__main__':main()
