"""Build and check the payload bench assembly booklet and STL pack from current CAD."""
from pathlib import Path
import argparse,ast,hashlib,json,shutil,subprocess,sys,zipfile

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[1]

def finalize_package(root,publish=False):
    root=Path(root).resolve()
    integration=json.loads((root/'integration-check.json').read_text())
    service=json.loads((root/'service-check.json').read_text())
    assert not integration['neutral_collisions'] and not integration['motion_grid']['failures']
    assert all(s['stop_detected'] for s in integration['hard_stop_overtravel'].values())
    assert not any(s['failures'] for s in service['assembly_paths'])
    assert not any(s['hits'] for s in service['tool_access'])
    assert not any(s['hits'] for s in service['view_check']['poses'])
    assert service['proud_head_regression_control']['expected_collision_detected']
    meshes=json.loads((root/'mesh-manifest.json').read_text())
    for e in meshes:
        assert hashlib.sha256((root/e['file']).read_bytes()).hexdigest()==e['stl_sha256'],e['file']
    evidence={'date':'2026-09-28','status':'CAD-only; concept-unvalidated',
      'integration':integration,'service':service,
      'mesh_hashes':{e['model_id']:e['stl_sha256'] for e in meshes},
      'checker_sources':{name:hashlib.sha256((root/'source'/name).read_bytes()).hexdigest()
         for name in ['integration.py','check_integration.py','check_service.py','reference-parts.scad']}}
    relative=Path('assemblies/camera-pod/payload-geometry-check.json')
    (root/'source/arbi-hardware'/relative).write_text(json.dumps(evidence,indent=2)+'\n')
    if publish:(REPO/'hardware'/relative).write_text(json.dumps(evidence,indent=2)+'\n')
    provenance=json.loads((root/'source-provenance.json').read_text())
    provenance['source_hashes']={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest()
      for p in sorted((root/'source').rglob('*')) if p.is_file() and '__pycache__' not in p.parts}
    (root/'source-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
    archive=root/'ARBI-payload-STL-pack.zip'
    members=[root/'ARBI-payload-assembly-STL.pdf',root/'ARBI-payload-assembled.glb',root/'README.md']+list(root.glob('*.json'))
    for name in ['models','source','figures']:
        members += [p for p in (root/name).rglob('*') if p.is_file() and '__pycache__' not in p.parts]
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in sorted(members):z.write(p,Path('ARBI-payload-STL-pack')/p.relative_to(root))
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        assert sum(n.endswith('.stl') for n in z.namelist())==len(json.loads((root/'mesh-manifest.json').read_text()))
    if publish:
        target=REPO/'docs/assemblies/camera-pod/booklet';target.mkdir(parents=True,exist_ok=True)
        for name in ['ARBI-payload-assembly-STL.pdf','ARBI-payload-STL-pack.zip']:
            shutil.copy2(root/name,target/name)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=REPO/'hardware/generated/payload-booklet')
    parser.add_argument('--publish',action='store_true',help='Copy requested release snapshots into the owning docs folder')
    parser.add_argument('--reuse-models',action='store_true',help='Reuse only if source and STL hashes match')
    args=parser.parse_args();root=args.output.resolve();(root/'source').mkdir(parents=True,exist_ok=True)
    inputs=list((REPO/'hardware/assemblies/camera-pod').glob('*.scad'))+[REPO/'hardware/lib/arbi.scad',REPO/'hardware/lib/payload-mounts.scad',REPO/'hardware/models.json',HERE/'reference-parts.scad',HERE/'export_models.py']
    hashes={str(p.relative_to(REPO)):hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
    if args.reuse_models:
        assert json.loads((root/'build-input-hashes.json').read_text())==hashes,'CAD changed; use a full export'
        for entry in json.loads((root/'mesh-manifest.json').read_text()):
            assert hashlib.sha256((root/entry['file']).read_bytes()).hexdigest()==entry['stl_sha256'],entry['file']
    shutil.rmtree(root/'source');(root/'source').mkdir()
    for name in ['lib','assemblies/camera-pod']:
        shutil.copytree(REPO/'hardware'/name,root/'source/arbi-hardware'/name,dirs_exist_ok=True)
    shutil.copy2(REPO/'hardware/models.json',root/'source/arbi-hardware/models.json')
    shutil.copytree(REPO/'scripts/winch-booklet/fonts',root/'source/fonts',dirs_exist_ok=True)
    shutil.copy2(REPO/'scripts/winch-booklet/requirements.txt',root/'source/requirements.txt')
    shutil.copy2(REPO/'LICENSE',root/'source/LICENSE-ARBI')
    for name in ['reference-parts.scad','export_models.py','render_figures.py','build_booklet.py','integration.py','check_integration.py','check_service.py']:
        shutil.copy2(HERE/name,root/'source'/name)
    shutil.copy2(HERE/'pack-README.md',root/'README.md')
    shutil.copy2(HERE/'sources.json',root/'sources.json')
    # Reuse existing winch rendering and typography helpers, not its assembly data.
    render_source=(REPO/'scripts/winch-booklet/render_figures.py').read_text()
    tree=ast.parse(render_source)
    functions=[ast.get_source_segment(render_source,n) for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['T','R','polydata','render']]
    header='from pathlib import Path\nimport json,math\nimport numpy as np\nimport vtk\nROOT=Path(__file__).resolve().parents[1]\nFIGS=ROOT/"figures"\nFIGS.mkdir(exist_ok=True)\ncache={}\nmanifest={}\n'
    (root/'source/mesh_renderer.py').write_text(header+'\n\n'.join(functions)+'\n')
    style=(REPO/'scripts/winch-booklet/build_booklet.py').read_text().split("begin('Build the actual parts'")[0]
    assert 'def begin(' in style and 'C.save()' not in style,'Review upstream page-style extraction'
    style=style.replace('ARBI-winch-assembly-STL.pdf','ARBI-payload-assembly-STL.pdf').replace('ARBI winch and drum - STL-based assembly booklet','ARBI payload - printed mount assembly booklet')
    style=style.replace('WINCH & DRUM','PAYLOAD').replace("text(153,15,'PASSIVE / STL EDITION'","text(141,15,'MOUNT SET / BENCH EDITION'")
    style=style.replace('Mechanical bench assembly | Revision 3 | 27 Sep 2026','Payload bench assembly | Revision 2 | 28 Sep 2026')
    (root/'source/page_style.py').write_text(style)
    provenance={'repository':'https://github.com/gredice/arbi','base_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip(),
      'booklet_revision':2,'scope':'Complete nominal bench mount assembly; servo/power dimensions and physical fits unverified.',
      'source_hashes':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((root/'source').rglob('*')) if p.is_file() and '__pycache__' not in p.parts}}
    (root/'source-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
    if not args.reuse_models:
        if (root/'models').exists():shutil.rmtree(root/'models')
        subprocess.run([sys.executable,str(root/'source/export_models.py')],check=True)
        (root/'build-input-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
    if (root/'figures').exists():shutil.rmtree(root/'figures')
    for name in ['check_integration.py','check_service.py','render_figures.py','build_booklet.py']:
        subprocess.run([sys.executable,str(root/'source'/name)],check=True)
    finalize_package(root,args.publish)
    print('Ready:',root)

if __name__=='__main__':main()
