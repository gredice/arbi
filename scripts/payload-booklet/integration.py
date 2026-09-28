"""One assembly definition for render figures and mesh collision checks, in mm.
All transforms map exported bed-oriented STLs back into the spider assembly frame.
"""
from pathlib import Path
import json,math
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
BLUE=(.26,.60,.80);GRAY=(.72,.76,.80);GREEN=(.19,.48,.33);DARK=(.22,.26,.31);GOLD=(.78,.65,.30)

def T(x=0,y=0,z=0):
 m=np.eye(4);m[:3,3]=[x,y,z];return m

def R(axis,deg):
 a=math.radians(deg);c,s=math.cos(a),math.sin(a);m=np.eye(4)
 if axis=='x':m[:3,:3]=[[1,0,0],[0,c,-s],[0,s,c]]
 if axis=='y':m[:3,:3]=[[c,0,s],[0,1,0],[-s,0,c]]
 if axis=='z':m[:3,:3]=[[c,-s,0],[s,c,0],[0,0,1]]
 return m

def assembly(pan=0,tilt=0,cover=True,hardware=True):
 manifest=json.loads((ROOT/'mesh-manifest.json').read_text());byid={e['model_id'] if 'model_id' in e else e['id']:e for e in manifest}
 parts=[]
 P=R('z',pan);Q=P@T(0,0,-59)@R('x',tilt)@T(0,0,59)
 def add(name,model,m=None,group='fixed',color=BLUE):
  e=byid[model];mat=np.eye(4) if m is None else m
  # Exporter stores its rigid source->STL transform; undo it before assembly.
  back=np.linalg.inv(np.array(e.get('export_matrix',T(*e.get('export_translation_mm',[0,0,0])))))
  parent={'fixed':np.eye(4),'pan':P,'tilt':Q}[group]
  parts.append({'name':name,'model':model,'file':e['file'],'matrix':(parent@mat@back).tolist(),'group':group,'color':color})
 add('spider','camera-pod-spider')
 add('deck','payload-electronics-deck')
 u=22/math.sqrt(2)
 for i,(x,y) in enumerate([(x,y) for x in [-u,u] for y in [-u,u]]):add(f'spider-spacer-{i}','payload-spider-spacer',T(x,y,3.5))
 add('pan-mount','payload-pan-servo-mount')
 add('pan-yoke','payload-pan-yoke',group='pan')
 add('tilt-pivot-support','payload-tilt-pivot-support',group='pan')
 add('camera-cradle','payload-camera-cradle',group='tilt')
 add('camera-hood','payload-camera-hood',T(0,-5,-76.52),group='tilt')
 add('pan-horn-retainer','payload-horn-retainer',T(0,0,-27.2),group='pan')
 H=T(-21.8,0,-59)@R('y',-90)
 add('tilt-horn-retainer','payload-horn-retainer',H,group='tilt')
 if cover:add('electronics-cover','payload-electronics-cover',T(0,0,46)@R('x',180))
 add('pi','raspberry-pi-3a-plus-reference',T(-37,0,30.5),color=GREEN)
 add('converter','buck-converter-UNVERIFIED',T(40,0,22.5),color=GREEN)
 add('capacitor','capacitor-1000uf-UNVERIFIED',T(48,26,23.5),color=DARK)
 add('pan-servo','micro-servo-3p7g-UNVERIFIED',T(-5,0,-7)@R('x',180),color=DARK)
 add('tilt-servo','micro-servo-3p7g-UNVERIFIED',T(-42,0,-54)@R('y',90),group='pan',color=DARK)
 add('pan-horn','servo-horn-UNVERIFIED',T(0,0,-29.4),group='pan',color=GRAY)
 add('tilt-horn','servo-horn-UNVERIFIED',H@T(0,0,-2.2),group='tilt',color=GRAY)
 add('camera','camera-module-3-standard-reference',T(0,-5,-64)@R('x',180),group='tilt',color=GREEN)
 if not hardware:return parts
 add('converter-tie-0','converter-tie-reference',T(28,0,0),color=DARK)
 add('converter-tie-1','converter-tie-reference',T(62,0,0),color=DARK)
 add('capacitor-tie','capacitor-tie-reference',T(48,26,0),color=DARK)
 add('pan-horn-center-screw','bolt-OEM-horn-UNVERIFIED',T(0,0,-29.4),group='pan',color=GRAY)
 add('tilt-horn-center-screw','bolt-OEM-horn-UNVERIFIED',H@T(0,0,-2.2),group='tilt',color=GRAY)
 def hw(n,model,mat,group='fixed'):add(n,model,mat,group,GRAY)
 # Screw reference shank +Z, head below Z=0. Washer reference +Z.
 for i,(x,y) in enumerate([(x,y) for x in [-u,u] for y in [-u,u]]):
  hw(f'frame-bolt-{i}','bolt-M4x35-reference',T(x,y,-7.3))
  hw(f'frame-lower-washer-{i}','washer-M4-reference',T(x,y,-7.3))
  hw(f'frame-upper-washer-{i}','washer-M4-reference',T(x,y,20.5))
  hw(f'frame-nut-{i}','nut-M4-reference',T(x,y,21.3))
 for i,(x,y) in enumerate([(x,y) for x in [-66,-8] for y in [-24.5,24.5]]):
  # 20 mm screws: board1.6 + washer.5 + post10 + deck3 + washer.5 + nut2 =17.6.
  hw(f'pi-bolt-{i}','bolt-M2p5x20-reference',T(x,y,32.6)@R('x',180))
  hw(f'pi-top-washer-{i}','washer-M2p5-reference',T(x,y,32.1))
  hw(f'pi-bottom-washer-{i}','washer-M2p5-reference',T(x,y,17))
  hw(f'pi-nut-{i}','nut-M2p5-reference',T(x,y,15))
 for i,x in enumerate([-17,7]):
  hw(f'pan-servo-bolt-{i}','csk-M1p6x6-reference',T(x,0,-25))
  hw(f'pan-servo-nut-{i}','nut-M1p6-reference',T(x,0,-20.5))
 for i,z in enumerate([-66,-42]):
  hw(f'tilt-servo-bolt-{i}','csk-M1p6x6-reference',T(-24,0,z)@R('y',-90),'pan')
  hw(f'tilt-servo-nut-{i}','nut-M1p6-reference',T(-28.5,0,z)@R('y',-90),'pan')
 for i,y in enumerate([-10,10]):
  hw(f'pan-retainer-bolt-{i}','csk-M2x10-reference',T(0,y,-26)@R('x',180),'pan')
  hw(f'pan-retainer-bottom-washer-{i}','washer-M2-reference',T(0,y,-32),'pan')
  hw(f'pan-retainer-nut-{i}','nut-M2-reference',T(0,y,-33.6),'pan')
  hw(f'tilt-retainer-bolt-{i}','csk-M2x8-reference',H@T(0,y,1.2)@R('x',180),'tilt')
  hw(f'tilt-retainer-bottom-washer-{i}','washer-M2-reference',H@T(0,y,-4.3),'tilt')
  hw(f'tilt-retainer-nut-{i}','nut-M2-reference',H@T(0,y,-5.9),'tilt')
 for i,(x,y) in enumerate([(x,y) for x in [-10.5,10.5] for y in [4.931,-7.569]]):
  hw(f'camera-bolt-{i}','bolt-M2x12-reference',T(x,y,-66.82), 'tilt')
  hw(f'camera-front-washer-{i}','washer-M2-reference',T(x,y,-66.82),'tilt')
  hw(f'camera-back-washer-{i}','washer-M2-reference',T(x,y,-57.5),'tilt')
  hw(f'camera-nut-{i}','nut-M2-reference',T(x,y,-57.2),'tilt')
 for i,y in enumerate([-7,7]):
  hw(f'pivot-support-bolt-{i}','bolt-M2x12-reference',T(23,y,-26.9)@R('x',180),'pan')
  hw(f'pivot-support-top-washer-{i}','washer-M2-reference',T(23,y,-27.2),'pan')
  hw(f'pivot-support-bottom-washer-{i}','washer-M2-reference',T(23,y,-35),'pan')
  hw(f'pivot-support-nut-{i}','nut-M2-reference',T(23,y,-36.6),'pan')
 hw('pivot-bolt','bolt-M3x12-reference',T(25.5,0,-59)@R('y',-90),'tilt')
 hw('pivot-outer-washer','washer-M3-reference',T(25,0,-59)@R('y',90),'pan')
 hw('pivot-gap-shim','washer-M3x0p7-reference',T(21.3,0,-59)@R('y',90),'pan')
 hw('pivot-nut','nut-M3-reference',T(15.6,0,-59)@R('y',90),'tilt')
 if cover:
  for i,(x,y) in enumerate([(x,y) for x in [-72,65] for y in [-32,32]]):
   hw(f'cover-bolt-{i}','bolt-M3x35-reference',T(x,y,46.5)@R('x',180))
   hw(f'cover-top-washer-{i}','washer-M3-reference',T(x,y,46))
   hw(f'cover-bottom-washer-{i}','washer-M3-reference',T(x,y,17))
   hw(f'cover-nut-{i}','nut-M3-reference',T(x,y,14.6))
 return parts
