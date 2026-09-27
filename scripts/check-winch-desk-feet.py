#!/usr/bin/env python3
"""Check passive desk feet with OpenSCAD 2021.01 and NumPy; temporary exports only."""
from pathlib import Path
from collections import Counter, defaultdict
import json, struct
import numpy as np
import subprocess, tempfile

REPO=Path(__file__).resolve().parents[1]
TEMP=tempfile.TemporaryDirectory(prefix='arbi-desk-feet-')
ROOT=Path(TEMP.name)
meshes={}
results={}
for kind in ('short','long'):
    path=ROOT/f'winch-desk-foot-{kind}.stl'
    subprocess.run(['openscad','-o',str(path),str(REPO/f'hardware/assemblies/winch/winch-desk-foot-{kind}.scad')],check=True,capture_output=True,text=True)
    raw=path.read_bytes()
    if raw[:5]==b'solid':
        vertices=np.array([list(map(float,l.split()[1:])) for l in raw.decode().splitlines() if l.strip().startswith('vertex ')])
    else:
        count=struct.unpack_from('<I',raw,80)[0]
        vertices=np.array([struct.unpack_from('<12fH',raw,84+50*i)[3:12] for i in range(count)]).reshape(-1,3)
    v,ids=np.unique(np.round(vertices,5),axis=0,return_inverse=True)
    f=ids.reshape(-1,3)
    directed=Counter((int(a),int(b)) for face in f for a,b in zip(face,np.roll(face,-1)))
    edges=Counter(tuple(sorted((a,b))) for a,b in directed for _ in range(directed[a,b]))
    assert set(edges.values())=={2}, 'Non-manifold edge'
    assert all(directed[a,b]==directed[b,a]==1 for a,b in edges), 'Inconsistent winding'
    neighbours=defaultdict(set)
    for a,b in edges: neighbours[a].add(b);neighbours[b].add(a)
    visited=set();todo=[0]
    while todo:
        a=todo.pop()
        if a in visited: continue
        visited.add(a);todo.extend(neighbours[a]-visited)
    assert len(visited)==len(v), 'Disconnected component'
    triangles=v[f]
    vol=np.einsum('ij,ij->i',triangles[:,0],np.cross(triangles[:,1],triangles[:,2])).sum()/6
    assert vol>0
    assert np.all(np.linalg.norm(np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0]),axis=1)>1e-8)
    bounds=np.stack([v.min(axis=0),v.max(axis=0)])
    expected=[160 if kind=='short' else 244,60,35]
    assert np.allclose(bounds[1]-bounds[0],expected,atol=.001)
    assert bounds[0,2]==0
    meshes[kind]=triangles
    results[kind]={'dimensions_mm':expected,'watertight':True,'oriented':True,'components':1,'triangles':len(triangles),'solid_volume_cm3':round(vol/1000,2)}

collision_source=ROOT/'collision.scad'
collision_source.write_text(f"""use <{REPO/'hardware/lib/winch-desk-feet.scad'}>
intersection() {{
    wdf_installed_feet();
    union() {{
        for(x=[28.5,350.4],y=[50,130])
            translate([x,y,10]) cylinder(d=20,h=25,$fn=64);
        for(x=[409.9,451.9],y=[46,134])
            translate([x,y,10]) cylinder(d=20,h=25,$fn=64);
    }}
}}
""")
result=subprocess.run(['openscad','-o',str(ROOT/'collision.stl'),str(collision_source)],capture_output=True,text=True)
assert result.returncode==1 and 'Current top level object is empty.' in result.stderr, result.stderr
assert 'WARNING:' not in result.stderr and 'ERROR:' not in result.stderr, result.stderr
results['clearance']='No intersection: all eight 20 mm diameter x 25 mm projection fastener envelopes.'
print(json.dumps(results,indent=2))
TEMP.cleanup()
