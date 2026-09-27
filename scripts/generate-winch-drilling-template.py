#!/usr/bin/env python3
"""Regenerate the passive-base 1:1 A4 PDF. Requires reportlab. Fixed CAD baseline: d8235b0."""
from pathlib import Path
import argparse
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output",type=Path,default=Path(__file__).resolve().parents[1]/"hardware/assemblies/winch/passive-base-drilling-A4.pdf")
OUT=parser.parse_args().output
OUT.parent.mkdir(parents=True,exist_ok=True)
c=canvas.Canvas(str(OUT),pagesize=(297*mm,210*mm),invariant=1)
c.setTitle('ARBI passive winch base drilling template - 1:1 A4')
W=246.9
holes=[]
for x in [28.5,W+103.5]:
    for y in [50,130]: holes.append((x,y,7,'Bearing'))
for x in [W+163,W+205]:
    for y in [46,134]: holes.append((x,y,7,'Motor'))
for x in [W/2+25,W/2+75]:
    for y in [30,150]: holes.append((x,y,9,'Post - optional'))

def line(x1,y1,x2,y2):
    c.line(x1*mm,y1*mm,x2*mm,y2*mm)

for page,(start,end) in enumerate([(0,200),(175,375),(350,550)],1):
    # Plate spans 20..220 mm horizontally, 15..195 mm vertically.
    def X(x): return 20+x-start
    def Y(y): return 15+y
    c.setStrokeColor(HexColor('#222222'));c.setLineWidth(.23*mm)
    c.rect(X(start)*mm,Y(0)*mm,200*mm,180*mm)
    for x,y,d,label in holes:
        if start+3 < x < end-3:
            c.setStrokeColor(HexColor('#111111'));c.setLineWidth(.24*mm)
            c.circle(X(x)*mm,Y(y)*mm,d/2*mm)
            line(X(x)-7,Y(y),X(x)+7,Y(y));line(X(x),Y(y)-7,X(x),Y(y)+7)
            c.setFont('Helvetica',7);c.drawString((X(x)+6)*mm,(Y(y)+5)*mm,f'{label}  dia {d} mm')
    # Shared alignment crosses, printed on both adjacent sheets.
    for x in (187.5,362.5):
        if start <= x <= end:
            c.setStrokeColor(HexColor('#007a88'));c.setLineWidth(.28*mm)
            for y in (12,90,168):
                line(X(x)-5,Y(y),X(x)+5,Y(y));line(X(x),Y(y)-5,X(x),Y(y)+5)
    c.setStrokeColor(HexColor('#555555'));c.setLineWidth(.18*mm)
    # 100-mm scale reference on each sheet.
    line(235,55,235,155)
    for yy in [55,105,155]: line(232,yy,238,yy)
    c.setFont('Helvetica-Bold',9)
    c.drawCentredString(235*mm,161*mm,'100 mm')
    c.setFont('Helvetica-Bold',11)
    c.drawString(9*mm,203*mm,f'ARBI PASSIVE BASE   |   SHEET {page} OF 3   |   1:1')
    c.setFont('Helvetica',8)
    c.drawString(235*mm,187*mm,'550 x 180 mm plate')
    c.drawString(235*mm,181*mm,'Print A4 landscape')
    c.drawString(235*mm,175*mm,'Actual size / 100%')
    c.drawString(235*mm,169*mm,'No fit-to-page')
    c.drawString(235*mm,43*mm,'Blue crosses: align')
    c.drawString(235*mm,37*mm,'overlapping sheets')
    c.drawString(235*mm,28*mm,'Punch centers first;')
    c.drawString(235*mm,22*mm,'drill pilot, then size.')
    c.setFont('Helvetica',7)
    c.drawString(9*mm,6*mm,'CAD: hardware/lib/winch-mount.scad | passive W=246.9 mm | all dimensions nominal')
    if page==1:
        c.drawString(23*mm,17*mm,'PLATE LEFT EDGE')
    if page==3:
        c.drawRightString(217*mm,17*mm,'PLATE RIGHT EDGE')
    c.showPage()
c.save()
print(OUT)
