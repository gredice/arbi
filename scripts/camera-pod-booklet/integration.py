"""One assembly definition for render figures and mesh collision checks, in mm.
All transforms map exported bed-oriented STLs back into the spider assembly frame.
"""
from pathlib import Path
import json,math
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
BLUE=(.12,.14,.15);GRAY=(.66,.70,.73);GREEN=(.19,.48,.33);DARK=(.12,.14,.15);GOLD=(.78,.65,.30)
WHITE=(.94,.94,.92);BLACK=(.12,.14,.15)
CONFIG=json.loads((ROOT/'configuration.json').read_text()) if (ROOT/'configuration.json').exists() else {'variant':'bench'}
ENCLOSURE=CONFIG['variant']=='enclosure'
ARTIFACT='ARBI-camera-pod-enclosure' if ENCLOSURE else 'ARBI-camera-pod-bench'
# Explicit assembly coordinates shared by render and service fixtures.
ENCLOSURE_COVER_X=[-22,22]
ENCLOSURE_COVER_Y=[-46,46]
ENCLOSURE_POWER_PORT=[10,40]
ENCLOSURE_CSI_PORT=[0,-48]
ENCLOSURE_SERVO_PORT=[-40,-15]
ENCLOSURE_TILT_AXIS_Y=3
ENCLOSURE_TILT_AXIS_Z=-45
ENCLOSURE_DRIVE_SHIFT_X=2

def T(x=0,y=0,z=0):
 m=np.eye(4);m[:3,3]=[x,y,z];return m

def R(axis,deg):
 a=math.radians(deg);c,s=math.cos(a),math.sin(a);m=np.eye(4)
 if axis=='x':m[:3,:3]=[[1,0,0],[0,c,-s],[0,s,c]]
 if axis=='y':m[:3,:3]=[[c,0,s],[0,1,0],[-s,0,c]]
 if axis=='z':m[:3,:3]=[[c,-s,0],[s,c,0],[0,0,1]]
 return m

def assembly(pan=0,tilt=0,cover=True,hardware=True,enclosure=None):
 if enclosure is None:enclosure=ENCLOSURE
 manifest=json.loads((ROOT/'mesh-manifest.json').read_text());byid={e['model_id'] if 'model_id' in e else e['id']:e for e in manifest}
 parts=[]
 axis_y=ENCLOSURE_TILT_AXIS_Y if enclosure else 0
 axis_z=ENCLOSURE_TILT_AXIS_Z if enclosure else -59
 compact=T(0,axis_y,axis_z+59)
 P=R('z',pan);Q=P@T(0,axis_y,axis_z)@R('x',tilt)@T(0,-axis_y,-axis_z)
 def add(name,model,m=None,group='fixed',color=BLUE):
  e=byid[model];mat=np.eye(4) if m is None else m
  # Exporter stores its rigid source->STL transform; undo it before assembly.
  back=np.linalg.inv(np.array(e.get('export_matrix',T(*e.get('export_translation_mm',[0,0,0])))))
  parent={'fixed':np.eye(4),'pan':P,'tilt':Q}[group]
  parts.append({'name':name,'model':model,'file':e['file'],'matrix':(parent@mat@back).tolist(),'group':group,'color':BLACK if enclosure and model.startswith('camera-pod-') else color})
 add('spider','camera-pod-spider',color=BLACK if enclosure else BLUE)
 add('deck','camera-pod-integrated-deck' if enclosure else 'camera-pod-electronics-deck')
 u=22/math.sqrt(2)
 for i,(x,y) in enumerate([(x,y) for x in [-u,u] for y in [-u,u]]):add(f'spider-spacer-{i}','camera-pod-spider-spacer',T(x,y,3.5))
 add('pan-mount','camera-pod-pan-servo-mount')
 add('pan-yoke','camera-pod-integrated-gimbal-carrier' if enclosure else 'camera-pod-pan-yoke',group='pan')
 if enclosure:add('gimbal-head','camera-pod-integrated-gimbal-head',group='pan')
 add('tilt-pivot-support','camera-pod-integrated-tilt-pivot-support' if enclosure else 'camera-pod-tilt-pivot-support',group='pan')
 add('camera-cradle','camera-pod-integrated-camera-cradle' if enclosure else 'camera-pod-camera-cradle',group='tilt')
 add('camera-hood','camera-pod-integrated-camera-hood' if enclosure else 'camera-pod-camera-hood',compact@T(0,-5,-76.52),group='tilt')
 if enclosure:parts[-1]['color']=WHITE
 add('pan-horn-retainer','camera-pod-horn-retainer',T(0,0,-27.2),group='pan')
 H=T(-21.8+(ENCLOSURE_DRIVE_SHIFT_X if enclosure else 0),axis_y,axis_z)@R('y',-90)
 add('tilt-horn-retainer','camera-pod-horn-retainer',H,group='tilt')
 if enclosure:
  add('enclosure-base','camera-pod-enclosure-base')
  if cover:
   add('rain-hood','camera-pod-rain-hood',color=WHITE)
   parts[-1]['color']=WHITE
 elif cover:add('electronics-cover','camera-pod-electronics-cover',T(0,0,46)@R('x',180),color=(.94,.94,.92))
 add('pi','raspberry-pi-3a-plus-reference',T(-22 if enclosure else -37,0,30.5),color=GREEN)
 add('converter','buck-converter-UNVERIFIED',T(32,0,22.5)@R('z',90) if enclosure else T(40,0,22.5),color=GREEN)
 add('capacitor','capacitor-1000uf-UNVERIFIED',T(32,-34,23.5) if enclosure else T(48,26,23.5),color=DARK)
 add('pan-servo','micro-servo-3p7g-UNVERIFIED',T(-5,0,-7)@R('x',180),color=DARK)
 add('tilt-servo','micro-servo-3p7g-UNVERIFIED',T(-42+ENCLOSURE_DRIVE_SHIFT_X,axis_y-5,axis_z)@R('x',90)@R('y',90) if enclosure else T(-42,0,-54)@R('y',90),group='pan',color=DARK)
 add('pan-horn','servo-horn-UNVERIFIED',T(0,0,-29.4),group='pan',color=GRAY)
 add('tilt-horn','servo-horn-UNVERIFIED',H@T(0,0,-2.2),group='tilt',color=GRAY)
 add('camera','camera-module-3-standard-reference',compact@T(0,-5,-64)@R('x',180),group='tilt',color=GREEN)
 if not hardware:return parts
 add('converter-tie-0','converter-tie-reference',T(32,8,0)@R('z',90) if enclosure else T(28,0,0),color=DARK)
 add('converter-tie-1','converter-tie-reference',T(32,22,0)@R('z',90) if enclosure else T(62,0,0),color=DARK)
 add('capacitor-tie','capacitor-tie-reference',T(32,-34,0) if enclosure else T(48,26,0),color=DARK)
 add('pan-horn-center-screw','bolt-OEM-horn-UNVERIFIED',T(0,0,-29.4),group='pan',color=GRAY)
 add('tilt-horn-center-screw','bolt-OEM-horn-UNVERIFIED',H@T(0,0,-2.2),group='tilt',color=GRAY)
 def hw(n,model,mat,group='fixed'):add(n,model,mat,group,GRAY)
 # Screw reference shank +Z, head below Z=0. Washer reference +Z.
 for i,(x,y) in enumerate([(x,y) for x in [-u,u] for y in [-u,u]]):
  hw(f'frame-bolt-{i}','bolt-M4x35-reference',T(x,y,-7.3)@(R('z',30) if enclosure else np.eye(4)))
  hw(f'frame-lower-washer-{i}','washer-M4-reference',T(x,y,-7.3)@(R('z',30) if enclosure else np.eye(4)))
  hw(f'frame-upper-washer-{i}','washer-M4-reference',T(x,y,20.5))
  # Align hex flats toward the compact converter; preserve the bench orientation.
  hw(f'frame-nut-{i}','nut-M4-reference',T(x,y,21.3)@R('z',30 if enclosure else 0))
 for i,(x,y) in enumerate([(x,y) for x in ([-51,7] if enclosure else [-66,-8]) for y in [-24.5,24.5]]):
  # 20 mm screws: board1.6 + washer.5 + post10 + deck3 + washer.5 + nut2 =17.6.
  hw(f'pi-bolt-{i}','bolt-M2p5x20-reference',T(x,y,32.6)@R('x',180))
  hw(f'pi-top-washer-{i}','washer-M2p5-reference',T(x,y,32.1))
  hw(f'pi-bottom-washer-{i}','washer-M2p5-reference',T(x,y,17))
  hw(f'pi-nut-{i}','nut-M2p5-reference',T(x,y,15))
 for i,x in enumerate([-17,7]):
  hw(f'pan-servo-bolt-{i}','csk-M1p6x6-reference',T(x,0,-25))
  hw(f'pan-servo-nut-{i}','nut-M1p6-reference',T(x,0,-20.5))
 for i,z in enumerate([-66,-42]):
  ear_y=axis_y-(z+59)
  hw(f'tilt-servo-bolt-{i}','csk-M1p6x6-reference',T(-24+ENCLOSURE_DRIVE_SHIFT_X,ear_y,axis_z)@R('x',90)@R('y',-90) if enclosure else T(-24,0,z)@R('y',-90),'pan')
  hw(f'tilt-servo-nut-{i}','nut-M1p6-reference',T(-28.5+ENCLOSURE_DRIVE_SHIFT_X,ear_y,axis_z)@R('x',90)@R('y',-90) if enclosure else T(-28.5,0,z)@R('y',-90),'pan')
 for i,y in enumerate([-10,10]):
  hw(f'pan-retainer-bolt-{i}','csk-M2x10-reference',T(0,y,-26)@R('x',180),'pan')
  hw(f'pan-retainer-bottom-washer-{i}','washer-M2-reference',T(0,y,-32),'pan')
  hw(f'pan-retainer-nut-{i}','nut-M2-reference',T(0,y,-33.6),'pan')
  hw(f'tilt-retainer-bolt-{i}','csk-M2x8-reference',H@T(0,y,1.2)@R('x',180),'tilt')
  hw(f'tilt-retainer-bottom-washer-{i}','washer-M2-reference',H@T(0,y,-4.3),'tilt')
  hw(f'tilt-retainer-nut-{i}','nut-M2-reference',H@T(0,y,-5.9),'tilt')
 for i,(x,y) in enumerate([(x,y) for x in [-10.5,10.5] for y in [4.931,-7.569]]):
  hw(f'camera-bolt-{i}','bolt-M2x12-reference',compact@T(x,y,-66.82), 'tilt')
  hw(f'camera-front-washer-{i}','washer-M2-reference',compact@T(x,y,-66.82),'tilt')
  hw(f'camera-back-washer-{i}','washer-M2-reference',compact@T(x,y,-57.5),'tilt')
  hw(f'camera-nut-{i}','nut-M2-reference',compact@T(x,y,-57.2),'tilt')
 for i,y in enumerate([-7,7]):
  hw(f'pivot-support-bolt-{i}','bolt-M2x12-reference',T(23,y,-26.9)@R('x',180),'pan')
  hw(f'pivot-support-top-washer-{i}','washer-M2-reference',T(23,y,-27.2),'pan')
  hw(f'pivot-support-bottom-washer-{i}','washer-M2-reference',T(23,y,-35),'pan')
  hw(f'pivot-support-nut-{i}','nut-M2-reference',T(23,y,-36.6),'pan')
 hw('pivot-bolt','bolt-M3x12-reference',compact@T(25.5,0,-59)@R('y',-90),'tilt')
 hw('pivot-outer-washer','washer-M3-reference',compact@T(25,0,-59)@R('y',90),'pan')
 hw('pivot-gap-shim','washer-M3x0p7-reference',compact@T(21.3,0,-59)@R('y',90),'pan')
 hw('pivot-nut','nut-M3-reference',compact@T(15.6,0,-59)@R('y',90),'tilt')
 if enclosure:
  for i,(x,y) in enumerate([(x,y) for x in [-8,8] for y in [-30.5,30.5]]):
   hw(f'head-bolt-{i}','bolt-M2x10-reference',T(x,y,-28.9)@R('x',180),'pan')
   hw(f'head-upper-washer-{i}','washer-M2-reference',T(x,y,-29.2),'pan')
   hw(f'head-lower-washer-{i}','washer-M2-reference',T(x,y,-35),'pan')
   hw(f'head-nut-{i}','nut-M2-reference',T(x,y,-36.6),'pan')
 if cover:
  for i,(x,y) in enumerate([(x,y) for x in (ENCLOSURE_COVER_X if enclosure else [-72,65]) for y in (ENCLOSURE_COVER_Y if enclosure else [-32,32])]):
   if enclosure:
    hw(f'cover-bolt-{i}','bolt-M3x35-reference',T(x,y,12.7))
    hw(f'cover-bottom-washer-{i}','washer-M3-reference',T(x,y,12.7))
    hw(f'cover-nut-{i}','nut-M3-reference',T(x,y,44))
   else:
    hw(f'cover-bolt-{i}','bolt-M3x35-reference',T(x,y,46.5)@R('x',180))
    hw(f'cover-top-washer-{i}','washer-M3-reference',T(x,y,46))
    hw(f'cover-bottom-washer-{i}','washer-M3-reference',T(x,y,17))
    hw(f'cover-nut-{i}','nut-M3-reference',T(x,y,14.6))
 return parts
