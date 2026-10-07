"""Create purchased-part STL illustration references; never print as real hardware."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess,json,hashlib,tempfile
import trimesh

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'models/reference'
SOURCE=ROOT/'source/reference-parts.scad'
NAMES=['bearing-608','inner-ring-spacer','shaft-collar-8','coupling-hub','coupling-spider',
 'motor-23HS40-reference','shaft-8x340','shaft-8x660','tie-rod-M5x280','tie-rod-M5x610',
 'washer-M4','washer-M5','washer-M6','washer-M8','nut-M4','nut-M5','nut-M8',
 'nyloc-M4','nyloc-M5','nyloc-M6','nyloc-M8','bolt-M4x20','bolt-M4x25','bolt-M4x45',
 'bolt-M5x35','bolt-M6x30','bolt-M8x35','bolt-M8x160','bolt-M8x180','bolt-M8x200','bolt-M4x16',
 'line-passive-reference','line-powered-reference','loom-10mm-reference']

def finish(name,target,result):
    if result.returncode or 'ERROR:' in result.stderr or 'WARNING:' in result.stderr:
        raise RuntimeError(name+'\n'+result.stderr)
    mesh=trimesh.load_mesh(target)
    assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume>0,name
    assert mesh.body_count==1,name
    data=mesh.export(file_type='stl')
    staged=target.with_suffix('.stl.tmp')
    staged.write_bytes(data)
    staged.replace(target)
    check=trimesh.load_mesh(target)
    assert check.is_watertight and check.volume>0 and len(check.faces)==len(mesh.faces),name
    return {'id':name,'file':str(target.relative_to(ROOT)),'units':'mm',
      'kind':'illustration reference - not a printable substitute','watertight':True,
      'triangles':len(mesh.faces),'bounds_mm':mesh.bounds.tolist(),
      'stl_sha256':hashlib.sha256(target.read_bytes()).hexdigest()}

def export(name):
    target=DEST/(name+'.stl')
    r=subprocess.run(['openscad','-D',f'part="{name}"','-o',str(target),str(SOURCE)],capture_output=True,text=True,timeout=120)
    return finish(name,target,r)

if __name__=='__main__':
    DEST.mkdir(parents=True,exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        result=list(pool.map(export,NAMES))
    for powered,covered in [(False,False),(True,False),(False,True),(True,True)]:
        name='base-plate-'+('powered' if powered else 'passive')+('-covered' if covered else '')
        target=DEST/(name+'.stl')
        with tempfile.TemporaryDirectory() as temp:
            src=Path(temp)/'plate.scad'
            src.write_text(f'include <{ROOT}/source/arbi-hardware/lib/winch-cover.scad>\n{"wc_base" if covered else "wm_base"}({str(powered).lower()});\n')
            r=subprocess.run(['openscad','-o',str(target),str(src)],capture_output=True,text=True,timeout=120)
        result.append(finish(name,target,r))
    contexts=[('pole-timber-120','wp_drilled_timber(120,1500);')]
    contexts += [('pole-guide-tie-120','wp_guide_tie(120);')]
    contexts += [('loom-'+variant+'-bottom-'+str(i),f'wc_loom_run({str(powered).lower()},{i});')
                 for variant,powered in [('passive',False),('powered',True)] for i in [0,1]]
    for name,body in contexts:
        target=DEST/(name+'.stl')
        with tempfile.TemporaryDirectory() as temp:
            src=Path(temp)/'context.scad'
            src.write_text(f'include <{ROOT}/source/arbi-hardware/lib/winch-cover.scad>\n'+body+'\n')
            r=subprocess.run(['openscad','-o',str(target),str(src)],capture_output=True,text=True,timeout=120)
        result.append(finish(name,target,r))
    (ROOT/'reference-mesh-manifest.json').write_text(json.dumps(result,indent=2)+'\n')
    print(f'{len(result)} reference models exported and checked.',flush=True)
