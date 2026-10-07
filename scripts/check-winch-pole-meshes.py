"""Nominal round-timber, full enclosure and loom checks; no load qualification.

Pass the booklet's models/arbi directory. Its sibling models/reference must
contain the covered aluminium bases and continuous nominal bottom looms.
"""
from pathlib import Path
import argparse, hashlib, json, math, subprocess, tempfile
import numpy as np
import trimesh

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('exports',type=Path)
parser.add_argument('--record',type=Path)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
hardware=root/'hardware'
if not hardware.exists():hardware=root/'source/arbi-hardware'
registry=json.loads((hardware/'models.json').read_text())
models={m['id']:m for m in registry['models']}
checks=0
hashes={}

def load(path):
    m=trimesh.load_mesh(path)
    assert m.is_watertight and m.is_winding_consistent and m.body_count==1 and m.volume>0,path
    hashes[str(path.name)]=hashlib.sha256(path.read_bytes()).hexdigest()
    return m
def move(m,xyz):
    m=m.copy();m.apply_translation(xyz);return m
def overlap(a,b):
    if np.any(np.minimum(a.bounds[1],b.bounds[1])-np.maximum(a.bounds[0],b.bounds[0])<=1e-5):return 0
    m=trimesh.boolean.intersection([a,b],engine='manifold')
    return abs(m.volume) if not m.is_empty else 0
def clear(a,b,label):
    global checks
    checks+=1;v=overlap(a,b);assert v<.001,(label,v)
def cylinder(r,h,center,axis='z',sections=128):
    m=trimesh.creation.cylinder(radius=r,height=h,sections=sections)
    if axis=='y':m.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,[1,0,0]))
    return move(m,center)
def visible_blocked(skin,origin,target):
    direction=np.asarray(target)-np.asarray(origin);t=skin.triangles
    e1=t[:,1]-t[:,0];e2=t[:,2]-t[:,0];h=np.cross(direction,e2)
    det=np.einsum('ij,ij->i',e1,h);valid=abs(det)>1e-9;inv=np.zeros(len(det));inv[valid]=1/det[valid]
    s=np.asarray(origin)-t[:,0];u=inv*np.einsum('ij,ij->i',s,h);q=np.cross(s,e1);v=inv*(q@direction);dist=inv*np.einsum('ij,ij->i',e2,q)
    return bool(np.any(valid&(u>=0)&(v>=0)&(u+v<=1)&(dist>1e-7)&(dist<1-1e-7)))

cover_assemblies={};loom_assemblies={}
for variant,width,count,base_length in [('passive',246.9,3,550),('powered',570.3,5,880)]:
    pitch=(base_length-8)/count;outer=[]
    for i in range(count):
        x=-46+i*pitch
        name=('left' if i==0 else 'right' if i==count-1 else
              'transition' if variant=='powered' and i==3 else
              'pole-middle' if variant=='powered' and i==1 else 'middle')
        panel=load(args.exports/models[f'winch-cover-{variant}-{name}']['output'])
        panel.apply_transform([[0,0,1,x-(8 if i==0 else 0)],[1,0,0,-100],[0,1,0,-32],[0,0,0,1]])
        outer.append(panel)
        if i<count-1:
            shutter=load(args.exports/models[f'winch-cover-{variant}-shutter']['output'])
            shutter.apply_transform([[1,0,0,x],[0,0,-1,84],[0,1,0,14],[0,0,0,1]])
            outer.append(shutter)
        for sy in [-1,1]:
            fascia_id=f'winch-cover-{variant}-'+('pole-fascia' if sy==-1 and i==(1 if variant=='powered' else 0) else 'fascia')
            fascia=load(args.exports/models[fascia_id]['output'])
            fascia.apply_transform([[1,0,0,x],[0,0,-sy,sy*98],[0,1,0,-32],[0,0,0,1]])
            outer.append(fascia)
    for left,number in [(True,2 if variant=='powered' else 1),(False,3 if variant=='powered' else 2)]:
        start=-50 if left else width/2+51;stop=width/2-51 if left else base_length-50
        for i in range(number):
            shield=load(args.exports/models[f'winch-cover-{variant}-rear-'+('left' if left else 'right')]['output'])
            outer.append(move(shield,[start+i*(stop-start)/number,-93.2,-27.6]))
    # Actual covered aluminium plate and continuous nominal loom meshes.
    references=args.exports.parent/'reference'
    outer.append(load(references/f'base-plate-{variant}-covered.stl'))
    cover_assemblies[variant]=(width,outer)
    loom_assemblies[variant]=[load(references/f'loom-{variant}-bottom-{i}.stl') for i in [0,1]]

results={}
with tempfile.TemporaryDirectory() as temp:
    for diameter in [100,120,140]:
        parts={}
        for role in ['front-saddle','rear-saddle','nut-cover','nut-cover-bottom','cable-guide']:
            ident='winch-pole-'+role;entry=models[ident]
            if diameter==120:path=args.exports/entry['output']
            else:
                path=Path(temp)/(ident+f'-d{diameter}.stl')
                src=hardware/entry['entrypoint'].removeprefix('hardware/')
                result=subprocess.run(['openscad','-D',f'pole_diameter={diameter}','-o',str(path),str(src)],capture_output=True,text=True,timeout=120)
                assert result.returncode==0 and 'ERROR:' not in result.stderr and 'WARNING:' not in result.stderr,result.stderr
            parts[role]=load(path)
        back=-33-diameter-8
        cap=move(parts['nut-cover'],[-48,-18,back-34])
        closure=move(parts['nut-cover-bottom'],[-44,-20,back-32])
        guide=move(parts['cable-guide'],[-25,-8,-34])
        if diameter==120:
            tie_path=args.exports.parent/'reference/pole-guide-tie-120.stl'
        else:
            tie_path=Path(temp)/f'pole-guide-tie-d{diameter}.stl'
            tie_source=Path(temp)/f'tie-d{diameter}.scad'
            tie_source.write_text(f'include <{hardware}/lib/winch-pole.scad>\nwp_guide_tie({diameter});\n')
            result=subprocess.run(['openscad','-o',str(tie_path),str(tie_source)],capture_output=True,text=True,timeout=120)
            assert result.returncode==0 and 'ERROR:' not in result.stderr and 'WARNING:' not in result.stderr,result.stderr
        tie=load(tie_path)
        pole=cylinder(diameter/2,600,[0,0,-33-diameter/2],'y')
        # Matching cylindrical seats intentionally contact timber. ASCII STL
        # rounding can create micron-scale slivers; test penetration beyond
        # 0.001 mm only at this intended contact surface.
        pole_interior=cylinder(diameter/2-.001,600,[0,0,-33-diameter/2],'y')
        front,rear=parts['front-saddle'],parts['rear-saddle']
        for y in [-3,3]:
            clear(move(tie,[0,y,0]),guide,(diameter,'soft tie/guide slot'))
            clear(move(tie,[0,y,0]),pole,(diameter,'soft tie/timber'))
        clear(move(tie,[0,-3,0]),move(tie,[0,3,0]),(diameter,'two soft ties'))
        for name,m in [('front',front),('rear',rear),('cap',cap),('closure',closure),('guide',guide)]:clear(m,pole_interior,(diameter,name,'timber'))
        clear(cap,rear,(diameter,'cap/rails'))
        clear(closure,cap,(diameter,'underside closure/cap'))
        clear(closure,rear,(diameter,'underside closure/saddle'))
        for dy in range(0,41,2):
            clear(move(closure,[0,-dy,0]),cap,(diameter,'closure withdrawal',dy))
            clear(move(closure,[0,-dy,0]),rear,(diameter,'closure withdrawal/saddle',dy))
        # A direct rearward pull must hit the integral rails; lifting +Y clears.
        captured=overlap(move(cap,[0,0,-2]),rear)
        assert captured>.001,(diameter,'cap rail capture missing');checks+=1
        for dy in range(0,41,2):clear(move(cap,[0,dy,0]),rear,(diameter,'cap lift',dy))
        for dz in range(0,31,2):clear(move(cap,[0,40,-dz]),rear,(diameter,'cap rear withdrawal',dz))
        length=math.ceil((diameter+60)/10)*10
        hardware_meshes=[];targets=[]
        for x in [-25,25]:
            shank=cylinder(4,length,[x,0,1.6-length/2])
            clear(shank,front,(diameter,'front 9 mm bolt bore'));clear(shank,rear,(diameter,'rear 9 mm bolt bore'))
            # Conservative OD24 washer, AF13 nut and full tip envelopes.
            washer=cylinder(12,1.6,[x,0,back-.8])
            nut=cylinder(13/math.sqrt(3),8,[x,0,back-5.6],sections=6)
            tip=cylinder(4,back-9.6-(1.6-length),[x,0,(back-9.6+1.6-length)/2])
            for m in [washer,nut,tip]:
                clear(cap,m,(diameter,'cap/bought hardware'))
                clear(closure,m,(diameter,'closure/bought hardware'))
                for dy in range(0,41,2):clear(move(closure,[0,-dy,0]),m,(diameter,'closure withdrawal/hardware',dy))
            hardware_meshes += [washer,nut,tip]
            targets += [np.array([x,0,back-9.6]),np.array([x,0,1.6-length])]
        skin=trimesh.util.concatenate([cap,closure,rear,pole])
        rays=0;control_exposed=0;control_underside_exposed=0
        for target in targets:
            for delta in [[0,0,0],[-2,0,0],[2,0,0],[0,-2,0],[0,2,0]]:
                p=target+delta
                for direction in [[0,0,-1],[-.25,0,-1],[.25,0,-1],[0,.25,-1],[0,-.25,-1],[-1,0,0],[1,0,0],[0,1,0],[0,-1,0]]:
                    origin=p+np.asarray(direction)*2000
                    assert visible_blocked(skin,origin,p),(diameter,'visible rear hardware',p,direction)
                    control_exposed += not visible_blocked(trimesh.util.concatenate([rear,pole]),origin,p)
                    if direction==[0,-1,0]:
                        control_underside_exposed += not visible_blocked(trimesh.util.concatenate([cap,rear,pole]),origin,p)
                    rays+=1;checks+=1
        assert control_exposed>0,'Omitted nut-cover control must expose rear hardware'
        assert control_underside_exposed>0,'Omitted underside closure must expose rear hardware from below'
        for x in [-8,8]:clear(guide,cylinder(5,20,[x,0,-24],'y'),(diameter,'guide cable channel'))
        for variant,(width,outer) in cover_assemblies.items():
            installation=[move(pole_interior,[width/2,0,0]),move(guide,[width/2,-230,0])]
            installation += [move(tie,[width/2,y,0]) for y in [-233,-227]]
            for y in [-60,60]:
                installation += [move(m,[width/2,y,0]) for m in [front,rear,cap,closure]]
            for mounted in installation:
                for cover in outer:clear(mounted,cover,(diameter,variant,'pole mount/enclosure'))
            looms=loom_assemblies[variant]
            clear(looms[0],looms[1],(diameter,variant,'two continuous looms'))
            for li,loom in enumerate(looms):
                for mi,m in enumerate(installation+outer):clear(loom,m,(diameter,variant,'continuous bottom loom/assembly',li,mi,m.bounds.tolist()))
        results[str(diameter)]={'nominal_diameter_mm':diameter,'bolt_length_mm':length,'tip_projection_mm':round(back-9.6-(1.6-length),3),'front_saddle_bounds_mm':front.bounds.tolist(),'rear_saddle_bounds_mm':rear.bounds.tolist(),'cap_unlock_lift_mm':40,'concealment_rays':rays,'control_exposed_rays_without_caps':control_exposed,'control_underside_exposed_rays_without_closures':control_underside_exposed,'timber_contact_export_tolerance_mm':.001,'front_saddle_volume_mm3':front.volume,'rear_saddle_volume_mm3':rear.volume}
        print('Round pole',diameter,'mm: saddle, cap, bolt and guide checks passed.',flush=True)

record={'status':'concept-unvalidated','pole_mount_revision':'0.1.0','cover_revision':'0.3.0','openScadVersion':registry['openScadVersion'],'checks':checks,'diameters':results,'stl_sha256':hashes,'checker_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'source_sha256':{'hardware/'+str(p.relative_to(hardware)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(list((hardware/'lib').glob('winch-*.scad'))+list((hardware/'assemblies/winch').glob('winch-*.scad'))+[hardware/'models.json'])},'limitations':'Nominal timber geometry and rigid CAD only. No metal grade/manufacture, strength, bolt bending, timber capacity, installation, preload, vibration retention, compliant guide insertion, actual cable minimum bend or loaded/weather acceptance.'}
if args.record:args.record.write_text(json.dumps(record,indent=2)+'\n')
print(checks,'nominal round-pole checks passed.',flush=True)
