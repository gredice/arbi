"""Render assembly illustrations from the exported STL files, using VTK >=9.4."""
from pathlib import Path
import json,math
import numpy as np
import vtk

ROOT=Path(__file__).resolve().parents[1]
FIGS=ROOT/'figures'
FIGS.mkdir(exist_ok=True)
WHITE=(.88,.91,.93); BLUE=(.29,.66,.87); STEEL=(.66,.70,.73); DARK=(.24,.29,.33)
W=246.9
cache={}
manifest={}
registry=json.loads((ROOT/'source/arbi-hardware/models.json').read_text())
outputs={m['id']:m['output'] for m in registry['models']}

def T(x=0,y=0,z=0):
    m=np.eye(4);m[:3,3]=[x,y,z];return m
def R(axis,angle):
    a=np.deg2rad(angle);c,s=np.cos(a),np.sin(a);m=np.eye(4)
    if axis=='x':m[:3,:3]=[[1,0,0],[0,c,-s],[0,s,c]]
    elif axis=='y':m[:3,:3]=[[c,0,s],[0,1,0],[-s,0,c]]
    else:m[:3,:3]=[[c,-s,0],[s,c,0],[0,0,1]]
    return m
DR=T(z=80)@R('y',90)@R('z',180)

def A(name,m=None,c=WHITE):return {'file':'models/arbi/'+outputs['winch-'+name],'matrix':(np.eye(4) if m is None else m).tolist(),'color':c}
def H(name,m=None,c=STEEL):return {'file':f'models/reference/{name}.stl','matrix':(np.eye(4) if m is None else m).tolist(),'color':c}
def transform(items,m):
    return [{**p,'matrix':(m@np.array(p['matrix'])).tolist()} for p in items]

def drum_parts(explode=0,clamp=True,tail=True,hardware=True,shaft=False):
    parts=[A('drum-flange',T(z=-explode)),
      A('drum-passive-1',T(z=6)),
      A('drum-passive-2',T(z=6+W/2+explode),BLUE),
      A('drum-flange-right',T(z=W+12+2*explode)@R('x',180))]
    for i in range(3):parts.append(A('drum-alignment-pin',T(26,0,6+i*W/2-4+i*explode),BLUE))
    if clamp:
        for a in [0,180]:parts.append(A('drum-clamp-half',T(z=W+12+2*explode)@R('z',a),BLUE))
    if tail:parts.append(A('drum-tail-clamp',T(-14,49,W+12+2*explode),BLUE))
    if hardware:
        for angle in [0,115,240]:
            x,y=39*math.cos(math.radians(angle)),39*math.sin(math.radians(angle))
            parts.append(H('tie-rod-M5x280',T(x,y,-9)))
            for z in [-1,W+12]:parts.append(H('washer-M5',T(x,y,z)))
            parts.append(H('nyloc-M5',T(x,y,-6)))
            parts.append(H('nyloc-M5',T(x,y,W+13)))
    if shaft:parts.append(H('shaft-8x340',T(z=-27.1)))
    return parts

def clamp_hardware():
    out=[]
    for x in [-26,26]:
        for y in [-9,9]:
            out.extend([H('bolt-M4x25',T(x,y,W+5.2)),H('washer-M4',T(x,y,W+5.2)),
              H('washer-M4',T(x,y,W+18)),H('nyloc-M4',T(x,y,W+18.8))])
    for x in [-12,12]:
        out.extend([H('bolt-M4x45',T(x,16.8,W+25)@R('x',90)),
          H('washer-M4',T(x,16.8,W+25)@R('x',90)),
          H('washer-M4',T(x,-16,W+25)@R('x',90)),
          H('nyloc-M4',T(x,-16.8,W+25)@R('x',90))])
    return out

def rings(c=STEEL,explode=0):
    out=[]
    for name,x in [('bearing-608',-9),('bearing-608',W+34),('inner-ring-spacer',-11),
                   ('inner-ring-spacer',W+41),('shaft-collar-8',-21),('shaft-collar-8',W+43)]:
        xx=x-explode if x<0 else x+explode
        out.append(H(name,T(xx,0,80)@R('y',90),c))
    return out

def supports(caps=True,cap_lift=0,motor=True,bolts=False):
    out=[H('base-plate-passive',c=(.85,.87,.89)),A('bearing-lower',T(-5.5)),
      A('bearing-lower',T(W+37.5)@R('z',180))]
    if caps:
        for x in [-5.5,W+37.5]:out.append(A('bearing-cap',T(x,0,80.2+cap_lift),BLUE if cap_lift else WHITE))
    if motor:out.append(A('motor-stand',T(W+93)))
    if bolts:
        for x,ys in [(-21.5,[-40,40]),(W+53.5,[-40,40]),(W+113,[-44,44]),(W+155,[-44,44])]:
            for y in ys:
                out.extend([H('bolt-M6x30',T(x,y,9.6)@R('x',180)),H('washer-M6',T(x,y,8)),
                  H('washer-M6',T(x,y,-9.6)),H('nyloc-M6',T(x,y,-15.6))])
    return out

def coupling(explode=0,c=STEEL):
    m=T(W+56,0,80)@R('y',90)
    return [H('coupling-hub',m@T(z=-explode),c),H('coupling-spider',m@T(z=8.1),BLUE),
      H('coupling-hub',m@T(z=25+explode)@R('x',180)@R('z',60),c)]

def motor_hardware():
    out=[]
    face=W+93
    for y in [-23.57,23.57]:
        for z in [-23.57,23.57]:
            # Representative M4 through-screws: head on motor flange, nut on stand.
            out.extend([H('bolt-M4x25',T(face+8.8,y,80+z)@R('y',-90)),
                H('washer-M4',T(face+8,y,80+z)@R('y',90)),
                H('washer-M4',T(face-8,y,80+z)@R('y',-90)),
                H('nyloc-M4',T(face-8.8,y,80+z)@R('y',-90))])
    return out

def cover_hardware():
    out=[]
    face=W+93
    for y in [-38.5,38.5]:
        for z in [-20,20]:
            out.extend([H('bolt-M4x20',T(face-12.8,y,80+z)@R('y',90)),
                H('washer-M4',T(face-12.8,y,80+z)@R('y',90)),
                H('washer-M4',T(face,y,80+z)@R('y',90)),
                H('nyloc-M4',T(face+.8,y,80+z)@R('y',90))])
    return out


def full(guard=False,feet=False):
    out=supports(bolts=True)+motor_hardware()+transform(drum_parts(shaft=True)+clamp_hardware(),DR)+rings()+coupling()
    out.append(H('motor-23HS40-reference',T(W+93,0,80)@R('y',90),DARK))
    if guard:
        out.append(A('coupling-guard',T(W+85,0,80)@R('y',-90),BLUE))
        out+=cover_hardware()
    if feet:
        out+=desk_feet()
        for x in [98.45,148.45]:
            for y in [-60,60]:out.extend([H('bolt-M8x35',T(x,y,1.6)@R('x',180)),H('washer-M8',T(x,y,0)),H('washer-M8',T(x,y,-17.6)),H('nyloc-M8',T(x,y,-25.6))])
    return out

def desk_feet(drop=0):
    out=[]
    for y in [-60,60]:
        out.append(A('desk-foot-short',T(98.45,y,-43-drop)@R('z',180)@T(-22,-30),BLUE))
        out.append(A('desk-foot-long',T(148.45,y,-43-drop)@T(-22,-30),BLUE))
    return out

def polydata(file):
    if file not in cache:
        read=vtk.vtkSTLReader();read.SetFileName(str(ROOT/file));read.Update()
        cache[file]=read.GetOutput()
    return cache[file]

def render(name,parts,direction=(.55,-1,.65),up=(0,0,1),size=(1500,950),anchors=None,fit_bounds=None):
    ren=vtk.vtkRenderer();ren.SetBackground(1,1,1)
    win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetSize(*size);win.SetMultiSamples(8);win.AddRenderer(ren)
    bounds=[]
    for part in parts:
        pd=polydata(part['file']);matrix=vtk.vtkMatrix4x4()
        mm=np.array(part['matrix'])
        for i in range(4):
            for j in range(4):matrix.SetElement(i,j,mm[i,j])
        mapper=vtk.vtkPolyDataMapper();mapper.SetInputData(pd)
        mapper.SetResolveCoincidentTopologyToPolygonOffset()
        actor=vtk.vtkActor();actor.SetMapper(mapper);actor.SetUserMatrix(matrix)
        prop=actor.GetProperty();prop.SetColor(*part['color']);prop.SetAmbient(.35);prop.SetDiffuse(.65);prop.SetSpecular(.08);prop.SetSpecularPower(18)
        prop.SetInterpolationToFlat();ren.AddActor(actor)
        edges=vtk.vtkFeatureEdges();edges.SetInputData(pd);edges.BoundaryEdgesOn();edges.FeatureEdgesOn();edges.SetFeatureAngle(34);edges.NonManifoldEdgesOff();edges.ManifoldEdgesOff();edges.Update()
        em=vtk.vtkPolyDataMapper();em.SetInputConnection(edges.GetOutputPort());em.ScalarVisibilityOff()
        ea=vtk.vtkActor();ea.SetMapper(em);ea.SetUserMatrix(matrix);ea.GetProperty().SetColor(.17,.21,.24);ea.GetProperty().SetLineWidth(1.1);ren.AddActor(ea)
        b=pd.GetBounds()
        pts=np.array([[x,y,z,1] for x in b[:2] for y in b[2:4] for z in b[4:6]])
        if part.get('fit',True):bounds.extend((mm@pts.T).T[:,:3])
    bounds=np.array(bounds if fit_bounds is None else fit_bounds);center=(bounds.max(0)+bounds.min(0))/2
    d=np.array(direction,dtype=float);d/=np.linalg.norm(d);u=np.array(up,dtype=float)
    right=np.cross(-d,u);right/=np.linalg.norm(right);vertical=np.cross(right,-d)
    xs=(bounds-center)@right;ys=(bounds-center)@vertical
    scale=max(np.ptp(ys)/2,np.ptp(xs)/2/(size[0]/size[1]))*1.13
    camera=ren.GetActiveCamera();camera.ParallelProjectionOn();camera.SetFocalPoint(*center);camera.SetPosition(*(center+d*2000));camera.SetViewUp(*up);camera.SetParallelScale(scale)
    ren.ResetCameraClippingRange();win.Render()
    projection={}
    for label,xyz in (anchors or {}).items():
        ren.SetWorldPoint(*xyz,1);ren.WorldToDisplay();p=ren.GetDisplayPoint();projection[label]=[p[0]/size[0],p[1]/size[1]]
    capture=vtk.vtkWindowToImageFilter();capture.SetInput(win);capture.ReadFrontBufferOff();capture.Update()
    writer=vtk.vtkPNGWriter();writer.SetFileName(str(FIGS/(name+'.png')));writer.SetInputConnection(capture.GetOutputPort());writer.Write()
    manifest[name]={'parts':parts,'anchors':projection,'size':list(size)}
    win.Finalize()
    print('Rendered '+name,flush=True)

def main():
    render('finished',full(guard=True,feet=True),size=(1800,1000))
    for name in ['drum-passive-1','drum-passive-2','drum-flange','drum-flange-right','drum-clamp-half',
      'drum-tail-clamp','drum-alignment-pin','bearing-lower','bearing-cap','motor-stand','coupling-guard',
      'desk-foot-short','desk-foot-long']:
        render('part-'+name,[A(name)],direction=(1,-1,.9),size=(650,480))
    for name in ['motor-23HS40-reference','bearing-608','inner-ring-spacer','shaft-collar-8','shaft-8x340',
      'tie-rod-M5x280','base-plate-passive','bolt-M4x25','nyloc-M4','washer-M4','nut-M5']:
        mat=R('y',90) if name in ['motor-23HS40-reference','shaft-8x340','tie-rod-M5x280'] else np.eye(4)
        render('ref-'+name,[H(name,mat)],direction=(.5,-1,.7),size=(700,480))
    render('coupling-parts',coupling(explode=10),direction=(.25,-1,.6),size=(1000,450))
    render('drum-exploded',transform(drum_parts(explode=32,clamp=False,tail=False,hardware=False),R('y',90)),direction=(-.45,-1,.7),size=(1800,800))
    render('drum-endface',[A('drum-passive-1')],direction=(0,0,1),up=(0,1,0),size=(650,650),anchors={'pin':[26,0,123.45]})
    prep=[A('drum-flange-right',R('x',180))]
    for x in [-26,26]:
        for y in [-9,9]:prep.extend([H('bolt-M4x25',T(x,y,-6.8)),H('washer-M4',T(x,y,-6.8))])
    render('flange-preload',prep,direction=(.6,-1,.65),size=(1000,700))
    render('tie-rods',transform(drum_parts(clamp=False,tail=False),R('y',90)),direction=(-.4,-1,.75),size=(1500,700))
    render('rod-hardware',[H('tie-rod-M5x280',R('y',90)),H('washer-M5',T(-12)@R('y',90)),H('nyloc-M5',T(-24)@R('y',90)),H('washer-M5',T(291)@R('y',90)),H('nyloc-M5',T(303)@R('y',90))],direction=(.15,-1,.55),size=(1600,330))
    rc=[A('drum-flange-right',R('x',180)),{**H('shaft-8x340',T(z=-310)),'fit':False}]
    halves=[A('drum-clamp-half',T(y=15,z=18),BLUE),A('drum-clamp-half',T(y=-15,z=18)@R('z',180),BLUE)]
    render('clamp-exploded',rc+halves,direction=(1,-1,.85),size=(1300,900))
    clamp=[A('drum-flange-right',R('x',180)),A('drum-clamp-half'),A('drum-clamp-half',R('z',180)),{**H('shaft-8x340',T(z=-310)),'fit':False}]
    clamp+=transform(clamp_hardware(),T(z=-W-12))
    render('clamp-complete',clamp,direction=(.9,-1,1.4),size=(1300,900))
    render('base-supports',supports(caps=False,bolts=True),direction=(.55,-1,.9),size=(1700,850))
    p=[A('bearing-lower'),A('bearing-cap',T(z=113),BLUE),H('bearing-608',T(-3.5,0,80)@R('y',90))]
    for y in [-18,18]:p.extend([H('nut-M5',T(-16,y,67.25),BLUE),H('bolt-M5x35',T(0,y,155)@R('x',180)),H('washer-M5',T(0,y,134))])
    render('bearing-exploded',p,direction=(-1,-1,.7),size=(1100,900))
    moving=transform(drum_parts(shaft=True)+clamp_hardware(),DR)+rings()
    render('shaft-drop',supports(caps=False,motor=False)+transform(moving,T(z=65)),direction=(.25,-1,.55),size=(1750,900))
    render('shaft-seated',supports(cap_lift=42,motor=False)+moving,direction=(.35,-1,.8),size=(1700,800))
    render('left-stack',[H('shaft-collar-8',T(-44,0,80)@R('y',90)),H('inner-ring-spacer',T(-23,0,80)@R('y',90)),H('bearing-608',T(-9,0,80)@R('y',90)),A('drum-flange',DR),{**H('shaft-8x340',T(-27.1,0,80)@R('y',90)),'fit':False}],direction=(.1,-1,.65),size=(1500,600))
    motor=[A('motor-stand',T(W+93)),H('motor-23HS40-reference',T(W+93,0,80)@R('y',90),DARK)]+motor_hardware()
    render('motor-mount',motor,direction=(-.65,-1,.6),size=(1200,800))
    # Local cutaway-style gap view: the true 340 mm shaft and motor are cropped by camera in the PDF.
    render('motor-coupling',full(guard=False),direction=(.1,-1,.45),size=(1850,650))
    close=[A('bearing-lower',T(W+37.5)@R('z',180)),A('bearing-cap',T(W+37.5,0,80.2)),
      A('motor-stand',T(W+93)),H('motor-23HS40-reference',T(W+93,0,80)@R('y',90),DARK)]
    close+=motor_hardware()+coupling()+[H('inner-ring-spacer',T(W+41,0,80)@R('y',90)),H('shaft-collar-8',T(W+43,0,80)@R('y',90))]
    render('coupling-close',close,direction=(-.3,-1,.65),size=(1400,850))
    gap_parts=[H('shaft-8x340',T(-27.1,0,80)@R('y',90)),H('motor-23HS40-reference',T(W+93,0,80)@R('y',90))]
    render('shaft-tip-gap',gap_parts,direction=(0,-1,0),size=(1200,450),fit_bounds=[[300,-8,69],[331,8,91]],anchors={'left':[312.9,0,80],'right':[317.9,0,80]})
    tail=[A('drum-flange-right',R('x',180)),A('drum-clamp-half'),A('drum-clamp-half',R('z',180)),A('drum-tail-clamp',T(-14,49,18),BLUE)]
    for x in [-9,9]:tail.append(H('bolt-M4x25',T(x,55,41)@R('x',180)))
    render('tail-location',tail,direction=(.4,-1,1.7),size=(1100,1000))
    render('tail-underside',[A('drum-tail-clamp',R('x',180),BLUE)],direction=(.65,-1,.9),size=(900,550))
    route=[A('drum-flange-right',R('x',180)),A('drum-clamp-half'),A('drum-clamp-half',R('z',180)),A('drum-tail-clamp',T(86,55,6)@R('x',180),BLUE)]
    render('tail-routing',route,direction=(0,0,1),up=(0,1,0),size=(1500,950),anchors={str(i):p for i,p in enumerate([(0,72,1),(0,63,1),(22,63,1),(22,58,1),(-20,58,1),(-24,55,1),(-20,52,1),(22,52,1),(-14,49,1),(14,61,1)])})
    guard=[A('coupling-guard',T(W+85,0,135)@R('y',-90),BLUE)]+close
    render('guard-fit',guard,direction=(-.7,-1,.5),size=(1500,1000))
    render('guard-underside',[A('coupling-guard',R('x',180),BLUE)],direction=(-.8,-1,.65),size=(900,650))
    render('guard-installed',[A('coupling-guard',T(W+85,0,80)@R('y',-90),BLUE)]+close+cover_hardware(),direction=(-.65,-1,.4),size=(1350,800))
    render('feet-install',[H('base-plate-passive')]+desk_feet(drop=22),direction=(.4,-1,.55),size=(1800,800))
    render('feet-final',full(guard=True,feet=True),direction=(-.25,-1,.7),size=(1800,1000))
    (ROOT/'figure-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (ROOT/'tail-routing-anchors.json').write_text(json.dumps(manifest['tail-routing']['anchors'])+'\n')
    (ROOT/'shaft-gap-anchors.json').write_text(json.dumps(manifest['shaft-tip-gap']['anchors'])+'\n')

if __name__=='__main__':main()
