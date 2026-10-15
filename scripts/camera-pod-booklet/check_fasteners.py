"""Check stocked screw lengths, actual nut engagement and captive-seat access.

Nominal rigid geometry only: this does not certify received hardware or loads.
"""
import json,re
from collections import Counter
import numpy as np
import trimesh
from integration import assembly,ROOT,ENCLOSURE,T
from check_service import cylinder,hits,path


def main():
    assert ENCLOSURE,'Stock fasteners belong to the compact enclosure only'
    parts=assembly();by={p['name']:p for p in parts}
    bolts=[p for p in parts if '-bolt-' in p['name'] or p['name']=='pivot-bolt']
    expected={'bolt-M3x25-reference':8,'bolt-M3x12-reference':19,
              'bolt-M2x8-reference':12,'csk-M2x8-reference':4,
              'csk-M1p6x6-reference':4}
    actual=dict(Counter(p['model'] for p in bolts))
    assert actual==expected,actual
    assert sum('washer' in p['name'] for p in parts)==61
    assert len([p for p in parts if '-nut-' in p['name'] or p['name']=='pivot-nut'])==47
    assert 'pivot-gap-shim' in by
    engagement=[]
    for bolt in bolts:
        diameter,length=re.search(r'M([\dp]+)x(\d+)',bolt['model']).groups()
        diameter=float(diameter.replace('p','.'));length=int(length)
        assert length<=25,(bolt['name'],length)
        screw=trimesh.load_mesh(ROOT/bolt['file'])
        assert abs(screw.bounds[1,2]-length)<.002,bolt['name']
        nut=by[bolt['name'].replace('bolt','nut')]
        mesh=trimesh.load_mesh(ROOT/nut['file'])
        matrix=np.linalg.inv(np.array(bolt['matrix']))@np.array(nut['matrix'])
        axial=trimesh.transform_points(mesh.vertices,matrix)[:,2]
        projection=length-float(axial.max())
        assert float(axial.min())>0 and projection>=-.002,(bolt['name'],projection)
        # Existing M1.6 supplier-ear screws are unchanged. Their nominal
        # projection is reported for received-unit inspection, not qualified.
        if diameter>=2:
            pitch=.4 if diameter==2 else .5
            assert projection>=pitch-.002,(bolt['name'],projection)
        engagement.append({'joint':bolt['name'],'diameter_mm':diameter,
                           'length_mm':length,'nut_axial_mm':[float(axial.min()),float(axial.max())],
                           'tip_projection_mm':round(projection,4),
                           'received_hardware_verified':False})
    paths=[]
    for i in range(4):
        nut=by[f'frame-nut-{i}'];x,y=np.array(nut['matrix'])[:2,3]
        unit=np.array([x,y])/np.hypot(x,y)
        paths.append(path(f'frame M3 washer/nut preloaded into integral post {i}',
                          [nut,by[f'frame-upper-washer-{i}']],[by['deck']],
                          [T(-unit[0]*d,-unit[1]*d) for d in np.arange(10,-.01,-.5)]))
        nut=by[f'pi-nut-{i}'];x=np.array(nut['matrix'])[0,3]
        paths.append(path(f'Pi M2 washer/nut preloaded before PCB {i}',
                          [nut,by[f'pi-bottom-washer-{i}']],[by['deck']],
                          [T((1 if x<-22 else -1)*d) for d in np.arange(10,-.01,-.5)]))
        paths.append(path(f'camera M2 front nut preloaded into white hood {i}',
                          [by[f'camera-nut-{i}']],[by['camera-hood']],
                          [T(0,0,-d) for d in np.arange(12,-.01,-.5)]))
    assert not any(p['failures'] for p in paths),paths
    controls=[]
    for name,xy,height in [('pi',[(x,y) for x in [-29,29] for y in [-24.5,24.5]],1.6),
                           ('camera',[(x,y) for x in [-10.5,10.5] for y in [-9.931,2.569]],1.12)]:
        for x,y in xy:
            collision=hits(cylinder(3,height+.04,np.array(by[name]['matrix'])@T(x,y,-.02)),[by[name]])
            assert collision,('Direct M3 substitution control missed',name,x,y)
            controls.append({'board':name,'local_xy_mm':[x,y],'M3_interference_detected':True,'hits':collision})
    report={'status':'nominal CAD only; proposed configuration','screw_counts':actual,
            'bought_screws':47,'flat_washers':61,'plain_nuts':47,'pivot_shims':1,
            'OEM_centre_screws':2,'nut_engagement':engagement,'preload_paths':paths,
            'direct_M3_PCB_controls':controls,
            'limits':'Actual head styles, stock counts, thread/nut dimensions, print retention/strength, PCB support, isolation and assembled loads require inspection.'}
    (ROOT/'fastener-check.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PASS stocked fasteners: five variants/47 screws, nut engagement, captive-seat access and PCB M3 interference controls.',flush=True)


if __name__=='__main__':main()
