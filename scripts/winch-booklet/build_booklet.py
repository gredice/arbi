"""Build the corrected A4 assembly booklet from STL-rendered illustrations."""
from pathlib import Path
import json,math
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor,white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph,Table,TableStyle
from reportlab.lib.utils import ImageReader

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'ARBI-winch-assembly-STL.pdf'
pdfmetrics.registerFont(TTFont('ARBI',str(ROOT/'source/fonts/DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('ARBI-Bold',str(ROOT/'source/fonts/DejaVuSans-Bold.ttf')))
pdfmetrics.registerFontFamily('ARBI',normal='ARBI',bold='ARBI-Bold',italic='ARBI',boldItalic='ARBI-Bold')
C=canvas.Canvas(str(OUT),pagesize=(210*mm,297*mm))
C.setTitle('ARBI winch and drum - STL-based assembly booklet')
C.setAuthor('ARBI / Gredice')
ROUTE=HexColor('#a8b3ba');BLUE=HexColor('#20282d');INK=HexColor('#15232d');GRAY=HexColor('#53616a');LINE=HexColor('#d3dfe6')
STYLE=ParagraphStyle('body',fontName='ARBI',fontSize=10,leading=13,textColor=INK,spaceAfter=0)
SMALL=ParagraphStyle('small',parent=STYLE,fontSize=8.5,leading=11)
PAGE=0

def text(x,y,s,size=10,bold=False,color=INK):
    C.setFillColor(color);C.setFont('ARBI-Bold' if bold else 'ARBI',size);C.drawString(x*mm,(297-y)*mm,s)
def para(x,y,w,s,small=False,max_h=None):
    p=Paragraph(s,SMALL if small else STYLE);_,h=p.wrap(w*mm,1000)
    if max_h is not None:assert h<=max_h*mm,(s,h/mm,max_h)
    p.drawOn(C,x*mm,(297-y)*mm-h);return h/mm
def line(x,y,x2,y2,color=LINE,width=.5):
    C.setStrokeColor(color);C.setLineWidth(width);C.line(x*mm,(297-y)*mm,x2*mm,(297-y2)*mm)
def box(x,y,w,h,fill='#f3f3f0'):
    C.setFillColor(HexColor(fill));C.setStrokeColor(LINE);C.setLineWidth(.5);C.roundRect(x*mm,(297-y-h)*mm,w*mm,h*mm,2*mm,fill=1,stroke=1)
def fig(name,x,y,w,h):
    from PIL import Image
    path=ROOT/'figures'/(name+'.png');im=Image.open(path);iw,ih=im.size
    scale=min(w/iw,h/ih);ww,hh=iw*scale,ih*scale;xx=x+(w-ww)/2;yy=y+(h-hh)/2
    C.drawImage(str(path),xx*mm,(297-yy-hh)*mm,ww*mm,hh*mm)
    return xx,yy,ww,hh
def arrow(x,y,x2,y2,color=BLUE):
    line(x,y,x2,y2,color,1.4);a=math.atan2(y2-y,x2-x)
    for off in [-.55,.55]:line(x2,y2,x2-3*math.cos(a+off),y2-3*math.sin(a+off),color,1.4)
def step(n,x,y,title,body,w=178):
    C.setFillColor(BLUE);C.circle((x+3.5)*mm,(297-y-3.5)*mm,3.5*mm,fill=1,stroke=0)
    text(x+2.35,y+4.65,str(n),10,True,white)
    text(x+10,y+5,title,12,True)
    if body:para(x+10,y+10,w-10,body)
def note(y,s):
    box(16,y,178,21);para(20,y+4,170,s,small=True,max_h=15)
def begin(title,subtitle=''):
    global PAGE
    if PAGE:C.showPage()
    PAGE+=1
    text(16,17,'ARBI',22,True,BLUE);text(43,17,'WINCH & DRUM',15,True)
    text(153,15,'PASSIVE / COVER KIT',7,True,GRAY)
    line(16,23,194,23,BLUE,.8)
    text(16,35,title,20,True)
    if subtitle:para(16,39,178,subtitle,small=True,max_h=12)
    line(16,284,194,284,BLUE,.7)
    text(16,290,'ARBI | Mechanical bench assembly | Revision 5 | 07 Oct 2026',7,color=GRAY)
    text(176,290,f'{PAGE:02d} / 18',8,True,GRAY)

begin('Build the actual parts','Passive-line winch: two drum sections, 340 mm shaft, 550 x 180 mm base. The passive-line winch still has a motor.')
fig('cover-passive-installed',10,56,190,124)
text(16,192,'REAL GEOMETRY, STEP BY STEP',12,True,BLUE)
para(16,200,178,'Every 3D illustration is rendered from the supplied STL meshes. ARBI prints are exported unchanged from the source CAD; bought hardware is represented by clearly labelled reference models.')
box(16,224,178,35)
para(21,229,168,'<b>What is corrected</b><br/>Grooved hollow drum sections and their three ribs; flat handed flanges; one alignment pin at each joint; the actual split clamp, offset bearing supports and motor stand.',max_h=28)
para(16,266,178,'Build unpowered first. This booklet covers assembly and hand-spin checks. CAD, desk feet and full cover remain concept-unvalidated. Cover installation follows on pages 15-18; loaded tests require a separate checked setup.',small=True,max_h=15)

begin('01  Printed parts','For one passive winch. Each picture is the actual STL; pictures use independent scales. Print/export file names are listed in the model pack.')
items=[('drum-passive-1','P01  Passive section 1','1 x / one recessed dot'),('drum-passive-2','P02  Passive section 2','1 x / two recessed dots'),('drum-flange','P03  Left flange','1 x'),('drum-flange-right','P04  Right flange','1 x / handed part'),('drum-clamp-half','P05  Shaft clamp half','2 x / identical prints'),('drum-tail-clamp','P06  Line tail clamp','1 x / two underside channels'),('drum-alignment-pin','P07  Alignment pin','3 x / one per joint'),('bearing-lower','P08  Bearing lower','2 x / feet face outward'),('bearing-cap','P09  Bearing cap','2 x'),('motor-stand','P10  Motor stand','1 x'),('coupling-guard','P11  Coupling cover','1 x / revision 0.1.1')]
for i,(name,title,count) in enumerate(items):
    col,row=i%3,i//3;x=16+col*61;y=58+row*50
    fig('part-'+name,x,y,56,34);text(x,y+39,title,9,True);text(x,y+45,count,8,color=GRAY)
box(138,208,56,48)
para(142,214,48,'<b>Desk feet are optional</b><br/>Two short + two long.<br/>See page 13.<br/><br/>Powered drum sections are in the ZIP, but are not used here.',small=True,max_h=38)
note(263,'Deburr holes, locating sockets and mating faces. Dry-fit the shaft and bearings. The drum groove must stay continuous across the middle joint.')

begin('02  Bought parts','Reference STLs describe the hardware for these illustrations. They are not printed replacements for bearings, shafts, fasteners, the motor or coupling.')
items=[('ref-motor-23HS40-reference','H01  Motor','1 x / 23HS40 reference'),('ref-bearing-608','H02  608 bearing','2 x / 8 x 22 x 7 mm'),('ref-inner-ring-spacer','H03  Inner-ring spacer','2 x / 8.2 ID, 11 OD, 2 thick'),('ref-shaft-collar-8','H04  Shaft collar','2 x / 8 mm bore'),('coupling-parts','H05  Jaw coupling','1 set / two hubs + spider'),('ref-shaft-8x340','H06  Drum shaft','1 x / dia 8, nominal 340 mm'),('ref-tie-rod-M5x280','H07  Drum tie rods','3 x / M5, nominal 280 mm'),('ref-base-plate-passive','H08  Aluminium plate','1 x / 550 x 180 x 8 mm'),('ref-bolt-M4x25','H09  Fasteners','See complete table, page 14')]
for i,(name,title,count) in enumerate(items):
    x=16+(i%3)*61;y=59+(i//3)*55
    fig(name,x,y,56,37);text(x,y+42,title,9,True);para(x,y+46,57,count,small=True,max_h=10)
note(229,'The motor body/shaft envelope follows the supplier specification. Mounting pitch and pilot, collar outline and coupling internals are nominal. Match the received hardware before tightening.')
para(16,259,178,'Keep steel spacers on the bearing <b>inner rings</b>. Ordinary large washers may rub bearing seals or the housing. M5 nuts inside the bearing lowers must be plain nuts, not tall nylocs.',max_h=20)

begin('03  Key the drum sections','Do not turn either body section over. The right flange is a separate handed print, turned over so its locating socket faces inward.')
fig('drum-exploded',10,54,190,95)
text(18,151,'LEFT FLANGE',8,True);text(61,151,'SECTION 1',8,True);text(105,151,'SECTION 2',8,True);text(153,151,'RIGHT FLANGE',8,True)
arrow(49,155,57,155);arrow(91,155,101,155);arrow(139,155,149,155)
fig('drum-endface',16,168,78,79)
step(1,102,168,'Find the dot marks','Section 1 has one recessed dot; section 2 has two. Keep the body sections in their original print orientation.',w=92)
step(2,102,207,'Use one pin per joint','Three pins total: left flange / section 1, section 1 / section 2, section 2 / right flange.',w=92)
note(260,'The tie-rod pattern is asymmetric: 0, 115 and 240 degrees. All three rod holes and ribs must align without forcing. Do not try to rotate a section by 120 degrees.')

begin('04  Close and tie the drum','Keep the end faces flush. Tighten the three tie rods progressively, alternating between them.')
step(1,16,54,'Preload four clamp-foot screws','Before closing the drum, feed four M4 x 25 screws and washers through the right flange from its inside face. Their shafts point outward toward the split clamp.')
fig('flange-preload',36,84,138,78)
text(20,166,'4 x M4 x 25 + 4 washers, inserted before closing',9,True,BLUE)
step(2,16,175,'Fit the tie rods','Pass three M5 x 280 rods through the complete stack. Put one M5 washer and one M5 locknut at each end: six washers and six nuts total.')
fig('tie-rods',10,205,190,53)
note(261,'Faces should close flush without crushing the prints. No validated tightening torque is specified. Recheck the groove seam and all three joints before fitting the shaft clamp.')

begin('05  Clamp the shaft','The clamp is two identical rectangular halves. Rotate the second half 180 degrees around the shaft; do not substitute a single collar.')
fig('clamp-exploded',14,54,88,106);fig('clamp-complete',107,54,89,106)
text(18,166,'BRING THE TWO HALVES TOGETHER',8.5,True,BLUE)
text(111,166,'CLAMP FIRST, FEET SECOND',8.5,True,BLUE)
step(1,16,179,'Slide in the 8 mm shaft','Pass the shaft through the drum and leave it movable while fitting the two clamp halves onto the four preloaded flange screws.')
step(2,16,214,'Tighten the cross-bolts first','Use two M4 x 45 bolts, four washers and two metal locknuts. Tighten evenly to grip the shaft. Keep the designed split gap; do not force the halves fully shut.')
para(26,249,168,'Then secure the four clamp feet with four additional M4 washers and four locknuts. The shaft continues out of view in these close-ups.',max_h=17)
para(16,265,178,'For the 340 mm shaft, start with about 27 mm projecting beyond the non-motor flange; verify final coupling engagement on page 10. Fit the tail clamp on page 11.',small=True,max_h=15)

begin('06  Prepare the base supports','Use the drilling template at 100% / actual size. The long feet of both bearing lowers must point outward, away from the drum.')
fig('base-supports',10,53,190,80)
text(16,140,'8 x M6 x 30  /  16 washers  /  8 locknuts',10,True,BLUE)
para(16,147,178,'Attach both bearing lowers and the motor stand loosely. Their slots provide alignment travel; keep them free to move until the shaft rotates freely.')
fig('bearing-exploded',11,173,98,100)
step(1,112,175,'Insert the plain nuts','Slide two plain M5 nuts into the side windows of each bearing lower before fitting its cap.',w=82)
step(2,112,216,'Keep caps loose','Each cap uses two M5 x 35 screws and two washers. Add the bearing/shaft assembly first, then the caps on page 8.',w=82)
para(112,258,82,'The right lower is the same print rotated 180 degrees around the vertical axis.',small=True,max_h=19)

begin('07  Place the shaft assembly','Slide both bearings, steel spacers and collars onto the shaft before closing the bearing caps. Keep collars loose initially.')
fig('shaft-drop',10,51,190,82)
arrow(108,91,108,110)
text(16,142,'LOWER BOTH BEARINGS INTO THEIR OPEN SEATS',10,True,BLUE)
para(16,149,178,'Place the complete drum and shaft on the two bearing lowers. The bearings sit in the circular seats; the drum flanges and clamp stay clear of both supports.')
fig('shaft-seated',10,178,190,77)
note(261,'Fit both caps using four M5 x 35 screws and four washers into the previously inserted plain nuts. Tighten gently and evenly. The 0.4 mm design split is not a reason to crush the housing shut.')

begin('08  Set collars and alignment','Spacers and collars sit outside the two bearings, away from the drum. Leave slight axial freedom; do not preload the bearings.')
fig('left-stack',10,55,190,88)
text(16,149,'NON-MOTOR END: collar > spacer > bearing > flange',10,True,BLUE)
para(16,157,178,'The thin spacer must contact only the bearing inner ring. Keep its outer edge clear of the bearing seal and printed housing. The collar locks to the shaft; it must not clamp the housing.')
box(16,186,178,28)
para(21,191,168,'<b>MOTOR END</b><br/>Drum / split shaft clamp > bearing > 2 mm spacer > shaft collar > coupling.',max_h=20)
step(1,16,225,'Align the bearing lowers','Turn the shaft by hand while adjusting the M6 slots. Tighten base bolts progressively and check rotation again after each adjustment.')
para(26,260,168,'Stop if you feel scraping, binding or a notchy bearing. Reposition the support or collar before continuing.',max_h=18)

begin('09  Align motor and coupling','Install the motor with its shaft toward the drum. The coupling connects aligned shafts; do not use it to pull misaligned mounts together.')
fig('motor-mount',13,54,90,79);fig('coupling-parts',110,54,86,79)
para(16,139,86,'<b>Motor mounting</b><br/>Fit four fasteners matched to the received motor flange. M4 x 25 is only the repository allowance; verify hole type and engagement.',small=True,max_h=31)
para(110,139,84,'<b>Coupling</b><br/>Place one hub on each shaft and the elastomer spider between them. Seat and lock the hubs according to the actual coupling.',small=True,max_h=31)
fig('coupling-close',12,174,186,55)
rect=fig('shaft-tip-gap',36,232,138,29)
a=json.loads((ROOT/'shaft-gap-anchors.json').read_text());x,y,w,h=rect
lx=x+a['left'][0]*w;rx=x+a['right'][0]*w;yy=y+h-a['left'][1]*h
line(lx,yy-5,lx,yy-9,BLUE,.8);line(rx,yy-5,rx,yy-9,BLUE,.8);line(lx,yy-8,rx,yy-8,BLUE,.8)
text((lx+rx)/2-7,yy-10,'5 mm',9,True,BLUE)
para(16,265,178,'Nominal CAD setup: about 10 mm shaft engagement at each coupling end, leaving 5 mm between shaft tips. Verify actual hub/spider geometry. <b>The shaft tips must not touch.</b>',small=True,max_h=15)

begin('10  Secure the line tail','Fit the tail clamp on the outside of the right flange. It grips two bare Dyneema legs in its underside channels.')
rect=fig('tail-routing',10,51,190,106)
a=json.loads((ROOT/'tail-routing-anchors.json').read_text());x,y,w,h=rect
pts=[(x+a[str(i)][0]*w,y+h-a[str(i)][1]*h) for i in range(8)]
C.setLineJoin(1)
for p,q in zip(pts,pts[1:]):line(*p,*q,ROUTE,1.8)
arrow(*pts[-2],*pts[-1],color=ROUTE)
tl=(x+a['8'][0]*w,y+h-a['8'][1]*h);br=(x+a['9'][0]*w,y+h-a['9'][1]*h)
C.setDash(2,2);line(tl[0],tl[1],br[0],tl[1],ROUTE,.8);line(br[0],tl[1],br[0],br[1],ROUTE,.8);line(br[0],br[1],tl[0],br[1],ROUTE,.8);line(tl[0],br[1],tl[0],tl[1],ROUTE,.8);C.setDash()
para(16,162,178,'Route over the end margin and through the rim notch, then double back through both clamp channels. The silver overlay shows the two legs and return loop; the clamp is moved aside to show its underside.',small=True,max_h=19)
para(16,184,178,'Use two M4 x 25 screws, four washers and two locknuts. Smooth the notch and channels. Keep at least <b>three reserve wraps</b> on the drum at maximum payout.',small=True,max_h=18)
fig('tail-underside',18,207,77,53)
para(108,218,84,'The two shallow channels on the clamp underside carry the outgoing and returning bare line. Keep the line clear of screw holes.',small=True,max_h=35)
note(261,'Finish the line termination and confirm free hand rotation before fitting the revised coupling cover on the next page.')

begin('11  Fit the revised coupling cover','Reprint P11 only: winch-coupling-guard-r0.1.1.stl. The existing motor stand and its four cover mounting holes remain compatible.')
fig('guard-fit',10,51,190,104)
text(16,159,'WIDER MOTOR END CLEARS THE FOUR FASTENER STACKS',10,True,BLUE)
para(16,167,178,'Tighten and align the motor first. Lower the cover over the coupling with its open underside downward; the widened end faces the motor stand. The drawing includes representative motor screws, washers and nuts.',small=True,max_h=19)
fig('guard-underside',12,190,86,53);fig('guard-installed',105,190,91,53)
para(16,247,178,'<b>Check your hardware:</b> maximum 12 mm across each motor fastener stack and 14 mm projection from the coupling-side stand face, including screw tips. The recess adds 1 mm clearance and allows the full +/-2 mm vertical slot adjustment.',small=True,max_h=20)
para(16,270,178,'Use four M4 x 20 cover screws, eight 9 mm OD washers and four locknuts. Seat the flange without force. The revised print still needs a physical fit check.',small=True,max_h=12)

begin('12  Desk feet and final checks','Optional desk setup for the passive base. The four existing post holes take the feet; there are no new holes to drill.')
fig('feet-install',10,51,190,76)
text(16,135,'2 SHORT FEET: away from motor',10,True,BLUE)
text(16,143,'2 LONG FEET: toward motor',10,True,BLUE)
para(16,150,178,'Use four M8 x 35 bolts, eight standard washers and four M8 locknuts on the 8 mm plate. Recess the nuts inside the feet. Plate underside is 35 mm above the desk; existing screws may protrude at most 25 mm.',small=True,max_h=20)
fig('feet-final',12,174,186,57)
checks=['All drum joints close flush; the groove is continuous.','Shaft turns freely; collars do not preload bearings.','Rods, nuts, flanges and clamp clear the supports through a full turn.','Motor shafts align; coupling has axial clearance; all feet sit flat.']
for i,s in enumerate(checks):
    yy=237+i*8
    C.setStrokeColor(BLUE);C.rect(16*mm,(297-yy-3)*mm,3*mm,3*mm,fill=0,stroke=1)
    para(22,yy-1,172,s,small=True,max_h=8)
para(16,274,178,'Complete these checks unpowered. Desk feet are not anchors for loaded cable tests.',small=True)

begin('13  Fasteners and model notes','Quantities below are for one passive winch. Nuts and washers are additional to the bolts or rods listed.')
rows=[['Location','Bolts / rods','Washers','Nuts'],
 ['Drum tie rods','3 x M5 x 280','6 x M5','6 x M5 lock'],
 ['Clamp feet to flange','4 x M4 x 25','8 x M4','4 x M4 lock'],
 ['Clamp cross-bolts','2 x M4 x 45','4 x M4','2 x M4 lock'],
 ['Line tail clamp','2 x M4 x 25','4 x M4','2 x M4 lock'],
 ['Bearing caps','4 x M5 x 35','4 x M5','4 x M5 plain'],
 ['Base supports + stand','8 x M6 x 30','16 x M6','8 x M6 lock'],
 ['Coupling cover','4 x M4 x 20','8 x M4','4 x M4 lock'],
 ['Motor to stand','4, match actual motor','As required','As required'],
 ['Optional desk feet','4 x M8 x 35','8 x M8','4 x M8 lock']]
t=Table(rows,colWidths=[56*mm,53*mm,31*mm,38*mm],rowHeights=[9*mm]+[8.5*mm]*9)
t.setStyle(TableStyle([('FONTNAME',(0,0),(-1,0),'ARBI-Bold'),('FONTNAME',(0,1),(-1,-1),'ARBI'),('FONTSIZE',(0,0),(-1,-1),8.5),('TEXTCOLOR',(0,0),(-1,-1),INK),('BACKGROUND',(0,0),(-1,0),HexColor('#e8e8e5')),('ROWBACKGROUNDS',(0,1),(-1,-1),[white,HexColor('#f6f6f4')]),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),5),('LINEBELOW',(0,0),(-1,0),.7,BLUE)]))
_,h=t.wrap(178*mm,1000);t.drawOn(C,16*mm,(297-55)*mm-h)
text(16,154,'MODEL PACK: 61 STL FILES',12,True,BLUE)
para(16,162,178,'<b>26 ARBI fabrication meshes</b> are exported from the bundled source CAD. The coupling cover is <b>revision 0.1.1</b>; the other fabrication models remain 0.1.0. Includes drum parts, mounts, coupling guard, desk feet and ten additional full-cover model IDs; use the quantities on page 15.',small=True,max_h=19)
para(16,185,178,'<b>35 reference meshes</b> cover bought hardware and the metal base plates. Their simplified threads, bearing internals, motor mounting details and coupling teeth are illustrative. They are not supplier-certified models or manufacturing replacements.',small=True,max_h=20)
para(16,210,178,'The source, STL hashes, dimensions and a manifest of every illustrated component are included. All exported meshes were checked for closed surfaces, consistent winding and positive volume. Geometry checks do not establish print fit or load capacity.',small=True,max_h=20)
para(16,235,178,'<b>Source references</b><br/>ARBI: github.com/gredice/arbi. Exact source files and SHA-256 hashes are included; see source-provenance.json.<br/>Motor: StepperOnline kit 4-CLYS30-V20, model 23HS40-5004D-E1000. Supplier body/shaft dimensions checked 27 Sep 2026; supplier STEP download was unavailable.',small=True,max_h=28)
C.linkURL('https://github.com/gredice/arbi',(16*mm,47*mm,120*mm,56*mm),relative=0)
para(16,269,178,'Powered-model STLs are included for completeness. This booklet assembles the passive-line version only; the longer powered base/shaft needs separate validation.',small=True,max_h=12)
begin('14  Full assembly cover','Added r0.1.0 kit under ADR-0007. Reuse the drivetrain and r0.1.1 coupling guard. Drill the extra base holes before fitting clips.')
fig('cover-passive-installed',10,52,190,58)
text(16,117,'PASSIVE: 3 MAIN PANELS + 2 PAYOUT SHUTTERS',10,True,BLUE)
fig('cover-powered-installed',10,127,190,58)
text(16,191,'POWERED: 5 MAIN PANELS + 4 PAYOUT SHUTTERS',10,True,BLUE)
rows=[['Added print','Passive','Powered'],['Left / middle / right main panels','1 / 1 / 1','1 / 3 / 1'],['Identical variant payout shutters','2','4'],['Identical dark base clips','12','20'],['Fixed-loom base anchor','1','1']]
t=Table(rows,colWidths=[114*mm,32*mm,32*mm],rowHeights=[8*mm]*5)
t.setStyle(TableStyle([('FONTNAME',(0,0),(-1,0),'ARBI-Bold'),('FONTNAME',(0,1),(-1,-1),'ARBI'),('FONTSIZE',(0,0),(-1,-1),9),('BACKGROUND',(0,0),(-1,0),HexColor('#e8e8e5')),('ROWBACKGROUNDS',(0,1),(-1,-1),[white,HexColor('#f6f6f4')]),('VALIGN',(0,0),(-1,-1),'MIDDLE')]))
_,h=t.wrap(178*mm,1000);t.drawOn(C,16*mm,(297-201)*mm-h)
para(16,247,178,'Main panels print on an axial seam; shutters on their outer face; clips and anchor on their base feet. Every release mesh starts at print Z=0 and fits inside 240 mm in each axis. Inspect supports, especially end walls and seam cuffs.',small=True,max_h=25)

begin('15  Clips, holes and fasteners','New holes only: keep all original bearing, motor-stand and post patterns. Base blanks stay 550 / 880 x 180 x 8 mm.')
fig('cover-base-drilling',10,52,190,62)
para(16,120,178,'<b>Clip holes, diameter 4.5 mm:</b> Y=+/-82. For each main panel i, X=-46+iP+16 and X=-46+(i+1)P-16. P=180.667 mm passive (i=0..2), or 174.4 mm powered (i=0..4).<br/><b>Anchor holes:</b> X=cover end-22+/-10, Y=-48. Cover end=496 / 826 mm. Total: 14 / 22 added holes. The older drilling template omits these.',small=True,max_h=35)
fig('cover-clip-detail',12,160,82,66)
para(104,164,90,'<b>Each clip</b><br/>M4 x 25 + two washers + locknut to base.<br/>M4 x 16 + washer to plain M4 nut slid in from the side.<br/>Use 9 mm OD washers and reviewed removable locking. Inspect supports under the raised stem and nut pocket.',small=True,max_h=53)
para(16,235,178,'<b>Per passive / powered kit:</b> 12 / 20 shell screws, plain nuts and washers; 14 / 22 base+anchor screws and locknuts; 28 / 44 base washers. Anchor uses two soft loom wraps. Buy separately from original winch fasteners.',small=True,max_h=23)
para(16,262,178,'Slide captive nuts in before bolting clips down. Deburr and inspect the added holes. Install +Y upward on the post; Z points outward. Fit fixed looms before the panels.',small=True,max_h=17)

begin('16  Fit and remove the shell','Isolate power and mechanically secure/de-tension the line. Shutters make a threaded line removable from the shell without disconnecting it.')
rect=fig('cover-passive-exploded',10,51,190,97)
a=json.loads((ROOT/'figure-manifest.json').read_text())['cover-passive-exploded']['anchors'];x,y,w,h=rect
def point(label):return x+a[label][0]*w,y+h-a[label][1]*h
arrow(*point('shutter_base'),*point('shutter_out'))
arrow(*point('hood_base'),*point('hood_out'))
sx,sy=point('shutter_out');hx,hy=point('hood_out')
text(sx+2,sy-1,'+Y',8,True,BLUE);text(hx+2,hy-1,'+Z',8,True,BLUE)
step(1,16,155,'Fit right to left','Fit the right main panel, then middle panels from right to left, then left. The 7 mm exterior cuffs overlap the next panel. Fit payout shutters last; four clip screws total per panel position.')
step(2,16,199,'Remove shutters first','Remove +Y-side screws on the payout segments. Withdraw each lower shutter toward +Y at least 20 mm; the 24 mm payout slot opens down to the base face. Secure the line inside its corridor.')
step(3,16,244,'Lift left to right','Remove remaining shell screws. Lift main panels outward along +Z, left to right, at least 130 mm. Fixed clips and loom anchor stay on the base. Remove the original coupling guard separately.',w=178)

begin('17  Routing and acceptance','Powered base/shaft remain separate load cases. The full cover is concept-unvalidated: no physical fit, heat, weather or contact-protection acceptance.')
fig('cover-rear-ports',10,51,91,66);fig('cover-core-service',105,51,91,66)
para(16,122,178,'<b>Line:</b> bidirectional payout along +Y across the full winding width. Slot Z=120..144 mm; represented corridor Z=124..140 mm. Nominal line diameters 1.5 / 4.5 mm. Smooth edges, traverse full travel and check fleet angle. The shell is not a fairlead.',small=True,max_h=27)
para(16,153,178,'<b>Fixed looms:</b> two 14 mm right-end ports at Y=-48, Z=50/75, for provisional <=10 mm OD motor/encoder looms. Add soft edging, two wraps on the independent base anchor, measured bend radius and a drip loop. Connectors may require removing the right panel.',small=True,max_h=27)
para(16,184,178,'<b>Powered interface still open:</b> a nominal 30 x 18 x 18 mm slip-ring body bay is checked at X=W+54..W+84, Y=-71..-53, Z=71..89. No supplier geometry, bracket or rotating conductor loop is established. Do not power the hybrid line until these are designed and accepted.',small=True,max_h=28)
para(16,216,178,'<b>Rain and heat:</b> +Y brows and exterior cuffs; 14 mm base-face drain/air gap; five 10 x 5 mm downward motor vents. Inspect rain, condensation, UV, motor temperature and creep at actual duty. PLA is a fit prototype. The near-motor driver is not modeled here; its protected mounting/enclosure still needs electrical design.',small=True,max_h=28)
para(16,248,178,'<b>Service:</b> with shells off, existing cap/base/motor fasteners retain their access. Release the coupling and caps before lifting the drum/shaft. Repeat alignment, line routing and hand-spin checks on reassembly. Payout openings and skirt gaps can admit fingers/tools; safe guarding remains unverified.',small=True,max_h=29)
assert PAGE==18

C.save()
print(OUT)
