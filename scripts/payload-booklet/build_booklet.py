"""Illustrated payload bench assembly from the registered fabrication STLs."""
import json,math
import page_style as p
from page_style import C,ROOT,mm,BLUE,INK,GRAY,LINE,white,HexColor,Table,TableStyle
from page_style import text,para,line,box,fig,arrow,step,note,begin

report=json.loads((ROOT/'integration-check.json').read_text())
assert not report['neutral_collisions'] and not report['motion_grid']['failures']
models=json.loads((ROOT/'mesh-manifest.json').read_text())

def table(rows,y,widths,small=8.5):
 data=[[p.Paragraph(str(s),p.SMALL) for s in row] for row in rows]
 t=Table(data,colWidths=[w*mm for w in widths]);t.setStyle(TableStyle([
 ('BACKGROUND',(0,0),(-1,0),HexColor('#dceffa')),('ROWBACKGROUNDS',(0,1),(-1,-1),[white,HexColor('#f5f8fa')]),
 ('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),('LINEBELOW',(0,0),(-1,0),.7,BLUE)]))
 _,h=t.wrap(178*mm,1000);assert y+h/mm<281,(y,h/mm)
 t.drawOn(C,16*mm,(297-y)*mm-h);return y+h/mm

begin('Build the payload','Pi 3A+ / Camera Module 3 Standard / two micro servos. Mount set r0.1.0, dry bench prototype.')
fig('assembled-open',10,52,190,140)
text(16,199,'THE MISSING PRINTED STRUCTURE IS NOW INCLUDED',10.5,True,BLUE)
para(16,206,178,'A fixed electronics deck, both servo mounts, stock-horn retainers, supported camera cradle, removable pivot support, optical hood and electronics cover. Every illustration uses the supplied STL files.',max_h=23)
box(16,235,178,28)
para(21,240,168,'<b>Fit before the full print</b><br/>Servo and power-module dimensions remain provisional. Start with the servo coupon and compare the dimension table on page 3 with your received parts. These models are not physically tested.',small=True,max_h=21)
para(16,269,178,'CAD checks cover rigid geometry, fasteners and motion. Suspended operation still needs mass, strength, balance, cable-flex and electrical checks.',small=True,max_h=12)

begin('01  Printed parts','Print the listed quantity. Blue parts are fabrication meshes; electronic and metal reference meshes are not functional prints.')
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
