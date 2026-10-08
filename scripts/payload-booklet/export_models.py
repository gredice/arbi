"""Export current payload geometry plus clearly labelled hardware references."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json, hashlib, subprocess, tempfile
import trimesh

ROOT=Path(__file__).resolve().parents[1]
CONFIG=json.loads((ROOT/'configuration.json').read_text()) if (ROOT/'configuration.json').exists() else {'variant':'bench'}
ENCLOSURE=CONFIG['variant']=='enclosure'
ENCLOSURE_MODELS={'payload-integrated-deck','payload-integrated-camera-hood','payload-integrated-gimbal-head','payload-integrated-gimbal-carrier','payload-integrated-camera-cradle','payload-integrated-tilt-pivot-support','payload-rain-hood','payload-enclosure-base','payload-tilt-servo-boot','payload-camera-cowl','payload-pan-fairing'}
NAMES=['raspberry-pi-3a-plus-reference','camera-module-3-standard-reference',
 'micro-servo-3p7g-UNVERIFIED','servo-horn-UNVERIFIED','buck-converter-UNVERIFIED',
 'capacitor-1000uf-UNVERIFIED','microsd-reference','csi-15pin-flat-reference',
 'nut-M2-reference','nut-M2p5-reference','nut-M4-reference',
 'washer-M2-reference','washer-M2p5-reference','washer-M4-reference',
 'bolt-M4x35-reference','bolt-M2p5x20-reference','bolt-M2x12-reference',
 'bolt-M3x12-reference','bolt-M3x35-reference','nut-M1p6-reference','nut-M3-reference',
 'washer-M3-reference','washer-M3x0p7-reference','bolt-OEM-horn-UNVERIFIED',
 'converter-tie-reference','capacitor-tie-reference','csk-M1p6x6-reference',
 'csk-M2x8-reference','csk-M2x10-reference']

def export(job):
    name,source,folder,defines,kind,model_id=job
    path=ROOT/'models'/folder/(name+'.stl');path.parent.mkdir(parents=True,exist_ok=True)
    # Keep OpenSCAD output isolated; publish only the checked binary mesh atomically.
    with tempfile.TemporaryDirectory(prefix='arbi-payload-export-') as temporary:
        raw=Path(temporary)/'raw.stl'
        command=['openscad','-o',str(raw)]
        for value in defines:command+=['-D',value]
        result=subprocess.run(command+[str(source)],capture_output=True,text=True,timeout=120)
        if result.returncode or 'ERROR:' in result.stderr or 'WARNING:' in result.stderr:
            raise RuntimeError(name+'\n'+result.stderr)
        mesh=trimesh.load_mesh(raw)
    assert len(mesh.faces)>0 and mesh.is_watertight and mesh.is_winding_consistent and mesh.volume>0,name
    if folder!='context':assert mesh.body_count==1,name
    # Preserve canonical spider geometry and align only its export frame to the print bed.
    offset=0
    if folder=='printable':
        offset=-float(mesh.bounds[0,2]);mesh.apply_translation([0,0,offset])
    tmp=path.with_suffix('.stl.tmp');tmp.write_bytes(mesh.export(file_type='stl'));tmp.replace(path)
    reread=trimesh.load_mesh(path)
    assert reread.is_watertight and reread.volume>0 and len(reread.faces)==len(mesh.faces),name
    entry={'id':name,'model_id':model_id,'file':str(path.relative_to(ROOT)),'kind':kind,'units':'mm',
      'bounds_mm':reread.bounds.tolist(),'triangles':len(reread.faces),'body_count':int(reread.body_count),
      'volume_mm3':float(reread.volume),'source':str(source.relative_to(ROOT)),
      'export_translation_mm':[0,0,offset],'watertight':True,'winding_consistent':True,
      'stl_sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    print(name,flush=True);return entry

if __name__=='__main__':
    names=NAMES+(['bolt-M2x10-reference'] if ENCLOSURE else [])
    jobs=[(n,ROOT/'source/reference-parts.scad','reference',[f'part="{n}"'],
      'unverified placeholder' if 'UNVERIFIED' in n else 'simplified hardware reference',n) for n in names]
    registry=json.loads((ROOT/'source/arbi-hardware/models.json').read_text())
    for model in registry['models']:
        # The camera-pod concept family is an alternative kit, not part of this bench assembly.
        if (model['assembly']=='camera-pod' and model['artifactRole']=='fabrication'
            and (model['id']=='camera-pod-spider' or model['id'].startswith('payload-'))):
            if model['id'] in ENCLOSURE_MODELS and not ENCLOSURE:continue
            if model['id'] in {'payload-electronics-cover','payload-electronics-deck','payload-camera-hood','payload-pan-yoke','payload-camera-cradle','payload-tilt-pivot-support','payload-camera-cowl','payload-pan-fairing','payload-tilt-servo-boot'} and ENCLOSURE:continue
            source=ROOT/'source/arbi-hardware'/Path(model['entrypoint']).relative_to('hardware')
            jobs.append((Path(model['output']).stem,source,'printable',[],
                         'canonical concept fabrication geometry; bed translation only',model['id']))
    if not ENCLOSURE:jobs.append(('camera-pod-keepout-NOT-A-PART',ROOT/'source/arbi-hardware/assemblies/camera-pod/camera-pod-envelope.scad',
       'context',[],'legacy non-manufacturing keep-out; not an enclosure','camera-pod-envelope'))
    with ThreadPoolExecutor(max_workers=3) as pool:result=list(pool.map(export,jobs))
    (ROOT/'mesh-manifest.json').write_text(json.dumps(result,indent=2)+'\n')
    print(f'{len(result)} payload meshes exported and validated.',flush=True)
