"""Check the received converter's measured holes, screw stacks and service access."""
import json
import numpy as np
import trimesh
from integration import assembly,T,ROOT,ENCLOSURE
from check_integration import solid,EPS_VOLUME
from check_service import cylinder,hits,path

def main():
    parts=assembly();by={p['name']:p for p in parts};converter=by['converter']
    board, bounds=solid(converter)
    expected=[30,50,17] if ENCLOSURE else [50,30,17]
    assert np.allclose(bounds[1]-bounds[0],expected,atol=.001),bounds.tolist()
    envelope=trimesh.creation.box(extents=bounds[1]-bounds[0])
    envelope.apply_translation((bounds[1]+bounds[0])/2)
    envelope_hits=hits(envelope,[p for p in parts if p['name']!='converter'
                                 and not p['name'].startswith('converter-')])
    assert not envelope_hits,('Full measured envelope',envelope_hits)
    probes=[];controls=[];access=[];paths=[]
    # The new frame nuts are below the converter, so the former X32/M4
    # collision is historical. A gross inward shift must still be detected.
    shift=30 if ENCLOSURE else 6
    old=dict(converter,matrix=(T(-shift,0,0)@np.array(converter['matrix'])).tolist())
    old_solid,_=solid(old)
    collisions=[]
    for p in parts:
        if p['name']=='pi' if ENCLOSURE else p['name'].startswith('frame-nut-'):
            volume=float((old_solid^solid(p)[0]).volume())
            if volume>EPS_VOLUME:collisions.append({'part':p['name'],'volume_mm3':volume})
    assert collisions,'Misplaced converter interference control missed'
    old_position_control={'centre_xy_mm':[5 if ENCLOSURE else 40,0],
                          'collision_detected':True,'hits':collisions}
    for i in range(4):
        bolt=by[f'converter-bolt-{i}'];x,y=np.array(bolt['matrix'])[:2,3]
        for name,d,z,h in [('measured PCB hole',2.9,22.49,1.63),('printed support bore',2.1 if ENCLOSURE else 2.7,17.49,5.03)]:
            targets=[converter] if name=='measured PCB hole' else [by['deck']]
            collision=hits(cylinder(d,h,T(x,y,z)),targets)
            assert not collision,(name,i,collision)
            probes.append({'name':name,'hole':i,'hits':collision})
        control=hits(cylinder(2.9,1.63,T(x+1,y,22.49)),[converter])
        assert control,('Shifted hole control missed',i)
        controls.append({'hole':i,'shift_mm':[1,0,0],'collision_detected':bool(control)})
        targets=[p for p in parts if p['name'] not in ['rain-hood','electronics-cover',f'converter-bolt-{i}']]
        collision=hits(cylinder(2.5,15,T(x,y,27.11)),targets)
        assert not collision,('Converter driver',i,collision)
        access.append({'hole':i,'diameter_mm':2.5,'length_mm':15,'hits':collision})
        targets=[p for p in parts if p['name'] not in ['rain-hood','electronics-cover',f'converter-bolt-{i}']]
        result=path(f'converter bolt {i} inserted from above with cover removed',[bolt],targets,[T(0,0,z) for z in range(16)])
        assert not result['failures'],result
        paths.append(result)
    # Board lifts after its four screws and top washers are removed; no tie engagement.
    targets=[p for p in parts if p['name'] not in ['converter','rain-hood','electronics-cover']
             and not p['name'].startswith(('converter-bolt-','converter-top-washer-'))]
    removal=path('received converter lifts vertically after four screws/top washers are removed',[converter],targets,[T(0,0,z) for z in range(31)])
    assert not removal['failures'],removal
    # Input/output connection pads need vertical wire/soldering access. Nominal
    # pad positions come from the shared SCAD reference; no cable-bend proof.
    pad_access=[]
    for x,y in [(-22,5),(-22,-5),(22,5),(22,-5)]:
        matrix=np.array(converter['matrix'])@T(x,y,2.2)
        collision=hits(cylinder(3,12,matrix),parts)
        assert not collision,('Solder pad access',x,y,collision)
        pad_access.append({'local_xy_mm':[x,y],'diameter_mm':3,'length_mm':12,'hits':collision})
    report={'configuration':'enclosure' if ENCLOSURE else 'bench','status':'nominal CAD only',
        'measured_envelope_mm':[50,30,17],'mounting_pitch_mm':[45,24],'hole_diameter_mm':3,
        'full_measured_envelope_hits':envelope_hits,
        'board_and_support_probes':probes,'shifted_hole_controls':controls,
        'driver_access':access,'bolt_paths':paths,'removal':removal,'solder_pad_access':pad_access,
        'original_position_control':old_position_control,
        'limits':'PCB thickness, fasteners, component detail and pad positions nominal; no physical fit, wiring, electrical or thermal acceptance.'}
    (ROOT/'converter-check.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PASS converter: measured envelope, four bores/screw stacks, insertion/removal, four drivers and four pad-access envelopes; shifted-hole controls detected.',flush=True)

if __name__=='__main__':main()
