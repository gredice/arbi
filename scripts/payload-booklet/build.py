"""Build and check the payload bench assembly booklet and STL pack from current CAD."""
from pathlib import Path
import argparse,ast,re,hashlib,json,shutil,subprocess,sys,zipfile
from datetime import date
from collections import Counter

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[1]

def write_evidence(root,publish=False):
    root=Path(root).resolve()
    config=json.loads((root/'configuration.json').read_text())
    enclosure=config['variant']=='enclosure'
    artifact='ARBI-payload-enclosure' if enclosure else 'ARBI-payload'
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
    assert not any(s['hits'] for s in service.get('wiring_ports',[]))
    if enclosure:
        assert all(s['passed'] for s in service['cowl_clamp_seating'])
        assert not service['fixed_power_route']['failures']
        assert service['fixed_power_route']['incorrect_straight_route_control']['expected_collision_detected']
    evidence={'date':date.today().isoformat(),'configuration':config,'status':'CAD-only; concept-unvalidated',
      'integration':integration,'service':service,
      'mesh_hashes':{e['model_id']:e['stl_sha256'] for e in meshes},
      'checker_sources':{name:hashlib.sha256((root/'source'/name).read_bytes()).hexdigest()
         for name in ['integration.py','check_integration.py','check_service.py','reference-parts.scad']}}
    relative=Path('assemblies/camera-pod')/('payload-enclosure-check.json' if enclosure else 'payload-geometry-check.json')
    (root/'source/arbi-hardware'/relative).write_text(json.dumps(evidence,indent=2)+'\n')
    (root/relative.name).write_text(json.dumps(evidence,indent=2)+'\n')
    if publish:(REPO/'hardware'/relative).write_text(json.dumps(evidence,indent=2)+'\n')
    provenance=json.loads((root/'source-provenance.json').read_text())
    provenance['source_hashes']={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest()
      for p in sorted((root/'source').rglob('*')) if p.is_file() and '__pycache__' not in p.parts}
    (root/'source-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
    return artifact

def finalize_package(root,publish=False):
    root=Path(root).resolve();artifact=write_evidence(root,publish)
    archive=root/(artifact+'-STL-pack.zip')
    members=[root/(artifact+'-assembly-STL.pdf'),root/(artifact+'-assembled.glb'),root/'README.md']+list(root.glob('*.json'))
    for name in ['models','source','figures']:
        members += [p for p in (root/name).rglob('*') if p.is_file() and '__pycache__' not in p.parts]
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in sorted(members):z.write(p,Path(artifact+'-STL-pack')/p.relative_to(root))
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        assert sum(n.endswith('.stl') for n in z.namelist())==len(json.loads((root/'mesh-manifest.json').read_text()))
    if publish:
        target=REPO/'docs/assemblies/camera-pod/booklet';target.mkdir(parents=True,exist_ok=True)
        for name in [artifact+'-assembly-STL.pdf',artifact+'-STL-pack.zip']:
            shutil.copy2(root/name,target/name)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=REPO/'hardware/generated/payload-booklet')
    parser.add_argument('--checks-only',action='store_true',help='Export and check the selected variant without rendering PDF/ZIP snapshots')
    parser.add_argument('--publish',action='store_true',help='Copy requested release snapshots into the owning docs folder')
    parser.add_argument('--enclosure',action='store_true',help='Build the rounded rain/splash enclosure with downward cable outlets')
    parser.add_argument('--reuse-models',action='store_true',help='Reuse only if source and STL hashes match')
    args=parser.parse_args()
    assert not (args.checks_only and args.publish),'--checks-only cannot publish a booklet'
    root=args.output.resolve();(root/'source').mkdir(parents=True,exist_ok=True)
    config={'variant':'enclosure' if args.enclosure else 'bench','units':'mm','pan_deg':[-90,90,5],'tilt_deg':[0,70,5],
      'hardware_basis':'declared nominal references; supplier dimensions unverified','evidence_date':date.today().isoformat()}
    registry=json.loads((REPO/'hardware/models.json').read_text())
    enclosure_models={'payload-rain-hood','payload-enclosure-base','payload-pan-fairing','payload-tilt-servo-boot','payload-camera-cowl'}
    selected=[m for m in registry['models'] if m['assembly']=='camera-pod' and m['artifactRole']=='fabrication' and (m['id']=='camera-pod-spider' or m['id'].startswith('payload-')) and (args.enclosure or m['id'] not in enclosure_models) and (not args.enclosure or m['id']!='payload-electronics-cover')]
    config['fabrication_models']=[{'id':m['id'],'revision':m['revision'],'output':m['output']} for m in selected]
    artifact='ARBI-payload-enclosure' if args.enclosure else 'ARBI-payload'
    inputs=list((REPO/'hardware/assemblies/camera-pod').glob('*.scad'))+[REPO/'hardware/lib/arbi.scad',REPO/'hardware/lib/camera-pod.scad',REPO/'hardware/lib/payload-mounts.scad',REPO/'hardware/lib/payload-enclosure.scad',REPO/'hardware/models.json',HERE/'reference-parts.scad',HERE/'export_models.py']
    hashes={str(p.relative_to(REPO)):hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
    if args.reuse_models:
        assert json.loads((root/'configuration.json').read_text())['variant']==config['variant'],'Variant changed; use a full export'
        assert json.loads((root/'build-input-hashes.json').read_text())==hashes,'CAD changed; use a full export'
        for entry in json.loads((root/'mesh-manifest.json').read_text()):
            assert hashlib.sha256((root/entry['file']).read_bytes()).hexdigest()==entry['stl_sha256'],entry['file']
    (root/'configuration.json').write_text(json.dumps(config,indent=2)+'\n')
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
    style=style.replace('ARBI-winch-assembly-STL.pdf',artifact+'-assembly-STL.pdf').replace('ARBI winch and drum - STL-based assembly booklet','ARBI payload - printed mount assembly booklet')
    style=style.replace('WINCH & DRUM','PAYLOAD').replace("text(153,15,'PASSIVE / STL EDITION'","text(141,15,'MOUNT SET / BENCH EDITION'")
    style=re.sub(r'Mechanical bench assembly \| Revision [^\']+',('Payload rain enclosure | Revision 1 | ' if args.enclosure else 'Payload bench assembly | Revision 3 | ')+date.today().strftime('%d %b %Y'),style)
    if args.enclosure:
        style=style.replace('/ 14','/ 16').replace('MOUNT SET / BENCH EDITION','RAIN / SPLASH EDITION').replace('Payload bench assembly | Revision 2 | 28 Sep 2026','Payload rain enclosure | Revision 1 | '+date.today().strftime('%d %b %Y'))
    (root/'source/page_style.py').write_text(style)
    provenance={'repository':'https://github.com/gredice/arbi','base_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip(),
      'booklet_revision':1 if args.enclosure else 3,'configuration':config,'scope':'Nominal rain/splash enclosure assembly; ingress, servo/power dimensions and physical fits unverified.' if args.enclosure else 'Complete nominal bench mount assembly; servo/power dimensions and physical fits unverified.',
      'source_hashes':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((root/'source').rglob('*')) if p.is_file() and '__pycache__' not in p.parts}}
    (root/'source-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
    if not args.reuse_models:
        if (root/'models').exists():shutil.rmtree(root/'models')
        subprocess.run([sys.executable,str(root/'source/export_models.py')],check=True)
        (root/'build-input-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
    if (root/'figures').exists():shutil.rmtree(root/'figures')
    checks=[('check_integration.py',['--quick']),('check_service.py',[]),('check_integration.py',[])] if args.enclosure else [('check_integration.py',[]),('check_service.py',[])]
    for name,options in checks:
        subprocess.run([sys.executable,str(root/'source'/name),*options],check=True)
    write_evidence(root)
    if args.checks_only:
        print('Checked variant:',root);return
    for name in ['render_figures.py','build_booklet.py']:
        subprocess.run([sys.executable,str(root/'source'/name)],check=True)
    # Keep the pack inventory synchronized with registered filenames and actual assembly quantities.
    manifest=json.loads((root/'mesh-manifest.json').read_text())
    assembly_parts=json.loads((root/'assembly-manifest.json').read_text())['parts']
    counts=Counter(p['model'] for p in assembly_parts)
    title='Rounded rain/splash enclosure' if args.enclosure else 'Bench mount set'
    readme='# ARBI payload - '+title+'\n\nStart with **'+artifact+'-assembly-STL.pdf**. Units are millimetres.\n\n## Printable inventory\n\n| Registered STL | Quantity |\n| --- | ---: |\n'
    for e in manifest:
        if e['file'].startswith('models/printable/'):
            count=str(counts[e['model_id']]) if counts[e['model_id']] else 'test coupon; not installed'
            readme+='| '+Path(e['file']).name+' | '+count+' |\n'
    readme+='\n## Check the actual parts first'+(HERE/'pack-README.md').read_text().split('## Check the actual parts first')[1]
    readme=readme.replace('- ARBI-payload-assembled.glb:', '- '+artifact+'-assembled.glb:')
    if args.enclosure:
        readme+='\n## Enclosure interfaces\n\nWhite rain hood and camera cowl; black base, fairing and servo boot. Bottom-up M3 x 35 screws retain the closed roof using side-loaded plain nuts. The lower outlets use nominal 6 mm power lead, 16 x 0.3 mm CSI ribbon and 4 x 2 mm servo leads. Flexible loops, boots/grommets, received connectors, drip loops, heat and rain performance require bench inspection. This is an ordinary-rain/splash concept, with no IP rating.\n'
    (root/'README.md').write_text(readme)
    finalize_package(root,args.publish)
    print('Ready:',root)

if __name__=='__main__':main()
