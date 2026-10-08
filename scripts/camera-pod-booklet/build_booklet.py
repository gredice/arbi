"""Illustrated camera pod bench assembly from the registered fabrication STLs."""
import json,math
import page_style as p
from integration import ENCLOSURE
from page_style import C,ROOT,mm,BLUE,INK,GRAY,LINE,white,HexColor,Table,TableStyle
from page_style import text,para,line,box,fig,arrow,step,note,begin

report=json.loads((ROOT/'integration-check.json').read_text())
assert not report['neutral_collisions'] and not report['motion_grid']['failures']
models=json.loads((ROOT/'mesh-manifest.json').read_text())

def table(rows,y,widths,small=8.5):
 data=[[p.Paragraph(str(s),p.SMALL) for s in row] for row in rows]
 t=Table(data,colWidths=[w*mm for w in widths]);t.setStyle(TableStyle([
 ('BACKGROUND',(0,0),(-1,0),HexColor('#e8e8e5')),('ROWBACKGROUNDS',(0,1),(-1,-1),[white,HexColor('#f6f6f4')]),
 ('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),('LINEBELOW',(0,0),(-1,0),.7,BLUE)]))
 _,h=t.wrap(178*mm,1000);assert y+h/mm<281,(y,h/mm)
 t.drawOn(C,16*mm,(297-y)*mm-h);return y+h/mm


def enclosure_booklet():
 service=json.loads((ROOT/'service-check.json').read_text())
 by={e['model_id']:e for e in models}
 begin('Build the rain enclosure','Rounded white roof and black lower chassis; Camera Module 3 Standard, Pi 3A+ and two micro servos. Ordinary-rain/splash concept.')
 fig('assembled-covered',13,53,184,142)
 text(16,201,'CURRENT CAD, COMPLETE ASSEMBLY',11,True,BLUE)
 para(16,209,178,'Every illustration uses the checked STL meshes. The one-piece black head tapers from its broad shoulder to a narrow chin around the camera. It conceals the sideways servo and compact internal carrier. This presentation uses pan 0 / tilt 55 degrees; neutral points down.',max_h=23)
 note(240,'Measure the received servo, horn, converter and connectors first. These are nominal references, with no physical fit or rain test and no claimed ingress rating.')
 para(16,266,178,'Build unpowered on a supported bench fixture. Complete mass, cable movement, heat, electrical performance and suspended operation require separate checks.',small=True,max_h=15)

 begin('01  Chassis and gimbal prints','Print quantities below. White-face line drawings show every part; IDs identify prints. Boards and metal are nominal references.')
 items=[('camera-pod-spider','P01 Spider',1),('camera-pod-integrated-deck','P02 Integrated deck',1),('camera-pod-spider-spacer','P03 14 mm spacer',4),('camera-pod-pan-servo-mount','P04 Pan mount',1),('camera-pod-integrated-gimbal-carrier','P05 Pan carrier',1),('camera-pod-integrated-tilt-pivot-support','P06 Short pivot support',1),('camera-pod-integrated-camera-cradle','P07 Compact cradle',1),('camera-pod-horn-retainer','P08 Horn retainer',2),('camera-pod-integrated-camera-hood','P09 White optical hood',1),('camera-pod-servo-fit-coupon','T01 Fit coupon',1)]
 for i,(name,title,count) in enumerate(items):
  x=16+i%3*61;y=54+i//3*49
  fig('part-'+name,x,y,56,32)
  para(x,y+33,57,'<b>'+title+'</b>',small=True,max_h=10)
  para(x,y+41,57,f'{count} x / '+Path(by[name]['file']).stem.rsplit('-r',1)[1],small=True,max_h=10)
 para(78,207,113,'P02, P05, P06, P07, P09 and P12 are enclosure-specific prints. The dry mounts, servo boot, fixed fairing and camera cowl are alternative parts. The coupon is a test print and is not installed.',small=True,max_h=34)
 note(261,'STLs use mm and Z=0 print-bed placement. PETG is a starting material; plan supports in the slicer, inspect mating faces and holes, and weigh the sliced and printed parts.')

 begin('02  Three exterior shells','P10 is the white roof, P11 its black tray and P12 the single black outer head. The head turns with its internal carrier; a second rear camera cover is omitted.')
 for i,(name,title,body) in enumerate([('camera-pod-rain-hood','P10 White rain hood','Closed roof; inside-loaded M3 nut pockets'),('camera-pod-enclosure-base','P11 Rolled rain tray','Rounded shoulder, recessed outlets and open-bottom arm reliefs'),('camera-pod-integrated-gimbal-head','P12 Circular-neck head','Round neck and four M2 carrier clamps; keep the pan seam clear')]):
  x=16+i%3*61;y=55+i//3*93
  fig('part-'+name,x,y,56,60);para(x,y+61,57,'<b>'+title+'</b>',small=True,max_h=10);para(x,y+70,57,body,small=True,max_h=24)
 fig('gimbal-front',39,151,132,92)
 text(41,250,'COMPACT MECHANISM WITH OUTER HEAD REMOVED',8,True,BLUE)
 note(261,'Reprint P11 r0.2.3 and P12 r0.1.3 together. Keep their clearance seam free of support scars. Drainage, prints, outdoor exposure and complete mass need physical inspection.')

 begin('03  Measure actual hardware','The Pi/camera mounting patterns follow cited drawings. Servo, horn, converter, capacitor and connectors remain provisional.')
 fig('part-camera-pod-servo-fit-coupon',16,54,73,51)
 para(102,57,92,'<b>Test both servos</b><br/>Check case fit and both lug holes, then measure shaft offset, output height, supplied horn and the lead exit. The coupon tests only the first two.',small=True,max_h=35)
 table([['<b>Interface</b>','<b>Nominal envelope / required check</b>'],['Servo','20 x 8.5 x 18 mm; 27 mm ears, 24 mm hole pitch, 1.7 mm holes'],['Output / horn','5 mm shaft offset; tip 22 mm above case; 8 mm horn hub, one 12 mm arm'],['Converter / capacitor','45 x 25 x 15 mm / 10 mm can diameter, 16 mm height'],['Pi / camera','58 x 49 mm M2.5 pattern / 21 x 12.5 mm M2 pattern'],['Incoming lead','6 mm diameter through 8 mm base outlet; fit an actual soft sleeve or grommet'],['CSI / servo outlets','16 x 0.3 mm ribbon; 4 x 2 mm fixed servo lead reference']],117,[53,125])
 note(258,'Connector plugs stay inside the enclosure. Fit leads before closing the tray/roof. Do not assume a plug fits through a bare-wire outlet or use a tie as a positioning-line tensile termination.')

 begin('04  Install the pan servo','Fit the servo before attaching its mount to the spider. The upper opening passes the case and ears.')
 fig('pan-servo-insertion',22,54,166,124)
 step(1,16,184,'Feed the shaft downward','Insert the servo through P04 from above. The ears rest on the lower lug plate; the shaft points toward the pan horn.')
 step(2,16,219,'Seat the recessed screws','Use 2 x M1.6 x 6 countersunk screws upward from below and two M1.6 nuts above the ears. No head washers.')
 note(258,'Countersunk servo and horn-retainer heads are essential. Proud heads collide during rotation. Compare real head diameter, recess seating and supplied hardware with the checked reference.')

 begin('05  Prepare the pan carrier','Set servo neutral electrically, disconnect power, then fit the original horn. There is no printed spline.')
 fig('pan-horn-exploded',22,54,166,123)
 step(1,16,183,'Capture the stock horn','Place the horn in the upper pocket of P05. P08 bears on its arm. Shim a loose horn only after checking its actual shape.')
 step(2,16,218,'Fasten and engage','2 x M2 x 10 countersunk screws, two lower washers and two nuts retain P08. Engage the spline and install the original centre screw from below.')
 note(257,'The original centre screw thread and length are supplier dependent. A 65 mm pan-centre driver shaft is checked with the camera removed. Retainer access uses local tips; handles and wrench turning need a bench trial.')

 begin('06  Populate the compact carrier','The tilt servo lies sideways and 2 mm inboard. Its shaft is at Y=3, Z=-45, 14 mm above the earlier layout. Leave the opposite support, camera and outer body off while fitting it.')
 fig('tilt-servo-insertion',16,52,88,91);fig('head-open-top',108,52,86,91)
 step(1,16,151,'Fit the internal tilt servo','With P12 off, slide the servo inward from the left into P05. The case length runs front-to-back; the shaft faces the camera. Keep the opposite support and camera out during insertion.')
 step(2,16,197,'Retain the servo directly','Use 2 x M1.6 x 6 countersunk ear screws from the inner lug face and two nuts outside the lug plate. P12 covers the servo after carrier assembly; there is no separate servo boot.')
 note(256,'Populate P05 on a supported bench with P12 removed. Servo, stock horn, fasteners and leads stay accessible before the body encloses the carrier. Inspect actual hardware before fitting the camera.')

 begin('07  Fit the compact camera cradle','Secure the tilt horn centre screw before fitting the camera. P09 remains at the optical face. The outer head provides rear coverage; no separate camera cowl is installed.')
 fig('camera-exploded',16,52,88,97);fig('camera-rear',107,52,87,97)
 step(1,16,158,'Capture the horn before engaging it','On the separate cradle, fasten P08 with 2 x M2 x 8 countersunk screws, two rear washers and two nuts. Then slide onto the servo spline with P06 removed and fit the original centre screw.')
 step(2,16,204,'Retain the camera directly','Insert each M2 x 12 screw with its front washer through the 5.4 mm P09 tunnel, PCB and cradle. Fit four rear washers and four nuts. Inspect the thin webs beside the lens opening.')
 note(261,'The camera uses four nuts and eight washers. The earlier M2 x 18 screws and four second nuts are omitted. For service, support the pan mount, remove the upper stack and lower the outer head before releasing the four rear camera nuts.')

 begin('08  Close the supported pivot','Fit the opposite support after spline engagement. The pivot must rotate freely without squeezing the cradle.')
 fig('pivot-exploded',16,52,178,104)
 step(1,16,163,'Drop in the M3 pivot nut','Insert the plain M3 nut through the open-top cradle pocket. Slide the short P06 inward from the right; its stop pins face the cradle tab.')
 step(2,16,199,'Fasten the removable support','Use 2 x M2 x 12 screws, four M2 washers and two nuts at the yoke top pad.')
 step(3,16,235,'Fit the pivot and shim','Use M3 x 12 with a 0.5 mm outer washer and 0.7 mm gap shim. Adjust for free motion and retain the joint without locking the pivot.')

 begin('09  Preassemble compute and power','Prepare P02 outside the tray so its underside fasteners remain accessible. Work with power disconnected.')
 fig('deck-loaded',16,52,178,93)
 step(1,16,151,'Mount the Pi on four posts','Before lowering P02 into the tray, fit the Pi at X=-22, Y=0 with 4 x M2.5 x 20 screws, eight washers and four nuts. Seat the underside washers/nuts now; fit the microSD and CSI cable.')
 step(2,16,190,'Tie the converter to its pads','Centre the converter at X=32, Y=0, rotated 90 degrees. Two 2.5 mm ties run over clear PCB strips at Y=8 and Y=22. Check the received components beneath each strip.')
 step(3,16,231,'Retain the capacitor','Insulate its leads and seat it at X=32, Y=-34. Fit the separate tie. Preserve polarity and separation.')
 para(16,270,178,'Verify regulated 5 V and polarity before connecting the Pi. GPIO carries servo signals; the regulated supply powers the motors.',small=True,max_h=12)

 begin('10  Close the head; fit upper tray','Keep P11 and the loaded P02 deck off for head-bolt access. The fitting view omits the upper stack. Support the spider and pan mount with a bench fixture.')
 fig('base-and-spider',16,51,89,100);fig('head-fit',110,51,84,100)
 step(1,16,156,'Preload the head hardware','Before P05 enters P12, slide four M2 nuts and lower washers 11 mm outward from the inside into their side pockets. Support the spider and pan mount on a bench fixture.')
 step(2,16,188,'Fit the one-piece body','Raise P12 around the assembled P05 carrier. Fit 4 x M2 x 10 and four upper washers from above at X=+/-8, Y=+/-30.5 into the preloaded lower nuts. Keep the upper tray off for the driver.')
 step(3,16,225,'Lower the loaded deck','Fit P11 above the spider, then four P03 spacers and loaded P02. Keep P04 below the spider. Fit 4 x M4 x 35, eight washers and four nuts; hold the left nuts with a side wrench under the Pi.')
 note(260,'Fit Pi underside washers and nuts before lowering P02 into the tray. Side-wrench engagement and turning under the Pi need a received-tool trial; the short-driver checks do not prove this complete fastening sequence. Do not force access or load the PCB.')

 begin('11  Route the downward outlets','Tray underside at left; tray omitted at right to expose the fixed power route outside the moving head. Actual connectors, cable bends and weather seals require fitting.')
 fig('wiring-bottom',16,52,88,111);fig('power-route',109,52,85,111)
 table([['<b>Outlet axis</b>','<b>Reference and route</b>'],['Power X=10, Y=40','6 mm lead: down to Z1; out to Y60 above the moving head; down to Z-61, then out to Y70'],['CSI X=0, Y=-48','16 x 0.3 mm ribbon; centre within the slot, then bend away from the spider hub before descending'],['Servo X=-40, Y=-15','4 x 2 mm lead reference; bend away from spider arm before descending'],['Moving head','Open-top lead passage; leave separate pan and camera loops and retain the ribbon clear of the shortened mechanism']],172,[55,123])
 note(258,'The shown lead is a rigid power-route proxy, checked at 111 poses. Use soft sleeves, ties and a drip loop; actual bend radius and flexible CSI/servo loops still require bench inspection.')

 begin('12  Close the continuous roof','The roof has no fastener penetrations. Four plain M3 nuts load sideways into blind columns; bolts enter from underneath.')
 fig('hood-nut-seats',16,52,87,116);fig('cover-fit',108,52,86,116)
 step(1,16,174,'Preload four captive nuts','Slide one plain M3 nut into each inward-facing window. Inspect pocket seating before lowering P10 over the tray lip. Keep wires away from the lip and columns.')
 step(2,16,214,'Fasten from below','Use 4 x M3 x 35 with four lower M3 washers at X=+/-22, Y=+/-46. Reach upward through the gaps between spider arms, through base and deck into the captive nuts. No roof washers are fitted.')
 note(259,'For service, remove the four lower bolts and lift the roof vertically with its captured nuts. Confirm drain slots stay open; test seals, drip paths and internal temperatures before outdoor use.')

 begin('13  Hardware for one assembly','Counts follow the actual assembly definition. Plain nuts and nominal heads are checked; supplied servo-centre hardware remains provisional.')
 table([['<b>Location</b>','<b>Screws</b>','<b>Nuts / washers</b>'],['Spider / deck','4 x M4 x 35','4 nuts; 8 washers'],['Pi','4 x M2.5 x 20','4 nuts; 8 washers'],['Servo ears','4 x M1.6 x 6 countersunk','4 nuts; no head washers'],['Pan retainer','2 x M2 x 10 countersunk','2 nuts; 2 washers'],['Tilt retainer','2 x M2 x 8 countersunk','2 nuts; 2 washers'],['Camera / optical hood','4 x M2 x 12','4 nuts; 8 washers'],['Pivot support','2 x M2 x 12','2 nuts; 4 washers'],['Tilt pivot','1 x M3 x 12','1 nut; 0.5 washer + 0.7 shim'],['Rain hood / tray','4 x M3 x 35','4 captive nuts; 4 lower washers'],['Outer head / carrier','4 x M2 x 10','4 nuts; 8 washers'],['Servo centres','2 x original horn screws','Verify actual thread / length']],53,[47,68,63])
 para(16,252,178,'Also: two converter ties, one capacitor tie, and soft sleeves/ties for lead anchoring. The pack includes simplified hardware references to show the complete retained assembly.',small=True,max_h=22)

 begin('14  CAD evidence and limits','Geometry checks use final exported meshes and the same assembly transforms as these figures. Physical fit, load and rain performance remain unverified.')
 for i,n in enumerate(['motion-left','motion-down','motion-right']):fig(n,16+61*i,54,56,62)
 for x,label in [(16,'PAN -90 / TILT 70'),(77,'PAN 0 / TILT 0'),(138,'PAN +90 / TILT 70')]:text(x,122,label,8,True,BLUE)
 table([['<b>Check</b>','<b>Result / scope</b>'],['Rigid motion grid',f"{report['motion_grid']['poses']} poses; 5-degree steps; no intersections above 0.005 mm3"],['Mechanical stops','Contact outside usable +/-90 pan, 0..70 tilt'],['Neck seam',f"{report['neck_clearance']['minimum_clearance_mm']:.3f} mm minimum in 41 sections; oversized-neck control detects interference"],['Assembly and service',f"{len(service['assembly_paths'])} sampled paths; local sockets and staged head/centre-screw access"],['Cable outlets',f"{len(service['wiring_ports'])} nominal opening envelopes; no flexible-cable simulation"],['Fixed power route',f"{service['fixed_power_route']['poses']} rigid-route poses; misplaced central-drop control detects the pan stop"],['Optical opening','66 x 41 degree Standard-camera viewing volume to 80 mm'],['Full-solid PETG mass',f"{report['solid_total_PETG_g']:.1f} g before electronics, wires and metal hardware"]],135,[57,121])
 note(258,'Weigh the completed build; the 170 g flying ceiling is not demonstrated. The head loads the pan servo: verify torque, current and heat on the bench. Rigid checks do not prove sealing, strength or safe flight.')

 begin('15  Final supported bench check','Support the spider with the camera free. Do not rest the assembly on the camera hood or force geared servos by hand.')
 steps=[('Inspect fastening','Confirm seated countersunk heads, retained horns, the four camera nuts, pan horn centre screw, four head clamps and captive roof M3 nuts. The pivot must remain free.'),('Inspect wires and ports','Fit protective sleeves, strain relief and drip loops. No plug is trapped; ribbon loops clear all four travel corners without sharp bends or tension.'),('Measure power, heat and imaging','Check converter voltage/polarity before the Pi. Test servo motion, brownouts, focus and framing, then record internal temperatures with the roof closed.'),('Record the physical build','Record received dimensions, source revision, print settings, sliced/actual mass, usable limits, faults and a controlled rain/splash test. No IP rating or suspended-use approval is supplied.')]
 for i,(title,body) in enumerate(steps):step(i+1,16,54+i*42,title,body)
 para(16,232,178,f'<b>Pack contents</b><br/>{len(models)} checked STLs, assembled GLB, canonical CAD snapshot, model/figure transforms, source hashes, configuration and JSON geometry/service reports.',small=True,max_h=21)
 para(16,259,178,'<b>Source and open interfaces</b><br/>See sources.json for nominal hardware. Actual seals, ribbon motion, electrical performance, flying mass, line tensile terminations and docking remain open.',small=True,max_h=21)
 assert p.PAGE==16
 C.save();print(p.OUT)

if ENCLOSURE:
 from pathlib import Path
 enclosure_booklet()
 raise SystemExit(0)

begin('Build the camera pod','Pi 3A+ / Camera Module 3 Standard / two micro servos. Dry bench alternative; deck/yoke r0.1.1, other prints as registered.')
fig('assembled-open',10,52,190,140)
text(16,199,'THE MISSING PRINTED STRUCTURE IS NOW INCLUDED',10.5,True,BLUE)
para(16,206,178,'A fixed electronics deck, both servo mounts, stock-horn retainers, supported camera cradle, removable pivot support, optical hood and electronics cover. Every illustration uses the supplied STL files.',max_h=23)
box(16,235,178,28)
para(21,240,168,'<b>Fit before the full print</b><br/>Servo and power-module dimensions remain provisional. Start with the servo coupon and compare the dimension table on page 3 with your received parts. These models are not physically tested.',small=True,max_h=21)
para(16,269,178,'CAD checks cover rigid geometry, fasteners and motion. Suspended operation still needs mass, strength, balance, cable-flex and electrical checks.',small=True,max_h=12)

begin('01  Printed parts','Print the listed quantity. Line drawings use white faces for clarity; part IDs identify prints. Electronic and metal references are not functional prints.')
items=[('camera-pod-spider','P01  Existing spider','1 x / r0.1.0'),('camera-pod-electronics-deck','P02  Electronics deck','1 x'),('camera-pod-spider-spacer','P03  Spider spacer','4 x / 14 mm'),('camera-pod-pan-servo-mount','P04  Pan servo mount','1 x'),('camera-pod-pan-yoke','P05  Pan yoke','1 x'),('camera-pod-tilt-pivot-support','P06  Pivot support','1 x / removable'),('camera-pod-camera-cradle','P07  Camera cradle','1 x'),('camera-pod-horn-retainer','P08  Horn retainer','2 x / identical'),('camera-pod-camera-hood','P09  Camera hood','1 x'),('camera-pod-electronics-cover','P10  Electronics cover','1 x / removable'),('camera-pod-servo-fit-coupon','T01  Servo fit coupon','1 test print / not installed')]
for i,(name,title,count) in enumerate(items):
 x=16+(i%3)*61;y=55+(i//3)*50
 fig('part-'+name,x,y,56,34);para(x,y+35,57,'<b>'+title+'</b>',small=True,max_h=10);para(x,y+43,57,count,small=True,max_h=10)
para(139,213,55,'PETG starting point:<br/>0.2 mm layers, 3+ walls.<br/>Solid small parts.<br/>Supports on complex brackets.',small=True,max_h=38)
note(261,'All STLs are in mm and shifted onto Z=0. Brackets need support planning in the slicer. Remove support scars from mating faces and holes; do not enlarge the horn pocket until it becomes loose.')

begin('02  Measure before printing','The stock Pi/camera hole patterns are documented. The servo, horn, converter and capacitor must be checked against received hardware.')
fig('part-camera-pod-servo-fit-coupon',16,54,73,55)
para(102,57,92,'<b>Test both servos</b><br/>The body should pass the coupon without force; both lug holes must align. Also measure the shaft offset and height: the coupon cannot check either.',small=True,max_h=36)
table([['<b>Interface</b>','<b>Nominal model / required check</b>'],['Servo body','20 x 8.5 x 18 mm; window 20.8 x 9.3 mm'],['Servo ears','27 mm span; 24 mm hole pitch; 1.7 mm holes'],['Output shaft','5 mm off body centre; tip 22 mm above case bottom'],['Stock horn','8 mm hub; one 12 mm arm; hub 2 mm / arm 1.5 mm thick'],['Converter / capacitor','45 x 25 x 15 mm / 10 mm diameter x 16 mm can'],['Pi / camera holes','58 x 49 mm, M2.5 / 21 x 12.5 mm, M2']],120,[55,123])
para(16,223,178,'Edit hardware/lib/camera-pod-mounts.scad and the matching reference models if the parts differ, then rebuild and repeat the checks. Use the original servo horns and centre screws; there is no printed spline.',small=True,max_h=21)
note(255,'The countersunk servo and horn-retainer screws are intentional. Proud socket heads interfere during rotation. Check the real head diameter and recess seating; no washers go under countersunk heads.')

begin('03  Install the pan servo','Do this before attaching the mount to the spider. Its large upper opening passes the servo and both mounting ears.')
fig('pan-servo-insertion',24,54,162,126)
step(1,16,184,'Insert from above','Feed the output shaft down through P04. The case passes the body window; the mounting ears rest on the lower lug plate.')
step(2,16,218,'Use recessed ear screws','2 x M1.6 x 6 countersunk screws enter upward from below. Put the two M1.6 nuts above the servo ears. The screw heads must sit flush.')
note(257,'Route the servo lead through an open side with slack at the case exit. Ear holes, nut clearance and centre-screw thread are supplier-dependent; never force an oversized screw into the servo.')

begin('04  Couple the pan yoke','Set the actual servo neutral with its controller, then disconnect power before fitting the horn. Keep the horn orientation repeatable.')
fig('pan-horn-exploded',21,54,168,125)
step(1,16,184,'Capture the supplied horn','Seat the stock horn in the upper pocket of P05. Fit P08 over it: the underside rib bears on the horn arm. Remove free play with a fitted shim if needed.')
step(2,16,218,'Retain and engage','Use 2 x M2 x 10 countersunk screws, two lower washers and two nuts. Push the captured horn onto the pan spline and fit the OEM centre screw through the access hole below.')
note(257,'The rib and pocket match the stated nominal horn only. Do not clamp a different horn by force. At neutral, a short driver reaches the retainer screws from the side below the pan mount; see the access-check limits.')

begin('05  Install the tilt servo','Leave the opposite pivot support off while engaging the camera horn. P06 is removable so the yoke does not need to be bent apart.')
fig('tilt-servo-insertion',16,54,178,121)
step(1,16,181,'Insert from the outside','Slide the second servo into the left-side opening of P05. Its output shaft points inward toward the camera; the two ear holes align vertically.')
step(2,16,217,'Recess the two screw heads','Use 2 x M1.6 x 6 countersunk screws from the inner face of the lug plate, with nuts outside the servo ears. Install these before the camera cradle blocks tool access.')
note(257,'At this stage both servos should be retained independently of their horns. The exposed lead exits need relaxed wire loops; the geometric references do not model the actual servo lead or plug.')

begin('06  Prepare the camera cradle','The camera mounts 5 mm off the tilt-axis centreline. This leaves access to the stock horn screw without crossing a camera mounting hole.')
fig('camera-exploded',19,52,172,132)
step(1,16,188,'Fit the tilt horn and retainer','Capture the second stock horn in P07 with P08, 2 x M2 x 8 countersunk screws, two washers behind the carrier and two nuts. Slide the cradle onto the tilt spline while P06 is removed.')
step(2,16,226,'Secure the centre screw first','Fit the OEM centre screw from inside the cradle through its lateral access bore. Fit the camera, hood and four camera bolts after this screw is secure.')
note(260,'Camera stack: M2 x 12 screw + front washer > hood tab > PCB > integral cradle spacer > carrier > rear washer + nut. Use four of each. The rear CSI connector has a clearance recess.')

begin('07  Close the supported pivot','The M3 pivot provides the opposite-side support. It must rotate freely without squeezing the cradle against the yoke.')
fig('pivot-exploded',16,54,178,103)
step(1,16,164,'Drop in the pivot nut','Put the M3 plain nut into the open-top pocket in the right cradle boss. Slide P06 onto the yoke from below; its stop pins face the moving cradle tab.')
step(2,16,200,'Fasten the removable support','Use 2 x M2 x 12 screws, four M2 washers and two nuts through the top pad of P05 and flange of P06.')
step(3,16,236,'Fit the pivot screw and shim','Insert M3 x 12 with a 0.5 mm outer washer. Place the 0.7 mm shim in the side gap. Adjust for free travel, then retain the threaded joint without locking the pivot against the support.')

begin('08  Attach to the spider','Build the mechanical frame before fitting the Pi. This leaves the four upper frame nuts accessible.')
fig('frame-exploded',12,53,186,137)
step(1,16,194,'Stack the three levels','P04 pan mount below the existing spider; four P03 spacers above it; P02 electronics deck on top. Align the existing 31.11 mm square mounting pattern.')
step(2,16,231,'Fit four M4 through bolts','Insert M4 x 35 upward from below, with a washer at each end and a plain nut above the deck. Tighten evenly without crushing printed spacers.')
para(16,269,178,'The Pi is installed later. Its underside clears the represented frame-screw tips; replacing these bolts with longer ones requires another check.',small=True,max_h=12)

begin('09  Mount compute and power','All heavy electronics stay on the fixed deck. Disconnect power while mounting boards and connecting the camera ribbon.')
fig('deck-loaded',16,52,178,94)
step(1,16,152,'Mount the Pi on four posts','Use 4 x M2.5 x 20 screws, eight M2.5 washers and four nuts. Insert the microSD card and connect the CSI cable while the cover is off.')
step(2,16,190,'Retain the converter','Seat the board on its four pads. Two 2.5 mm insulated ties pass through the deck slots and over clear PCB strips. Confirm the real module has no components or terminals under those strips.')
step(3,16,234,'Fit the capacitor','Put an insulating sleeve on the leads, seat the can in its loose cup, and loop a tie over the can through the two side slots. Keep polarity visible and leads separated.')
para(16,270,178,'Validate regulated 5 V and polarity before connecting electronics. Servo supply comes from the regulated rail; GPIO provides signals, not motor power.',small=True,max_h=12)

begin('10  Route cables; add the cover','The 60 mm flat CSI mesh is only a reference segment. It is not the cable length needed by this assembled mechanism.')
fig('cover-fit',15,53,180,127)
para(16,187,178,'<b>Provide two relaxed ribbon loops</b><br/>Use the broad tie pads on the deck and pan yoke with a soft protective wrap. Route the fixed-to-pan loop through an open gap between spider arms and outside the servo sweep. Leave a separate pan-to-camera loop for tilt. Keep the CSI connector accessible.',small=True,max_h=31)
para(16,225,178,'Hand-check all four pan/tilt corner poses with the actual ribbon before choosing its length. Stop before any tension, twist concentration, sharp crease or rubbing. The CAD check does not simulate cable flex.',small=True,max_h=21)
note(257,'Fit P10 last: 4 x M3 x 35, eight M3 washers and four nuts. The cover lifts straight off after its bolts are removed. It is a splash shield; the exposed gimbal and electronics are not waterproof.')

begin('11  Hardware for one assembly','Counts below follow the illustrated assembly. Plain nuts are used in the checked envelopes. Confirm actual screw heads and supplied servo hardware.')
table([['<b>Location</b>','<b>Screws</b>','<b>Nuts / washers</b>'],['Spider / deck','4 x M4 x 35','4 M4 nuts; 8 M4 washers'],['Pi','4 x M2.5 x 20','4 M2.5 nuts; 8 M2.5 washers'],['Servo ears','4 x M1.6 x 6 COUNTERSUNK','4 M1.6 nuts; no head washers'],['Pan horn retainer','2 x M2 x 10 COUNTERSUNK','2 M2 nuts; 2 lower washers'],['Tilt horn retainer','2 x M2 x 8 COUNTERSUNK','2 M2 nuts; 2 rear washers'],['Camera / hood','4 x M2 x 12','4 M2 nuts; 8 M2 washers'],['Pivot support','2 x M2 x 12','2 M2 nuts; 4 M2 washers'],['Tilt pivot','1 x M3 x 12','1 M3 nut; 0.5 mm washer + 0.7 mm shim'],['Electronics cover','4 x M3 x 35','4 M3 nuts; 8 M3 washers'],['Servo centres','2 x original horn screws','Thread and length depend on servo']],54,[47,70,61])
para(16,249,178,'Also: two converter ties, one capacitor tie, and ties/soft sleeves for the incoming wire and CSI anchor pads. Do not use a cable tie as the independent tensile termination of a positioning line.',small=True,max_h=21)

begin('12  What the CAD check proves','Checked against the declared nominal hardware. Real parts, print shrinkage, bolt tolerances and cable behaviour still need inspection.')
for i,n in enumerate(['motion-left','motion-down','motion-right']):fig(n,16+61*i,55,56,66)
for x,label in [(16,'PAN -90 / TILT 70'),(77,'PAN 0 / TILT 0'),(138,'PAN +90 / TILT 70')]:text(x,127,label,8,True,BLUE)
poses=report['motion_grid']['poses'];mass=report['solid_total_PETG_g']
rows=[['<b>Check</b>','<b>Result / limit</b>'],['Rigid travel grid',f'{poses} poses; 5-degree steps; no intersections above 0.005 mm3'],['Mechanical stops','Contact beyond +/-95 pan and -5 / +75 tilt; usable targets +/-90 and 0..70'],['Assembly and service','Insertion, cover-removal and short-driver paths checked in the supplied report'],['Optical opening','Nominal camera viewing volume checked against represented solids'],['Print mass',f'{mass:.1f} g at solid PETG density 1.27 g/cm3, BEFORE electronics and metal hardware']]
table(rows,139,[59,119])
note(259,'The original 170 g flying ceiling is not demonstrated by this bench design. Slicer infill changes mass; weigh the complete build. A lighter chassis/cover and a new mass check are needed before suspended use.')

begin('13  Final bench inspection','Support the spider on a fixture so the camera hangs free. Do not rest the camera pod on its optical hood or force a geared servo by hand.')
steps=[('Inspect the retained parts','No loose PCB, horn, pivot nut or strap. Countersunk heads fully seated. Camera centre screws installed. The pivot remains free and has no excessive side play.'),('Check cables before powered motion','Verify both slack loops and all four travel corners with the drive disengaged where practical. Calibrate narrow software limits first, then increase only after observing clearance.'),('Check power and imaging','Verify the converter output before attaching the Pi. Check for brownouts during servo motion, focus and capture. Keep hands, loose wires and tools away from the moving brackets.'),('Record what was built','Measure servo/converter dimensions, revisions, print settings, complete mass, movement limits and faults. No load, fatigue, weather or suspended-operation test has been performed here.')]
for i,(title,body) in enumerate(steps):step(i+1,16,55+i*42,title,body)
para(16,229,178,f'<b>Pack contents</b><br/>{len(models)} checked STLs, assembled GLB, current source snapshot, assembly/figure transforms, source hashes and JSON check reports. Only models/printable contains fabrication parts; the fit coupon is not installed.',small=True,max_h=23)
para(16,258,178,'<b>Sources and open interfaces</b><br/>Full source URLs and assumptions: sources.json. Line terminations, docking-stud interface, actual ribbon behaviour, electrical performance and flying mass remain open; they are not supplied as verified interfaces.',small=True,max_h=22)
assert p.PAGE==14
C.save();print(p.OUT)
