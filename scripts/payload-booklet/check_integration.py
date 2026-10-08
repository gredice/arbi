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

def head_taper(part):
    """Check the real outer silhouette, including openings, in assembly coordinates."""
    filename=ROOT/part['file'];mesh=trimesh.load_mesh(filename)
    mesh.apply_transform(np.array(part['matrix']))
    zmin,zmax=mesh.bounds[:,2];epsilon=1e-4;tolerance=.001
    # Include either side of every mesh vertex height as well as a dense grid.
    # Do not derive the expected silhouette from the CAD profile equations.
    heights=np.unique(np.r_[np.linspace(zmax-epsilon,zmin+epsilon,1000),
                             mesh.vertices[:,2]-epsilon,mesh.vertices[:,2]+epsilon])
    heights=heights[(heights>zmin)&(heights<zmax)][::-1]
    sections=[];failures=[];tightest=None
    for z in heights:
        lines=trimesh.intersections.mesh_plane(mesh,[0,0,1],[0,0,z])
        if not len(lines):
            failures.append({'z_mm':float(z),'reason':'empty horizontal section'})
            continue
        points=lines.reshape(-1,3)[:,:2]
        bounds=np.array([points.min(0),points.max(0)])
        section={'z_mm':float(z),'xy_bounds_mm':bounds.tolist(),
                 'width_x_mm':float(bounds[1,0]-bounds[0,0]),
                 'depth_y_mm':float(bounds[1,1]-bounds[0,1])}
        sections.append(section)
        if tightest is not None:
            # Compare with the tightest prior bounds, not just the preceding
            # slice: many tiny outward steps must not accumulate unnoticed.
            outward=np.maximum(tightest[0]-bounds[0],bounds[1]-tightest[1])
            if np.any(outward>tolerance):
                failures.append({'z_mm':float(z),'xy_bounds_mm':bounds.tolist(),
                                 'prior_inward_bounds_mm':tightest.tolist(),
                                 'outward_x_y_mm':np.maximum(outward,0).tolist()})
            tightest=np.array([np.maximum(tightest[0],bounds[0]),
                               np.minimum(tightest[1],bounds[1])])
        else:tightest=bounds.copy()
    if not sections:failures.append({'reason':'no horizontal sections'})
    indices=np.unique(np.linspace(0,len(sections)-1,8,dtype=int)) if sections else []
    return {'file':part['file'],'stl_sha256':hashlib.sha256(filename.read_bytes()).hexdigest(),
            'assembly_bounds_mm':mesh.bounds.tolist(),'sample_count':len(heights),
            'numerical_tolerance_mm':tolerance,
            'method':'Horizontal STL sections from top to bottom; all four XY bounds must move inward within numerical tolerance.',
            'representative_sections':[sections[i] for i in indices],'failures':failures}

def neck_clearance(tray,head):
    """Measure the actual STL annulus in the fixed/moving neck overlap.

    Radial bounds are conservative for every pan angle, including angles
    between the sampled motion poses. They do not model print tolerances.
    """
    meshes=[]
    for part in [tray,head]:
        mesh=trimesh.load_mesh(ROOT/part['file'])
        mesh.apply_transform(np.array(part['matrix']));meshes.append(mesh)
    lower=max(m.bounds[0,2] for m in meshes)
    upper=min(m.bounds[1,2] for m in meshes)
    assert upper>lower,'Fixed shoulder must overlap the moving neck'
    sections=[]
    for z in np.linspace(lower+1e-4,upper-1e-4,41):
        lines=[trimesh.intersections.mesh_plane(m,[0,0,1],[0,0,z])[:,:,:2] for m in meshes]
        assert all(len(line) for line in lines),'Missing neck section'
        start=lines[0][:,0];delta=lines[0][:,1]-start
        t=np.clip(-np.sum(start*delta,axis=1)/np.maximum(np.sum(delta*delta,axis=1),1e-12),0,1)
        inner=float(np.linalg.norm(start+t[:,None]*delta,axis=1).min())
        outer=float(np.linalg.norm(lines[1].reshape(-1,2),axis=1).max())
        sections.append({'z_mm':float(z),'tray_inner_radius_mm':inner,
                         'head_outer_radius_mm':outer,'clearance_mm':inner-outer})
    # Expand the moving mesh radially to check that an interference is caught.
    oversized=dict(head);matrix=np.array(head['matrix'])
    scale=np.diag([1.04,1.04,1,1]);oversized['matrix']=(scale@matrix).tolist()
    control=paircheck([tray,oversized])
    return {'method':'Actual horizontal STL segments: closest fixed-skin point minus largest moving radius; conservative for all pan angles.',
            'overlap_z_mm':[float(lower),float(upper)],'sections':sections,
            'minimum_clearance_mm':min(s['clearance_mm'] for s in sections),
            'required_nominal_clearance_mm':1.4,
            'oversized_neck_control':{'xy_scale':1.04,'collision_detected':bool(control),'collisions':control}}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--quick',action='store_true');args=ap.parse_args()
    for e in json.loads((ROOT/'mesh-manifest.json').read_text()):
        assert hashlib.sha256((ROOT/e['file']).read_bytes()).hexdigest()==e['stl_sha256'], 'Mesh changed after export: '+e['file']
    zero=assembly();bad=paircheck(zero)
    print('Neutral pose collisions:',len(bad),flush=True)
    for b in bad:print(b,flush=True)
    report={'configuration':CONFIG,'variant':'enclosure' if ENCLOSURE else 'bench','units':'mm','neutral_collisions':bad,
      'intersection_tolerance_mm3':EPS_VOLUME,'intended_exclusions':['servo-shaft / stock-horn spline engagement','OEM servo-centre screw / servo threaded engagement'],
      'source_hashes':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'source/integration.py',ROOT/'source/check_integration.py',ROOT/'source/arbi-hardware/lib/payload-mounts.scad']+([ROOT/'source/arbi-hardware/lib/payload-enclosure.scad',ROOT/'source/arbi-hardware/lib/payload-integrated-deck.scad',ROOT/'source/arbi-hardware/lib/payload-integrated-head.scad',ROOT/'source/arbi-hardware/lib/payload-integrated-gimbal.scad'] if ENCLOSURE else [])}}
    if ENCLOSURE:
        report['head_taper']=head_taper(next(p for p in zero if p['name']=='gimbal-head'))
        report['neck_clearance']=neck_clearance(next(p for p in zero if p['name']=='enclosure-base'),
                                               next(p for p in zero if p['name']=='gimbal-head'))
        assert report['neck_clearance']['minimum_clearance_mm']>=1.4,'Neck clearance too small'
        assert report['neck_clearance']['oversized_neck_control']['collision_detected'],'Oversized neck control missed'
        print('Head taper sections:',report['head_taper']['sample_count'],
              'failures:',len(report['head_taper']['failures']),flush=True)
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
    if ENCLOSURE and report['head_taper']['failures']:raise SystemExit('Outer head widens downward')
    if bad or report.get('motion_grid',{}).get('failures'):raise SystemExit(1)
    if not args.quick and not all(x['stop_detected'] for x in report['hard_stop_overtravel'].values()):raise SystemExit('Missing hard stop')
    print('PASS',flush=True)
if __name__=='__main__':main()
