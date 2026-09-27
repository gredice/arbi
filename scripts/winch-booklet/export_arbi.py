"""Export unchanged winch fabrication models from the bundled OpenSCAD snapshot."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json,subprocess,hashlib
import trimesh

ROOT=Path(__file__).resolve().parents[1]
SNAPSHOT=ROOT/'source/arbi-hardware'
MODELS=ROOT/'models/arbi'
MODELS.mkdir(parents=True,exist_ok=True)
registry=json.loads((SNAPSHOT/'models.json').read_text())
entries=[m for m in registry['models'] if m['assembly']=='winch' and m['artifactRole']=='fabrication']

def export(entry):
    source=SNAPSHOT/entry['entrypoint'].removeprefix('hardware/')
    target=MODELS/entry['output']
    result=subprocess.run(['openscad','-o',str(target),str(source)],capture_output=True,text=True,timeout=480)
    if result.returncode or 'ERROR:' in result.stderr or 'WARNING:' in result.stderr:
        raise RuntimeError(entry['id']+'\n'+result.stderr)
    mesh=trimesh.load_mesh(target)
    assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume>0,entry['id']
    assert mesh.body_count==1,entry['id']
    data=mesh.export(file_type='stl')
    staged=target.with_suffix('.stl.tmp')
    staged.write_bytes(data)
    staged.replace(target)
    check=trimesh.load_mesh(target)
    assert check.is_watertight and check.volume>0 and len(check.faces)==len(mesh.faces),entry['id']
    info={'id':entry['id'],'revision':entry['revision'],'status':entry['status'],
          'source':str(source.relative_to(ROOT)), 'file':str(target.relative_to(ROOT)),
          'kind':'ARBI fabrication model','units':'mm','triangles':len(mesh.faces),
          'bounds_mm':mesh.bounds.tolist(),'watertight':True,
          'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
          'stl_sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
    print(entry['id']+' exported',flush=True)
    return info

if __name__=='__main__':
    with ThreadPoolExecutor(max_workers=3) as pool:
        result=list(pool.map(export,entries))
    (ROOT/'arbi-mesh-manifest.json').write_text(json.dumps(result,indent=2)+'\n')
    print(f'{len(result)} ARBI models exported and checked.',flush=True)
