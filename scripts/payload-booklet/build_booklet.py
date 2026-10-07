"""Illustrated payload bench assembly from the registered fabrication STLs."""
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
 para(16,209,178,'Every illustration uses the checked STL meshes. The continuous roof, lower tray, removable fairing, servo boot and rear camera cowl supplement the existing gimbal and optical hood.',max_h=23)
 note(240,'Measure the received servo, horn, converter and connectors first. These are nominal references, with no physical fit or rain test and no claimed ingress rating.')
 para(16,266,178,'Build unpowered on a supported bench fixture. Complete mass, cable movement, heat, electrical performance and suspended operation require separate checks.',small=True,max_h=15)

 begin('01  Chassis and gimbal prints','Print quantities below. White-face line drawings show every part; IDs identify prints. Boards and metal are nominal references.')
 items=[('camera-pod-spider','P01 Spider',1),('payload-electronics-deck','P02 Electronics deck',1),('payload-spider-spacer','P03 14 mm spacer',4),('payload-pan-servo-mount','P04 Pan mount',1),('payload-pan-yoke','P05 Pan yoke',1),('payload-tilt-pivot-support','P06 Pivot support',1),('payload-camera-cradle','P07 Camera cradle',1),('payload-horn-retainer','P08 Horn retainer',2),('payload-camera-hood','P09 Optical hood',1),('payload-servo-fit-coupon','T01 Fit coupon',1)]
 for i,(name,title,count) in enumerate(items):
  x=16+i%3*61;y=54+i//3*49
  fig('part-'+name,x,y,56,32)
  para(x,y+33,57,'<b>'+title+'</b>',small=True,max_h=10)
  para(x,y+41,57,f'{count} x / '+Path(by[name]['file']).stem.rsplit('-r',1)[1],small=True,max_h=10)
 para(78,207,113,'Reprint P02 deck and P05 yoke at r0.1.1: the deck has the CSI passage; the yoke has boot attachment ears. The coupon is a test print and is not installed.',small=True,max_h=34)
 note(261,'STLs use mm and Z=0 print-bed placement. PETG is a starting material; plan supports in the slicer, inspect mating faces and holes, and weigh the sliced and printed parts.')

 begin('02  Enclosure prints','P10 replaces the bench electronics cover. P11-P14 are new parts. Use white for the roof and camera cowl; black for the tray, fairing and servo boot.')
 for i,(name,title,body) in enumerate([('payload-rain-hood','P10 White rain hood','Closed roof; inside-loaded M3 nut pockets'),('payload-enclosure-base','P11 Black rain tray','Perimeter skirt, raised lip and downward outlets'),('payload-tilt-servo-boot','P12 Tilt servo boot','Moving cover; servo retained separately'),('payload-camera-cowl','P13 White camera cowl','Four second camera nuts retain the cowl'),('payload-pan-fairing','P14 Black pan fairing','Removes downward; four posts pass between spider arms')]):
  x=16+i%3*61;y=55+i//3*93
  fig('part-'+name,x,y,56,60);para(x,y+61,57,'<b>'+title+'</b>',small=True,max_h=10);para(x,y+70,57,body,small=True,max_h=24)
 note(261,'These covers manage ordinary rain and splash; openings and moving interfaces are present. Print orientation, drain performance, seals, heat and outdoor exposure remain unverified.')

 begin('03  Measure actual hardware','The Pi/camera mounting patterns follow cited drawings. Servo, horn, converter, capacitor and connectors remain provisional.')
 fig('part-payload-servo-fit-coupon',16,54,73,51)
 para(102,57,92,'<b>Test both servos</b><br/>Check case fit and both lug holes, then measure shaft offset, output height, supplied horn and the lead exit. The coupon tests only the first two.',small=True,max_h=35)
 table([['<b>Interface</b>','<b>Nominal envelope / required check</b>'],['Servo','20 x 8.5 x 18 mm; 27 mm ears, 24 mm hole pitch, 1.7 mm holes'],['Output / horn','5 mm shaft offset; tip 22 mm above case; 8 mm horn hub, one 12 mm arm'],['Converter / capacitor','45 x 25 x 15 mm / 10 mm can diameter, 16 mm height'],['Pi / camera','58 x 49 mm M2.5 pattern / 21 x 12.5 mm M2 pattern'],['Incoming lead','6 mm diameter through 8 mm base outlet; fit an actual soft sleeve or grommet'],['CSI / servo outlets','16 x 0.3 mm ribbon; 4 x 2 mm fixed servo lead reference']],117,[53,125])
 note(258,'Connector plugs stay inside the enclosure. Fit leads before closing the tray/roof. Do not assume a plug fits through a bare-wire outlet or use a tie as a positioning-line tensile termination.')

 begin('04  Install the pan servo','Fit the servo before attaching its mount to the spider. The upper opening passes the case and ears.')
 fig('pan-servo-insertion',22,54,166,124)
 step(1,16,184,'Feed the shaft downward','Insert the servo through P04 from above. The ears rest on the lower lug plate; the shaft points toward the pan horn.')
 step(2,16,219,'Seat the recessed screws','Use 2 x M1.6 x 6 countersunk screws upward from below and two M1.6 nuts above the ears. No head washers.')
 note(258,'Countersunk servo and horn-retainer heads are essential. Proud heads collide during rotation. Compare real head diameter, recess seating and supplied hardware with the checked reference.')

 begin('05  Couple the pan yoke','Set servo neutral electrically, disconnect power, then fit the original horn. There is no printed spline.')
 fig('pan-horn-exploded',22,54,166,123)
 step(1,16,183,'Capture the stock horn','Place the horn in the upper pocket of P05. P08 bears on its arm. Shim a loose horn only after checking its actual shape.')
 step(2,16,218,'Fasten and engage','2 x M2 x 10 countersunk screws, two lower washers and two nuts retain P08. Engage the spline and install the original centre screw from below.')
 note(257,'The original centre screw thread and length are supplier dependent. Local 15 mm straight-tip tool access is checked; driver handles and every possible approach are not represented.')

 begin('06  Tilt servo and moving boot','Leave the opposite pivot support off. The boot is fitted after retaining the servo and routes its lead through the lower opening.')
 fig('tilt-servo-insertion',16,52,88,91);fig('boot-exploded',108,52,86,91)
 step(1,16,151,'Slide the servo inward','Insert from the left into P05. The shaft faces the camera. Use 2 x M1.6 x 6 countersunk ear screws from the inner lug face and two nuts outside.')
 step(2,16,197,'Fit the removable boot','Place P12 around the retained servo. Use 2 x M2 x 8 screws from the outside, two M2 washers and two nuts at the yoke ears. Keep the case lead loose.')
 note(256,'After its two bolts are removed, P12 withdraws 20 mm outward, lowers 15 mm, then withdraws another 20 mm. It does not retain the servo, seal the spline, or establish the actual lead-exit position.')

 begin('07  Camera cradle and rear cowl','Secure the tilt horn centre screw before fitting the camera. P13 sits behind the board; P09 remains at the optical face.')
 fig('camera-exploded',16,52,88,97);fig('cowl-exploded',107,52,87,97)
 step(1,16,158,'Capture and engage the tilt horn','Use P08, 2 x M2 x 8 countersunk screws, two rear washers and two nuts. Engage the spline with P06 removed, then install the original centre screw.')
 step(2,16,204,'Retain camera, then cowl','Use 4 x M2 x 18 through the front washers, P09, PCB and cradle. Rear washers and first nuts secure the camera. Fit P13 over the rear, then add four second M2 nuts.')
 note(261,'The first camera nuts remain at the cradle; the second nuts secure only P13. Route the camera CSI connector through the rear relief. Remove rear nuts, lift P13 by 14 mm, then withdraw it 45 mm toward -Y.')

 begin('08  Close the supported pivot','Fit the opposite support after spline engagement. The pivot must rotate freely without squeezing the cradle.')
 fig('pivot-exploded',16,52,178,104)
 step(1,16,163,'Drop in the M3 pivot nut','Insert the plain M3 nut through the open-top cradle pocket. Fit P06 from below; its stop pins face the cradle tab.')
 step(2,16,199,'Fasten the removable support','Use 2 x M2 x 12 screws, four M2 washers and two nuts at the yoke top pad.')
 step(3,16,235,'Fit the pivot and shim','Use M3 x 12 with a 0.5 mm outer washer and 0.7 mm gap shim. Adjust for free motion and retain the joint without locking the pivot.')

 begin('09  Lower base and frame','Fit P11 before the electronics deck and gimbal obstruct access. The spider remains the canonical structural part.')
 fig('base-and-spider',16,51,89,100);fig('fairing-fit',110,51,84,100)
 step(1,16,156,'Place the upper tray','Lower P11 onto the spider before spacers or electronics are fitted. Keep its raised lip upward and outlets downward.')
 step(2,16,188,'Fit the fairing from below','P14 posts pass between the four arms. Use 4 x M2 x 25 upward through the lower washers; four M2 nuts sit above the tray floor.')
 step(3,16,225,'Stack the frame levels','P04 below the spider; four P03 spacers through the tray; P02 on top. Fit 4 x M4 x 35 upward, eight washers and four nuts.')
 note(260,'Fit the fairing nuts before the deck blocks access. For service, secure pan at 45 degrees and tilt at 0, isolate power, and disconnect or feed harness slack before lowering. P12 may remain fitted.')

 begin('10  Mount compute and power','Fixed electronics stay on P02. Work with power disconnected; route the leads before fitting the roof.')
 fig('deck-loaded',16,52,178,93)
 step(1,16,151,'Mount the Pi on four posts','Use 4 x M2.5 x 20 screws, eight washers and four nuts. Fit the microSD and CSI cable while the roof is off.')
 step(2,16,190,'Tie the converter to its pads','Two 2.5 mm insulated ties pass through deck slots over clear PCB strips. Confirm there are no actual components beneath these strips.')
 step(3,16,231,'Retain the capacitor','Insulate its leads, seat it in the loose cup and use the separate tie. Preserve polarity and separation.')
 para(16,270,178,'Verify regulated 5 V and polarity before connecting the Pi. GPIO carries servo signals; the regulated supply powers the motors.',small=True,max_h=12)

 begin('11  Route the downward outlets','Tray underside at left; tray and fairing omitted at right to expose the nominal power route. Actual connectors, cable bends and weather seals require fitting.')
 fig('wiring-bottom',16,52,88,111);fig('power-route',109,52,85,111)
 table([['<b>Outlet axis</b>','<b>Reference and route</b>'],['Power X=-8, Y=31','6 mm nominal lead: descend to Z=-14, across to X16/Y37, down to Z=-42, then out to Y60'],['CSI X=0, Y=-27','16 x 0.3 mm ribbon; centre it at Y=-28 within the slot, then bend away from the spider hub before descending'],['Servo X=-22, Y=-32','4 x 2 mm lead reference; bend away from spider arm before descending'],['Moving covers','Boot lower exit and cowl rear CSI relief; leave a separate pan-to-camera loop']],172,[55,123])
 note(258,'The shown lead is a rigid power-route proxy, checked at 111 poses. Use soft sleeves, ties and a drip loop; actual bend radius and flexible CSI/servo loops still require bench inspection.')

 begin('12  Close the continuous roof','The roof has no fastener penetrations. Four plain M3 nuts load sideways into blind columns; bolts enter from underneath.')
 fig('hood-nut-seats',16,52,87,116);fig('cover-fit',108,52,86,116)
 step(1,16,174,'Preload four captive nuts','Slide one plain M3 nut into each inward-facing window. Inspect pocket seating before lowering P10 over the tray lip. Keep wires away from the lip and columns.')
 step(2,16,214,'Fasten from below','Use 4 x M3 x 35 with four lower M3 washers. The bolts pass through base and deck into the captive nuts. No roof washers are fitted.')
 note(259,'For service, remove the four lower bolts and lift the roof vertically with its captured nuts. Confirm drain slots stay open; test seals, drip paths and internal temperatures before outdoor use.')

 begin('13  Hardware for one assembly','Counts follow the actual assembly definition. Plain nuts and nominal heads are checked; supplied servo-centre hardware remains provisional.')
 table([['<b>Location</b>','<b>Screws</b>','<b>Nuts / washers</b>'],['Spider / deck','4 x M4 x 35','4 nuts; 8 washers'],['Pi','4 x M2.5 x 20','4 nuts; 8 washers'],['Servo ears','4 x M1.6 x 6 countersunk','4 nuts; no head washers'],['Pan retainer','2 x M2 x 10 countersunk','2 nuts; 2 washers'],['Tilt retainer','2 x M2 x 8 countersunk','2 nuts; 2 washers'],['Camera / optical hood / cowl','4 x M2 x 18','8 nuts; 8 washers'],['Tilt boot','2 x M2 x 8','2 nuts; 2 washers'],['Pivot support','2 x M2 x 12','2 nuts; 4 washers'],['Tilt pivot','1 x M3 x 12','1 nut; 0.5 washer + 0.7 shim'],['Rain hood / tray','4 x M3 x 35','4 captive nuts; 4 lower washers'],['Pan fairing','4 x M2 x 25','4 nuts; 4 lower washers'],['Servo centres','2 x original horn screws','Verify actual thread / length']],53,[47,68,63])
 para(16,252,178,'Also: two converter ties, one capacitor tie, and soft sleeves/ties for lead anchoring. The pack includes simplified hardware references to show the complete retained assembly.',small=True,max_h=22)

 begin('14  CAD evidence and limits','Geometry checks use final exported meshes and the same assembly transforms as these figures. Physical fit, load and rain performance remain unverified.')
 for i,n in enumerate(['motion-left','motion-down','motion-right']):fig(n,16+61*i,54,56,62)
 for x,label in [(16,'PAN -90 / TILT 70'),(77,'PAN 0 / TILT 0'),(138,'PAN +90 / TILT 70')]:text(x,122,label,8,True,BLUE)
 table([['<b>Check</b>','<b>Result / scope</b>'],['Rigid motion grid',f"{report['motion_grid']['poses']} poses; 5-degree steps; no intersections above 0.005 mm3"],['Mechanical stops','Contact outside usable +/-90 pan, 0..70 tilt'],['Assembly and service',f"{len(service['assembly_paths'])} sampled paths; short local driver/socket envelopes"],['Cable outlets',f"{len(service['wiring_ports'])} nominal opening envelopes; no flexible-cable simulation"],['Fixed power route',f"{service['fixed_power_route']['poses']} rigid-route poses; incorrect straight route detects the pan stop"],['Optical opening','66 x 41 degree Standard-camera viewing volume to 80 mm'],['Full-solid PETG mass',f"{report['solid_total_PETG_g']:.1f} g before electronics, wires and metal hardware"]],135,[57,121])
 note(258,'The 170 g flying ceiling is not demonstrated. Slicer settings change mass; weigh the completed build. Sampled rigid checks do not prove continuous clearance, temperature, sealing, strength or safe flight.')

 begin('15  Final supported bench check','Support the spider with the camera free. Do not rest the assembly on the camera hood or force geared servos by hand.')
 steps=[('Inspect fastening','Confirm seated countersunk heads, retained horns, both camera nut sets, boot bolts and captive M3 nuts. The pivot must remain free.'),('Inspect wires and ports','Fit protective sleeves, strain relief and drip loops. No plug is trapped; ribbon loops clear all four travel corners without sharp bends or tension.'),('Measure power, heat and imaging','Check converter voltage/polarity before the Pi. Test servo motion, brownouts, focus and framing, then record internal temperatures with the roof closed.'),('Record the physical build','Record received dimensions, source revision, print settings, sliced/actual mass, usable limits, faults and a controlled rain/splash test. No IP rating or suspended-use approval is supplied.')]
 for i,(title,body) in enumerate(steps):step(i+1,16,54+i*42,title,body)
 para(16,232,178,f'<b>Pack contents</b><br/>{len(models)} checked STLs, assembled GLB, canonical CAD snapshot, model/figure transforms, source hashes, configuration and JSON geometry/service reports.',small=True,max_h=21)
 para(16,259,178,'<b>Source and open interfaces</b><br/>See sources.json for nominal hardware. Actual seals, ribbon motion, electrical performance, flying mass, line tensile terminations and docking remain open.',small=True,max_h=21)
 assert p.PAGE==16
 C.save();print(p.OUT)

if ENCLOSURE:
 from pathlib import Path
 enclosure_booklet()
 raise SystemExit(0)

begin('Build the payload','Pi 3A+ / Camera Module 3 Standard / two micro servos. Dry bench alternative; deck/yoke r0.1.1, other prints as registered.')
fig('assembled-open',10,52,190,140)
text(16,199,'THE MISSING PRINTED STRUCTURE IS NOW INCLUDED',10.5,True,BLUE)
para(16,206,178,'A fixed electronics deck, both servo mounts, stock-horn retainers, supported camera cradle, removable pivot support, optical hood and electronics cover. Every illustration uses the supplied STL files.',max_h=23)
box(16,235,178,28)
para(21,240,168,'<b>Fit before the full print</b><br/>Servo and power-module dimensions remain provisional. Start with the servo coupon and compare the dimension table on page 3 with your received parts. These models are not physically tested.',small=True,max_h=21)
para(16,269,178,'CAD checks cover rigid geometry, fasteners and motion. Suspended operation still needs mass, strength, balance, cable-flex and electrical checks.',small=True,max_h=12)

begin('01  Printed parts','Print the listed quantity. Line drawings use white faces for clarity; part IDs identify prints. Electronic and metal references are not functional prints.')
items=[('camera-pod-spider','P01  Existing spider','1 x / r0.1.0'),('payload-electronics-deck','P02  Electronics deck','1 x'),('payload-spider-spacer','P03  Spider spacer','4 x / 14 mm'),('payload-pan-servo-mount','P04  Pan servo mount','1 x'),('payload-pan-yoke','P05  Pan yoke','1 x'),('payload-tilt-pivot-support','P06  Pivot support','1 x / removable'),('payload-camera-cradle','P07  Camera cradle','1 x'),('payload-horn-retainer','P08  Horn retainer','2 x / identical'),('payload-camera-hood','P09  Camera hood','1 x'),('payload-electronics-cover','P10  Electronics cover','1 x / removable'),('payload-servo-fit-coupon','T01  Servo fit coupon','1 test print / not installed')]
for i,(name,title,count) in enumerate(items):
 x=16+(i%3)*61;y=55+(i//3)*50
 fig('part-'+name,x,y,56,34);para(x,y+35,57,'<b>'+title+'</b>',small=True,max_h=10);para(x,y+43,57,count,small=True,max_h=10)
para(139,213,55,'PETG starting point:<br/>0.2 mm layers, 3+ walls.<br/>Solid small parts.<br/>Supports on complex brackets.',small=True,max_h=38)
note(261,'All STLs are in mm and shifted onto Z=0. Brackets need support planning in the slicer. Remove support scars from mating faces and holes; do not enlarge the horn pocket until it becomes loose.')

begin('02  Measure before printing','The stock Pi/camera hole patterns are documented. The servo, horn, converter and capacitor must be checked against received hardware.')
fig('part-payload-servo-fit-coupon',16,54,73,55)
para(102,57,92,'<b>Test both servos</b><br/>The body should pass the coupon without force; both lug holes must align. Also measure the shaft offset and height: the coupon cannot check either.',small=True,max_h=36)
table([['<b>Interface</b>','<b>Nominal model / required check</b>'],['Servo body','20 x 8.5 x 18 mm; window 20.8 x 9.3 mm'],['Servo ears','27 mm span; 24 mm hole pitch; 1.7 mm holes'],['Output shaft','5 mm off body centre; tip 22 mm above case bottom'],['Stock horn','8 mm hub; one 12 mm arm; hub 2 mm / arm 1.5 mm thick'],['Converter / capacitor','45 x 25 x 15 mm / 10 mm diameter x 16 mm can'],['Pi / camera holes','58 x 49 mm, M2.5 / 21 x 12.5 mm, M2']],120,[55,123])
para(16,223,178,'Edit hardware/lib/payload-mounts.scad and the matching reference models if the parts differ, then rebuild and repeat the checks. Use the original servo horns and centre screws; there is no printed spline.',small=True,max_h=21)
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

begin('13  Final bench inspection','Support the spider on a fixture so the camera hangs free. Do not rest the payload on its optical hood or force a geared servo by hand.')
steps=[('Inspect the retained parts','No loose PCB, horn, pivot nut or strap. Countersunk heads fully seated. Camera centre screws installed. The pivot remains free and has no excessive side play.'),('Check cables before powered motion','Verify both slack loops and all four travel corners with the drive disengaged where practical. Calibrate narrow software limits first, then increase only after observing clearance.'),('Check power and imaging','Verify the converter output before attaching the Pi. Check for brownouts during servo motion, focus and capture. Keep hands, loose wires and tools away from the moving brackets.'),('Record what was built','Measure servo/converter dimensions, revisions, print settings, complete mass, movement limits and faults. No load, fatigue, weather or suspended-operation test has been performed here.')]
for i,(title,body) in enumerate(steps):step(i+1,16,55+i*42,title,body)
para(16,229,178,f'<b>Pack contents</b><br/>{len(models)} checked STLs, assembled GLB, current source snapshot, assembly/figure transforms, source hashes and JSON check reports. Only models/printable contains fabrication parts; the fit coupon is not installed.',small=True,max_h=23)
para(16,258,178,'<b>Sources and open interfaces</b><br/>Full source URLs and assumptions: sources.json. Line terminations, docking-stud interface, actual ribbon behaviour, electrical performance and flying mass remain open; they are not supplied as verified interfaces.',small=True,max_h=22)
assert p.PAGE==14
C.save();print(p.OUT)
