"""Check exported STL solids against a single assembled configuration and travel grid."""
from pathlib import Path
import argparse,json,hashlib,itertools,time
import numpy as np
import trimesh
import manifold3d as mf
from integration import assembly,ROOT,CONFIG,ENCLOSURE

EPS_VOLUME=.005 # mm^3; numeric contact tolerance, not a design clearance
cache={}
def solid(p):
    key=p['file']
    if key not in cache:
        mesh=trimesh.load_mesh(ROOT/key)
        cache[key]=(mf.Manifold(mf.Mesh(np.asarray(mesh.vertices,dtype=np.float32),np.asarray(mesh.faces,dtype=np.uint32))),mesh)
    s,m=cache[key];mat=np.array(p['matrix']);v=trimesh.transform_points(m.vertices,mat)
    return s.transform(mat[:3,:]),np.array([v.min(0),v.max(0)])
def overlaps(a,b):return np.all(np.minimum(a[1],b[1])-np.maximum(a[0],b[0])>1e-5)
def paircheck(parts,mode='all'):
    solids=[solid(p) for p in parts];bad=[]
    for i,j in itertools.combinations(range(len(parts)),2):
        a,b=parts[i],parts[j]
        if mode=='cross' and a['group']==b['group']:continue
        names={a['name'],b['name']}
        # Simplified stock references do not model the spline socket/threaded horn screw.
        if names in [{'pan-servo','pan-horn'},{'tilt-servo','tilt-horn'},{'pan-servo','pan-horn-center-screw'},{'tilt-servo','tilt-horn-center-screw'}]:continue
        if overlaps(solids[i][1],solids[j][1]):
            v=float((solids[i][0]^solids[j][0]).volume())
            if v>EPS_VOLUME:bad.append({'a':a['name'],'b':b['name'],'intersection_mm3':round(v,5)})
    return bad

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--quick',action='store_true');args=ap.parse_args()
    for e in json.loads((ROOT/'mesh-manifest.json').read_text()):
        assert hashlib.sha256((ROOT/e['file']).read_bytes()).hexdigest()==e['stl_sha256'], 'Mesh changed after export: '+e['file']
    zero=assembly();bad=paircheck(zero)
    print('Neutral pose collisions:',len(bad),flush=True)
    for b in bad:print(b,flush=True)
    report={'configuration':CONFIG,'variant':'enclosure' if ENCLOSURE else 'bench','units':'mm','neutral_collisions':bad,
      'intersection_tolerance_mm3':EPS_VOLUME,'intended_exclusions':['servo-shaft / stock-horn spline engagement','OEM servo-centre screw / servo threaded engagement'],
      'source_hashes':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'source/integration.py',ROOT/'source/check_integration.py',ROOT/'source/arbi-hardware/lib/payload-mounts.scad']+([ROOT/'source/arbi-hardware/lib/payload-enclosure.scad'] if ENCLOSURE else [])}}
    if not args.quick and not bad:
        fails=[];poses=0
        for pan in range(-90,91,5):
            for tilt in range(0,71,5):
                hits=paircheck(assembly(pan,tilt),mode='cross');poses+=1
                if hits:fails.append({'pan':pan,'tilt':tilt,'collisions':hits})
            print('Checked pan',pan,flush=True)
        report['motion_grid']={'poses':poses,'pan_deg':[-90,90,5],'tilt_deg':[0,70,5],'failures':fails}
        report['hard_stop_overtravel']={}
        for label,p,t,expected in [('pan-negative',-96,0,{'pan-mount','pan-yoke'}),('pan-positive',96,0,{'pan-mount','pan-yoke'}),('tilt-negative',0,-6,{'tilt-pivot-support','camera-cradle'}),('tilt-positive',0,76,{'tilt-pivot-support','camera-cradle'})]:
            hits=paircheck(assembly(p,t),mode='cross')
            report['hard_stop_overtravel'][label]={'pan':p,'tilt':t,'stop_detected':any({h['a'],h['b']}==expected for h in hits),'collisions':hits}
    masses=[]
    for p in zero:
        if p['file'].startswith('models/printable/'):
            m=cache[p['file']][1];masses.append({'name':p['name'],'solid_volume_cm3':float(m.volume/1000),'solid_PETG_estimate_g_at_1p27':float(m.volume/1000*1.27)})
    report['solid_printed_mass_estimates']=masses
    report['solid_total_PETG_g']=sum(m['solid_PETG_estimate_g_at_1p27'] for m in masses)
    bounds=np.array([solid(p)[1] for p in zero]);report['neutral_assembly_bounds_mm']=[bounds[:,0].min(0).tolist(),bounds[:,1].max(0).tolist()]
    (ROOT/'integration-check.json').write_text(json.dumps(report,indent=2)+'\n')
    if bad or report.get('motion_grid',{}).get('failures'):raise SystemExit(1)
    if not args.quick and not all(x['stop_detected'] for x in report['hard_stop_overtravel'].values()):raise SystemExit('Missing hard stop')
    print('PASS',flush=True)
if __name__=='__main__':main()
