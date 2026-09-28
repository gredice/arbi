"""Render the actual payload mount STLs and the exact checked assembly transforms."""
import json,copy
from collections import Counter
import numpy as np
import vtk
import mesh_renderer as v
from mesh_renderer import render
from integration import assembly,T,R,ROOT,BLUE,GRAY,DARK,GREEN

def tint(name,kind):
 pd=v.polydata('models/reference/'+name+'.stl');colors=vtk.vtkUnsignedCharArray();colors.SetNumberOfComponents(3);colors.SetName('part_colors')
 for i in range(pd.GetNumberOfCells()):
  cell=pd.GetCell(i);x,y,z=np.mean([pd.GetPoint(cell.GetPointId(j)) for j in range(cell.GetNumberOfPoints())],axis=0);rgb=(45,125,82)
  if kind=='pi':
   x+=32.5;y+=28
   if z<0 or z>1.62:rgb=(168,177,181)
   if z>1.62 and 23<=x<=37 and 24<=y<=38:rgb=(53,60,67)
   if z>1.62 and y>=49:rgb=(48,53,57) if z<4.21 else (183,149,70)
   if z>1.62 and 42<=x<=45 and 4<=y<=25:rgb=(218,221,215)
  elif kind=='camera':
   if z<0:rgb=(196,198,181)
   elif z>5.56:rgb=(68,91,113)
   elif z>1.13:rgb=(45,50,57)
  elif kind=='buck' and z>1.62:rgb=(61,72,80)
  colors.InsertNextTuple3(*rgb)
 pd.GetCellData().SetScalars(colors)

def shift(parts,fn):
 out=copy.deepcopy(parts)
 for p in out:p['matrix']=(fn(p)@np.array(p['matrix'])).tolist()
 return out

def main():
 for name,kind in [('raspberry-pi-3a-plus-reference','pi'),('camera-module-3-standard-reference','camera'),('buck-converter-UNVERIFIED','buck')]:tint(name,kind)
 allparts=assembly();openparts=assembly(cover=False)
 render('assembled-open',openparts,direction=(.55,-1,.55),size=(1600,1350))
 render('assembled-covered',allparts,direction=(.7,-1,.48),size=(1400,1250))
 manifest=json.loads((ROOT/'mesh-manifest.json').read_text())
 for e in manifest:
  if e['file'].startswith('models/printable/'):
   render('part-'+e['model_id'],[{'file':e['file'],'matrix':np.eye(4).tolist(),'color':BLUE}],direction=(.45,-1,.85),size=(800,580))
 # Exact retained groups, with displacements only for exploded illustrations.
 fixed=[p for p in openparts if p['group']=='fixed' and p['name'] not in ['pan-servo','pi','converter','capacitor'] and not any(p['name'].startswith(q) for q in ['pi-','pan-servo-','converter-','capacitor-'])]
 def frame_ex(p):
  n=p['name']
  if n=='deck' or n.startswith('frame-upper') or n.startswith('frame-nut'):return T(0,0,25)
  if n.startswith('spider-spacer'):return T(0,0,8)
  if n=='pan-mount' or n.startswith('frame-bolt') or n.startswith('frame-lower'):return T(0,0,-18)
  return T()
 render('frame-exploded',shift(fixed,frame_ex),direction=(.3,-1,.6),size=(1550,1200))
 deckparts=[p for p in allparts if p['name']=='deck' or p['name'] in ['pi','converter','capacitor'] or any(p['name'].startswith(q) for q in ['pi-','converter-','capacitor-'])]
 render('deck-loaded',deckparts,direction=(.25,-1,1.1),size=(1500,1000))
 render('deck-top',deckparts,direction=(0,0,1),up=(0,1,0),size=(1500,950))
 pan=[p for p in openparts if p['name'] in ['pan-mount','pan-servo'] or p['name'].startswith('pan-servo-')]
 render('pan-servo-insertion',shift(pan,lambda p:T() if p['name']=='pan-mount' else T(0,0,-8 if 'bolt' in p['name'] else 36)),direction=(.65,-1,.4),size=(1100,1150))
 horn=[p for p in openparts if p['name'] in ['pan-yoke','pan-horn','pan-horn-retainer','pan-horn-center-screw'] or p['name'].startswith('pan-retainer-')]
 def horn_ex(p):
  if p['name']=='pan-yoke':return T()
  if p['name']=='pan-horn':return T(0,0,7)
  if p['name']=='pan-horn-center-screw':return T(0,0,-10)
  if p['name']=='pan-horn-retainer':return T(0,0,15)
  if 'bottom-washer' in p['name'] or 'nut' in p['name']:return T(0,0,-7)
  return T(0,0,20)
 render('pan-horn-exploded',shift(horn,horn_ex),direction=(.5,-1,.55),size=(1250,1150))
 tilt=[p for p in openparts if p['name']=='pan-yoke' or p['name'].startswith('tilt-servo')]
 render('tilt-servo-insertion',shift(tilt,lambda p:T() if p['name']=='pan-yoke' else T(10 if 'bolt' in p['name'] else -20)),direction=(-1,-.7,.4),size=(1400,1000))
 camera=[p for p in openparts if p['group']=='tilt' and p['name']!='tilt-horn-center-screw' and not p['name'].startswith('tilt-retainer') and p['name'] not in ['tilt-horn','tilt-horn-retainer','pivot-nut'] and not p['name'].startswith('pivot-')]
 def cam_ex(p):
  n=p['name']
  if n=='camera':return T(0,0,-12)
  if n=='camera-hood':return T(0,0,-26)
  if 'bolt' in n or 'front-washer' in n:return T(0,0,-32)
  if 'nut' in n or 'back-washer' in n:return T(0,0,7)
  return T()
 render('camera-exploded',shift(camera,cam_ex),direction=(.8,-1,-.12),size=(1300,1150))
 gimbal=[p for p in openparts if p['group']!='fixed' or p['name'] in ['pan-mount','pan-servo'] or p['name'].startswith('pan-servo-')]
 render('gimbal-front',gimbal,direction=(.8,-1,.03),size=(1400,1250))
 render('gimbal-bottom',gimbal,direction=(-.4,-1,-.6),size=(1400,1000))
 pivot=[p for p in openparts if p['name'] in ['pan-yoke','tilt-pivot-support','camera-cradle','pivot-bolt','pivot-outer-washer','pivot-gap-shim','pivot-nut'] or p['name'].startswith('pivot-support-')]
 def pivot_ex(p):
  n=p['name']
  if n=='camera-cradle':return T()
  if n=='tilt-pivot-support' or n.startswith('pivot-support-'):return T(14,0,-10)
  if n in ['pivot-bolt','pivot-outer-washer']:return T(16)
  if n=='pivot-nut':return T(0,0,10)
  return T()
 render('pivot-exploded',shift(pivot,pivot_ex),direction=(1,-.7,.25),size=(1400,950))
 for n,panang,tiltang in [('motion-left',-90,70),('motion-down',0,0),('motion-right',90,70)]:
  parts=[p for p in assembly(panang,tiltang,cover=False) if p['group']!='fixed' or p['name'] in ['pan-mount','pan-servo']]
  render(n,parts,direction=(.6,-1,.05),size=(1000,1000))
 cover=[p for p in allparts if p['name']=='electronics-cover' or p['name'].startswith('cover-')]
 render('cover-fit',openparts+shift(cover,lambda p:T(0,0,25)),direction=(.5,-1,.55),size=(1500,1300))
 (ROOT/'figure-manifest.json').write_text(json.dumps(v.manifest,indent=2)+'\n')
 (ROOT/'assembly-manifest.json').write_text(json.dumps({'configuration':'pan=0, tilt=0, cover fitted','parts':allparts},indent=2)+'\n')
 # Portable colored scene for inspecting the actual checked mesh assembly.
 import trimesh
 scene=trimesh.Scene()
 for p in allparts:
  m=trimesh.load_mesh(ROOT/p['file']);m.visual.face_colors=[int(v*255) for v in p['color']]+[255]
  scene.add_geometry(m,node_name=p['name'],transform=np.array(p['matrix']))
 scene.apply_transform(np.diag([.001,.001,.001,1]))
 (ROOT/'ARBI-payload-assembled.glb').write_bytes(scene.export(file_type='glb'))
if __name__=='__main__':main()
