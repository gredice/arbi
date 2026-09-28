"""Assembly-path, driver-access, optical-envelope and regression checks for nominal CAD."""
import json,math
import numpy as np
import trimesh
import manifold3d as mf
from integration import assembly,T,R,ROOT
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
  tool('pan retainer short driver',2,15,T(0,y,-25.99),[p for p in parts if p['name'] not in ['electronics-cover'] and not p['name'].startswith('pan-retainer-bolt')])
  tool('tilt retainer short driver',2,15,T(-23.01,y,-59)@R('y',-90),[p for p in parts if not p['name'].startswith('tilt-retainer-bolt')])
 tool('pan OEM centre driver',2.5,15,T(0,0,-30.81)@R('x',180),[by['pan-yoke']])
 tool('tilt OEM centre driver before camera mounting',2.5,15,T(-18.19,0,-59)@R('y',90),[by['camera-cradle']])
 for x in [-10.5,10.5]:
  for y in [4.931,-7.569]:
   tool('camera front driver',2,15,T(x,y,-68.83)@R('x',180),[by['camera-hood'],by['camera'],by['camera-cradle']])
 # Official Standard drawing gives 66 deg horizontal / 41 deg vertical.
 # 80 mm pyramid extends beyond the nearby bracket geometry; lens/board itself excluded.
 optics=[]
 origin=np.array([0,-7.469,-72.60]);depth=80.;xx=depth*math.tan(math.radians(33));yy=depth*math.tan(math.radians(20.5))
 vertices=[origin]+[origin+np.array([x,y,-depth]) for x in [-xx,xx] for y in [-yy,yy]]
 pyramid=trimesh.convex.convex_hull(np.array(vertices))
 for pan in [-90,0,90]:
  for tilt in [0,35,70]:
   m=pyramid.copy();m.apply_transform(R('z',pan)@T(0,0,-59)@R('x',tilt)@T(0,0,59))
   targets=[p for p in assembly(pan,tilt) if p['name']!='camera']
   optics.append({'pan':pan,'tilt':tilt,'hits':hits(m,targets)})
 # Deliberately add a proud head at a rotating retainer. This must fail at pan=90.
 pose={p['name']:p for p in assembly(90,0)}
 bolt=pose['pan-retainer-bolt-0'];head=cylinder(3.6,2,np.array(bolt['matrix'])@R('x',180))
 regression=hits(head,[pose['pan-servo'],pose['pan-mount']])
 report={'assembly_paths':results,'tool_access':tools,'view_check':{'horizontal_deg':66,'vertical_deg':41,'depth_mm':80,'poses':optics},
 'proud_head_regression_control':{'expected_collision_detected':bool(regression),'hits':regression},
 'limits':['Rigid nominal envelopes only; flexible leads, connectors and ribbon routing need a bench check.',
           'Short straight tool tips represent local access, not every handle, wrench or insertion trajectory.',
           'The servo spline and OEM threaded centre screw are intended engagement exclusions.']}
 (ROOT/'service-check.json').write_text(json.dumps(report,indent=2)+'\n')
 for r in results:print(r['name'],len(r['failures']),flush=True)
 for t in tools:
  if t['hits']:print('TOOL',t,flush=True)
 for o in optics:
  if o['hits']:print('OPTIC',o,flush=True)
 assert not any(r['failures'] for r in results),'Assembly path blocked'
 assert not any(t['hits'] for t in tools),'Driver access blocked'
 assert not any(o['hits'] for o in optics),'Optical view obstructed'
 assert regression,'Regression control did not detect a proud-head collision'
 print('Service, view and regression checks PASS',flush=True)
if __name__=='__main__':main()
